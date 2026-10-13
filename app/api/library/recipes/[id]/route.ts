import {env} from 'cloudflare:workers';
import {owner,handle,json,body,readCloudRecord,CloudError,mutateCloudRecord} from '../../../../../lib/recipe-cloud';
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
  return json(await mutateCloudRecord(user,id,data,deleted));
});}
export function PUT(request:Request,context:Context){return mutate(request,context,false);}
export function DELETE(request:Request,context:Context){return mutate(request,context,true);}
