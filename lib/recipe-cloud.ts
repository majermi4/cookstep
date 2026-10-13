import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {validateRecipe,LIMITS,cleanRecordTitle} from '../src/model.js';
export {imageMime} from './source-image.mjs';

export function json(value:unknown,status=200) {
  return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
}
export async function owner() {
  const user=await getChatGPTUser();
  if(!user) throw new CloudError('Sign in to Cookstep to sync your recipes.',401);
  if(!env.DB || !env.BUCKET) throw new CloudError('Cloud storage is temporarily unavailable.',503);
  return user.userId;
}
export class CloudError extends Error {
  constructor(message:string,public status=400){super(message);}
}
export async function handle(fn:()=>Promise<Response>) {
  try{return await fn();}catch(error){
    if(error instanceof CloudError) return json({error:error.message},error.status);
    console.error('Recipe storage request failed',error);
    return json({error:'Cloud storage is temporarily unavailable. Your local copy is safe.'},503);
  }
}
export async function body(request:Request) {
  if(Number(request.headers.get('content-length')||0)>3*1024**2) throw new CloudError('Recipe manifest is too large.',413);
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>3*1024**2) throw new CloudError('Recipe manifest is too large.',413);
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new CloudError('Invalid recipe JSON.');}
}
export function assetPrefix(user:string){return `recipes/${encodeURIComponent(user)}/`;}
export async function readCloudRecord(key:string) {
  const object=await env.BUCKET!.get(key);
  if(!object)throw new CloudError('Recipe data is temporarily unavailable.',503);
  const original=await object.json<any>();
  const record=cleanRecordTitle(original);
  if(record!==original){
    // A title-only correction keeps the revision stable, so it cannot create a
    // new sync conflict. Conditional replacement preserves concurrent writes.
    await env.BUCKET!.put(key,JSON.stringify(record),{
      onlyIf:{etagMatches:object.etag},httpMetadata:object.httpMetadata,customMetadata:object.customMetadata,
    });
  }
  return record;
}
export async function validatePayload(data:any,user:string,id:string) {
  if(!data || !data.recipe || data.recipe.id!==id || typeof id!=='string' || id.length>500) throw new CloudError('Recipe ID does not match.');
  let errors;
  try{errors=validateRecipe(data.recipe,new Set((data.recipe.images||[]).map((im:any)=>im.path)));}catch{throw new CloudError('Invalid recipe manifest.');}
  if(errors.length)throw new CloudError(errors[0]);
  if(JSON.stringify(data.recipe).length>LIMITS.json)throw new CloudError('Recipe manifest is too large.',413);
  const assets:Record<string,unknown>={};let total=0;
  for(const image of data.recipe.images||[]){
    const asset=data.assets?.[image.id];
    if(!asset || typeof asset.key!=='string' || !asset.key.startsWith(assetPrefix(user))) throw new CloudError('Missing recipe image.');
    const object=await env.BUCKET!.head(asset.key);
    if(!object || object.size>LIMITS.image || !['image/jpeg','image/png','image/webp'].includes(object.httpMetadata?.contentType||'')) throw new CloudError('Recipe image is unavailable.');
    total+=object.size;
    if(total>LIMITS.expanded)throw new CloudError('Recipe images exceed 80 MB.',413);
    assets[image.id]={key:asset.key,size:object.size,type:object.httpMetadata!.contentType};
  }
  return cleanRecordTitle({id,recipe:data.recipe,assets,savedAt:Number.isFinite(data.savedAt)?data.savedAt:Date.now()});
}

export async function mutateCloudRecord(user:string,id:string,data:any,deleted=false) {
  if(typeof id!=='string' || !id || id.length>500)throw new CloudError('Invalid recipe ID.');
  const expected=data.expectedRevision??null;
  if(expected!==null && typeof expected!=='string')throw new CloudError('Invalid recipe revision.');
  if(typeof data.mutationId!=='string' || !/^[0-9a-f-]{36}$/.test(data.mutationId))throw new CloudError('Invalid change identifier.');
  const revision=data.mutationId;
  const current=await env.DB!.prepare('SELECT revision FROM recipes WHERE owner = ? AND id = ?').bind(user,id).first<any>();
  if(current?.revision===revision)return {revision};
  let payload:string|null=null;
  if(!deleted){
    // R2 holds the full manifest so recipes near the 2 MB importer limit do
    // not exceed D1's row-size limit. D1 commits its reference atomically.
    const record=await validatePayload(data,user,id);
    payload=assetPrefix(user)+'manifests/'+encodeURIComponent(id)+'/'+revision;
    await env.BUCKET!.put(payload,JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
  }
  const result=await env.DB!.prepare(`INSERT INTO recipes (owner,id,revision,deleted,payload,updated_at)
    SELECT ?,?,?,?,?,? WHERE ? IS NULL OR EXISTS (SELECT 1 FROM recipes WHERE owner = ? AND id = ? AND revision = ?)
    ON CONFLICT(owner,id) DO UPDATE SET revision=excluded.revision,deleted=excluded.deleted,payload=excluded.payload,updated_at=excluded.updated_at
    WHERE recipes.revision = ?`).bind(user,id,revision,deleted?1:0,payload,Date.now(),expected,user,id,expected,expected).run();
  if(result.meta.changes!==1)throw new CloudError('This recipe changed on another device. Your local change is kept; sync again to preserve both versions.',409);
  return {revision};
}
