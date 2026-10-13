import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadSourceImage,SourceImageError} from '../lib/source-image.mjs';

const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64'));
const url='https://www.cooklikeczechs.com/images/dish.png';
const image=()=>new Response(png,{headers:{'content-type':'image/png'}});

test('source import downloads actual bytes, checks type and resolves relative HTTPS redirects',async()=>{
  const calls=[];
  const result=await downloadSourceImage(url,{fetchImage:async(target,options)=>{
    calls.push(target);
    assert.equal(options.redirect,'manual');
    assert.deepEqual(Object.keys(options.headers),['Accept']);
    return calls.length===1?new Response(null,{status:302,headers:{location:'./original.png'}}):image();
  }});
  assert.deepEqual(calls,[url,'https://www.cooklikeczechs.com/images/original.png']);
  assert.deepEqual(result.bytes,png);
  assert.equal(result.type,'image/png');
  assert.equal(result.sourceUrl,calls[1]);
});

test('unsafe source URLs are rejected before fetching, including redirects to private addresses',async()=>{
  for(const target of ['http://public.com/a.png','https://localhost/a.png','https://a.local/a.png','https://a.internal/a.png',
    'https://127.0.0.1/a.png','https://10.0.0.1/a.png','https://2130706433/a.png','https://0x7f000001/a.png',
    'https://[::1]/a.png','https://[::ffff:127.0.0.1]/a.png','https://169.254.169.254/a.png',
    'https://u:p@public.com/a.png','https://public.com:8443/a.png','file:///a.png',null]){
    await assert.rejects(downloadSourceImage(target,{fetchImage:()=>{assert.fail('Unsafe URL was fetched');}}),SourceImageError);
  }
  let calls=0;
  await assert.rejects(downloadSourceImage(url,{fetchImage:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}});}}),/public HTTPS/);
  assert.equal(calls,1);
});

test('source import rejects HTML, wrong MIME, invalid bytes, HTTP failure and redirect loops',async()=>{
  for(const response of [new Response('<html>recipe</html>',{headers:{'content-type':'text/html'}}),
    new Response(png,{headers:{'content-type':'image/jpeg'}}),new Response('not an image',{headers:{'content-type':'image/png'}}),
    new Response(null,{status:403}),new Response(null,{status:302})]){
    await assert.rejects(downloadSourceImage(url,{fetchImage:async()=>response}),SourceImageError);
  }
  let calls=0;
  await assert.rejects(downloadSourceImage(url,{fetchImage:async()=>{calls++;return new Response(null,{status:302,headers:{location:url}});}}),/too many times/);
  assert.equal(calls,5);
  await assert.rejects(downloadSourceImage(url,{fetchImage:async()=>{throw new Error('Network unreachable');}}),/could not be downloaded/);
});

test('source import enforces declared and streamed limits and cancels oversized bodies',async()=>{
  await assert.rejects(downloadSourceImage(url,{maxBytes:png.length-1,fetchImage:async()=>new Response(png,{headers:{'content-length':String(png.length)}})}),/10 MB/);
  let cancelled=false;
  await assert.rejects(downloadSourceImage(url,{maxBytes:png.length-1,fetchImage:async()=>new Response(new ReadableStream({
    start(controller){controller.enqueue(png);},cancel(){cancelled=true;},
  }))}),/10 MB/);
  assert.equal(cancelled,true);
});

test('source import times out while reading a stalled image body',async()=>{
  await assert.rejects(downloadSourceImage(url,{timeoutMs:10,fetchImage:async(target,{signal})=>new Response(new ReadableStream({
    start(controller){signal.addEventListener('abort',()=>controller.error(new Error('Aborted')));},
  }))}),/timed out/);
});

test('source import accepts JPEG and WebP byte signatures and binary MIME responses',async()=>{
  for(const [bytes,type] of [[new Uint8Array([255,216,255,224]),'image/jpeg'],[new TextEncoder().encode('RIFF0000WEBP0000'),'image/webp']]){
    const result=await downloadSourceImage(url,{fetchImage:async()=>new Response(bytes,{headers:{'content-type':'application/octet-stream'}})});
    assert.equal(result.type,type);
  }
});
