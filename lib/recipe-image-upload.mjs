import {LIMITS} from '../src/model.js';
import {downloadSourceImage,imageMime,SourceImageError} from './source-image.mjs';

const maxBase64Length=Math.ceil(LIMITS.image/3)*4;
const imageUrl={type:'string',minLength:1,maxLength:4096};
// ChatGPT resolves this top-level file parameter to a temporary download URL.
// Keep all four properties declared, with only download_url and file_id required.
export const uploadImageTool={
  name:'upload_recipe_image',
  description:'Store an original JPEG, PNG or WebP up to 10 MB. Prefer file for a ChatGPT-generated or attached image: pass its real file reference and let ChatGPT supply the temporary download_url and file_id. Alternatively supply url for a direct HTTPS image download, or base64 for actual bytes without a data URL prefix. Supply exactly one of file, url or base64. Preserves the original bytes without resizing or recompression. Never invent a file reference or use a local /mnt/data path as a URL. Returns an asset key and suggestedPath for save_recipe; does not save a recipe.',
  inputSchema:{
    type:'object',
    properties:{
      file:{
        type:'object',
        description:'Generated or attached ChatGPT image file. The host resolves the real file reference into these fields; do not invent download URLs or file IDs.',
        properties:{download_url:{...imageUrl,description:'Temporary HTTPS file download URL supplied by ChatGPT.'},file_id:{type:'string',minLength:1,maxLength:500},mime_type:{type:'string'},file_name:{type:'string'}},
        required:['download_url','file_id'],additionalProperties:false,
      },
      url:{...imageUrl,description:'Direct public HTTPS JPEG/PNG/WebP download URL, including a temporary signed URL. Local paths are not URLs.'},
      base64:{type:'string',minLength:1,maxLength:maxBase64Length,description:'Fallback: original image bytes encoded as base64, without a data URL prefix.'},
    },
    oneOf:[{required:['file']},{required:['url']},{required:['base64']}],
    additionalProperties:false,
  },
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  _meta:{'openai/fileParams':['file']},
};

export async function readUploadedImage(args,options={}) {
  if(!args||typeof args!=='object'||Array.isArray(args)||
    ['file','url','base64'].filter(key=>Object.hasOwn(args,key)).length!==1||
    Object.keys(args).some(key=>!['file','url','base64'].includes(key))){
    throw new SourceImageError('Supply exactly one image input: file, url or base64.');
  }
  if(Object.hasOwn(args,'base64')){
    const value=args.base64;
    if(typeof value!=='string'||!value||value.length>maxBase64Length||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value)){
      throw new SourceImageError('Supply valid base64 image bytes, up to 10 MB.');
    }
    let bytes;
    try{bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
    catch{throw new SourceImageError('Supply valid base64 image bytes, up to 10 MB.');}
    const type=imageMime(bytes);
    if(!type||bytes.length>LIMITS.image)throw new SourceImageError('Use a JPEG, PNG or WebP image up to 10 MB.');
    return {bytes,type};
  }
  let url=args.url;
  if(Object.hasOwn(args,'file')){
    const file=args.file;
    if(!file||typeof file!=='object'||Array.isArray(file)||
      typeof file.file_id!=='string'||!file.file_id.trim()||file.file_id.length>500||
      typeof file.download_url!=='string'||!file.download_url||
      Object.keys(file).some(key=>!['download_url','file_id','mime_type','file_name'].includes(key))||
      ['mime_type','file_name'].some(key=>Object.hasOwn(file,key)&&typeof file[key]!=='string')){
      throw new SourceImageError('Supply a real ChatGPT file reference with download_url and file_id. Attach the image again if its reference is unavailable.');
    }
    url=file.download_url;
  }
  try{
    const {bytes,type}=await downloadSourceImage(url,options);
    // Temporary links and file IDs are transport only, never persisted or returned.
    return {bytes,type};
  }catch(error){
    if(error instanceof SourceImageError)throw new SourceImageError(`${error.message} For an expired or inaccessible temporary link, attach the original image again and retry with its fresh file reference. Do not recompress it to fit a tool call.`);
    throw error;
  }
}
