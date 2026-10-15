import test from 'node:test';
import assert from 'node:assert/strict';
import {readUploadedImage,uploadImageTool} from '../lib/recipe-image-upload.mjs';
import {SourceImageError} from '../lib/source-image.mjs';
import {LIMITS} from '../src/model.js';

const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==';
const png=Uint8Array.from(Buffer.from(base64,'base64'));
const url='https://files.oaiusercontent.com/illustration.png?signature=temporary';
const file={download_url:url,file_id:'file-test-illustration'};
const image=()=>new Response(png,{headers:{'content-type':'image/png'}});

test('upload exposes the native ChatGPT file contract alongside URL and base64 inputs',()=>{
  assert.deepEqual(uploadImageTool._meta['openai/fileParams'],['file']);
  const schema=uploadImageTool.inputSchema;
  assert.deepEqual(Object.keys(schema.properties.file.properties).sort(),['download_url','file_id','file_name','mime_type']);
  assert.deepEqual(schema.properties.file.required,['download_url','file_id']);
  assert.deepEqual(schema.oneOf,[{required:['file']},{required:['url']},{required:['base64']}]);
  assert.equal(uploadImageTool.annotations.openWorldHint,true);
});

test('native file and signed URL uploads fetch original bytes without leaking transport references',async()=>{
  for(const args of [{file},{file:{...file,mime_type:'image/png',file_name:'illustration.png'}},{url}]){
    const result=await readUploadedImage(args,{fetchImage:async(target,options)=>{
      assert.equal(target,url);
      assert.equal(options.redirect,'manual');
      assert.deepEqual(options.headers,{Accept:'image/jpeg, image/png, image/webp'});
      return image();
    }});
    assert.deepEqual(result,{bytes:png,type:'image/png'});
  }
});

test('uploads retain multi-megabyte original bytes and support the existing base64 input',async()=>{
  const original=new Uint8Array(2*1024**2);original.set(png);
  for(const args of [{file},{base64:Buffer.from(original).toString('base64')}]){
    const result=await readUploadedImage(args,{fetchImage:async()=>new Response(original)});
    assert.deepEqual(result.bytes,original);
    assert.equal(result.type,'image/png');
  }
  assert.deepEqual(await readUploadedImage({base64}),{bytes:png,type:'image/png'});
});

test('ambiguous inputs, fabricated local paths and incomplete file references fail before fetching',async()=>{
  for(const args of [null,[],{}, {file,base64},{file,url},{url,base64},{base64,extra:true},
    {file:null},{file:[]},{file:{download_url:url}},{file:{file_id:'file-test'}},
    {file:{...file,file_id:' '}},{file:{...file,mime_type:null}},{file:{...file,extra:true}},
    {file:{...file,download_url:'/mnt/data/illustration.png'}},{url:'/mnt/data/illustration.png'},
    {file:{...file,download_url:'https://127.0.0.1/private'}},{url:'https://a.internal/private'}]){
    await assert.rejects(readUploadedImage(args,{fetchImage:()=>assert.fail('Invalid image input was fetched')}),SourceImageError);
  }
  for(const invalid of ['',null,'data:image/png;base64,'+base64,'=AAA','AAAA=','AA=A','abc!','a===','aaaa====','not an image']){
    await assert.rejects(readUploadedImage({base64:invalid}),SourceImageError);
  }
});

test('expired references give a reattachment error without exposing the signed URL',async()=>{
  await assert.rejects(readUploadedImage({file},{fetchImage:async()=>new Response(null,{status:403})}),error=>{
    assert.match(error.message,/HTTP 403/);
    assert.match(error.message,/attach the original image again/);
    assert.ok(!error.message.includes('signature=temporary'));
    return true;
  });
});

test('native uploads retain redirect, byte signature, MIME, streaming limit and timeout protections',async()=>{
  for(const response of [new Response('not an image'),new Response(png,{headers:{'content-type':'image/jpeg'}}),
    new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),
    new Response(null,{status:302,headers:{location:'http://public.com/image.png'}}),
    new Response(null,{status:302,headers:{location:'https://169.254.169.254/private'}})]){
    await assert.rejects(readUploadedImage({file},{fetchImage:async()=>response}),SourceImageError);
  }
  await assert.rejects(readUploadedImage({file},{maxBytes:png.length-1,fetchImage:async()=>image()}),/10 MB/);
  const oversized=new Uint8Array(LIMITS.image+1);oversized.set(png);
  await assert.rejects(readUploadedImage({base64:Buffer.from(oversized).toString('base64')}),/10 MB/);
  await assert.rejects(readUploadedImage({file},{timeoutMs:10,fetchImage:async(target,{signal})=>new Response(new ReadableStream({
    start(controller){signal.addEventListener('abort',()=>controller.error(new Error('Aborted')));},
  }))}),/timed out/);
});
