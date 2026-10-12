import {env} from 'cloudflare:workers';
import {owner,handle,json,assetPrefix,imageMime,CloudError} from '../../../../lib/recipe-cloud';
import {LIMITS} from '../../../../src/model.js';
export const dynamic='force-dynamic';
export function POST(request:Request){return handle(async()=>{
  const user=await owner();
  if(Number(request.headers.get('content-length')||0)>LIMITS.image)throw new CloudError('Image exceeds 10 MB.',413);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length>LIMITS.image)throw new CloudError('Image exceeds 10 MB.',413);
  const type=imageMime(bytes);
  if(!type)throw new CloudError('Unsupported image.');
  const key=assetPrefix(user)+crypto.randomUUID();
  await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:type}});
  return json({key,type,size:bytes.length});
});}
export function GET(request:Request){return handle(async()=>{
  const user=await owner(),key=new URL(request.url).searchParams.get('key');
  if(!key || !key.startsWith(assetPrefix(user)))throw new CloudError('Image not found.',404);
  const object=await env.BUCKET!.get(key);
  if(!object)throw new CloudError('Image not found.',404);
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
});}
