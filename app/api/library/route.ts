import {env} from 'cloudflare:workers';
import {owner,handle,json} from '../../../lib/recipe-cloud';
export const dynamic='force-dynamic';
export function GET(){return handle(async()=>{
  const user=await owner();
  const result=await env.DB!.prepare('SELECT id, revision, deleted FROM recipes WHERE owner = ?').bind(user).all();
  return json({records:result.results});
});}
