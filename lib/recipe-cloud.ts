import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {validateRecipe,LIMITS} from '../src/model.js';

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
export function imageMime(bytes:Uint8Array) {
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
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
  return {id,recipe:data.recipe,assets,savedAt:Number.isFinite(data.savedAt)?data.savedAt:Date.now()};
}
