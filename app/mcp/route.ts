import {recipeTools,callRecipeTool,recipeInstructions} from '../../lib/recipe-tools';
import {CloudError,json} from '../../lib/recipe-cloud';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  let rpc:any;
  try{
    // Base64 images need more space than JSON manifests; bound the entire RPC.
    if(Number(request.headers.get('content-length')||0)>15*1024**2)return json({error:'Request too large.'},413);
    const bytes=await request.arrayBuffer();
    if(bytes.byteLength>15*1024**2)return json({error:'Request too large.'},413);
    rpc=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON.'}},400);}
  const reply=(result:unknown)=>json({jsonrpc:'2.0',id:rpc.id,result});
  const failure=(code:number,message:string)=>json({jsonrpc:'2.0',id:rpc?.id??null,error:{code,message}});
  if(!rpc||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string'||(rpc.id!==undefined&&typeof rpc.id!=='string'&&typeof rpc.id!=='number'))return failure(-32600,'Invalid JSON-RPC request.');
  if(rpc.id===undefined)return new Response(null,{status:202});
  if(rpc.method==='server/discover')return reply({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  // Compatibility for clients that still use the initialize handshake.
  if(rpc.method==='initialize')return reply({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'cookstep',version:'1.1.0'},instructions:recipeInstructions});
  if(rpc.method==='ping')return reply({});
  if(rpc.method==='tools/list')return reply({tools:recipeTools});
  if(rpc.method!=='tools/call')return failure(-32601,'Method not found.');
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return json({error:'Sign in with ChatGPT to use your Cookstep library.'},401);
  try{
    const value=await callRecipeTool(user,rpc.params?.name,rpc.params?.arguments??{});
    return reply({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
  }catch(error){
    const message=error instanceof CloudError?error.message:'Could not complete this recipe action. Try again.';
    if(!(error instanceof CloudError))console.error('Cookstep tool failed',error);
    return reply({content:[{type:'text',text:message}],isError:true});
  }
}
