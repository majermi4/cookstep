import {env} from 'cloudflare:workers';
import {owner,handle,json,body,validatePayload,assetPrefix,readCloudRecord,CloudError} from '../../../../../lib/recipe-cloud';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export function GET(_request:Request,context:Context){return handle(async()=>{
  const user=await owner(),{id}=await context.params;
  const row=await env.DB!.prepare('SELECT revision, deleted, payload FROM recipes WHERE owner = ? AND id = ?').bind(user,id).first<any>();
  if(!row || row.deleted)throw new CloudError('Recipe not found.',404);
  return json({...await readCloudRecord(row.payload),revision:row.revision});
});}
async function mutate(request:Request,context:Context,deleted:boolean){return handle(async()=>{
  const user=await owner(),{id}=await context.params,data=await body(request);
  if(!id || id.length>500)throw new CloudError('Invalid recipe ID.');
  const expected=data.expectedRevision??null;
  if(expected!==null && typeof expected!=='string')throw new CloudError('Invalid recipe revision.');
  if(typeof data.mutationId!=='string' || !/^[0-9a-f-]{36}$/.test(data.mutationId))throw new CloudError('Invalid change identifier.');
  const revision=data.mutationId;
  const current=await env.DB!.prepare('SELECT revision FROM recipes WHERE owner = ? AND id = ?').bind(user,id).first<any>();
  if(current?.revision===revision)return json({revision});
  let payload:string|null=null;
  if(!deleted){
    // R2 holds the full manifest so recipes near the 2 MB importer limit do
    // not exceed D1's row-size limit. D1 commits its reference atomically.
    const record=await validatePayload(data,user,id);
    payload=assetPrefix(user)+'manifests/'+revision;
    await env.BUCKET!.put(payload,JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
  }
  const result=await env.DB!.prepare(`INSERT INTO recipes (owner,id,revision,deleted,payload,updated_at)
    SELECT ?,?,?,?,?,? WHERE ? IS NULL OR EXISTS (SELECT 1 FROM recipes WHERE owner = ? AND id = ? AND revision = ?)
    ON CONFLICT(owner,id) DO UPDATE SET revision=excluded.revision,deleted=excluded.deleted,payload=excluded.payload,updated_at=excluded.updated_at
    WHERE recipes.revision = ?`).bind(user,id,revision,deleted?1:0,payload,Date.now(),expected,user,id,expected,expected).run();
  if(result.meta.changes!==1)throw new CloudError('This recipe changed on another device. Your local change is kept; sync again to preserve both versions.',409);
  return json({revision});
});}
export function PUT(request:Request,context:Context){return mutate(request,context,false);}
export function DELETE(request:Request,context:Context){return mutate(request,context,true);}
