import {LIMITS} from '../src/model.js';

export class SourceImageError extends Error {}

export function imageMime(bytes) {
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}

function publicImageUrl(value) {
  if(typeof value!=='string'||!value||value.length>4096)throw new SourceImageError('Supply a public HTTPS image URL.');
  let url;
  try{url=new URL(value);}catch{throw new SourceImageError('Supply a public HTTPS image URL.');}
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  // Use the Worker's global public fetch, never a private service binding.
  // Reject literal addresses (including normalized decimal/hex IPv4), local
  // names, custom ports and credentials, and check each redirect again.
  if(url.protocol!=='https:'||url.username||url.password||url.port||
    !host.includes('.')||host.includes(':')||/^[\d.]+$/.test(host)||
    /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)){
    throw new SourceImageError('Use a public HTTPS image URL without credentials, IP addresses or custom ports.');
  }
  url.hash='';
  return url;
}

export async function downloadSourceImage(value,{fetchImage=fetch,timeoutMs=20000,maxBytes=LIMITS.image}={}) {
  let url=publicImageUrl(value);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  let response;
  try{
    for(let redirects=0;;redirects++){
      response=await fetchImage(url.href,{
        redirect:'manual',signal:controller.signal,
        headers:{Accept:'image/jpeg, image/png, image/webp'},
      });
      if(![301,302,303,307,308].includes(response.status))break;
      await response.body?.cancel();
      if(redirects>=4)throw new SourceImageError('The image URL redirects too many times. Supply its final public image URL.');
      const location=response.headers.get('location');
      if(!location)throw new SourceImageError('The image redirect has no destination.');
      url=publicImageUrl(new URL(location,url).href);
    }
    if(!response.ok)throw new SourceImageError(`The source image could not be downloaded (HTTP ${response.status}). Supply another public image URL or upload the file.`);
    const declaredType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if(declaredType&&!['image/jpeg','image/png','image/webp','application/octet-stream','binary/octet-stream'].includes(declaredType)){
      throw new SourceImageError('The URL must point directly to a JPEG, PNG or WebP image, not a recipe page or another file type.');
    }
    if(Number(response.headers.get('content-length')||0)>maxBytes)throw new SourceImageError('Use a source image up to 10 MB.');
    if(!response.body)throw new SourceImageError('The source image is empty.');
    const reader=response.body.getReader(),chunks=[];
    let size=0;
    try{
      for(;;){
        const {done,value:chunk}=await reader.read();
        if(done)break;
        size+=chunk.byteLength;
        if(size>maxBytes)throw new SourceImageError('Use a source image up to 10 MB.');
        chunks.push(chunk);
      }
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const type=imageMime(bytes);
    if(!type||(declaredType?.startsWith('image/')&&declaredType!==type))throw new SourceImageError('The downloaded bytes are not a matching JPEG, PNG or WebP image.');
    return {bytes,type,sourceUrl:url.href};
  }catch(error){
    if(error instanceof SourceImageError)throw error;
    if(controller.signal.aborted)throw new SourceImageError('The source image download timed out. Try another public image URL or upload the file.');
    throw new SourceImageError('The source image could not be downloaded. Try another public image URL or upload the file.');
  }finally{
    clearTimeout(timeout);
    if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});
  }
}
