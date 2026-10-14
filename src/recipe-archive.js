import {metricRecipe} from './metric.js';
import {zipSync,unzip,strToU8,strFromU8} from './vendor/fflate.js';
import {LIMITS,safePath,validateRecipe} from './model.js';
import {importPackage,imageMime} from './importer.js';

export async function exportRecipes(records,wholeLibrary=false) {
  if(!records.length)throw new Error('There are no recipes to export.');
  const files={};let expanded=0;
  const add=(path,bytes)=>{if(files[path]){if(files[path].length!==bytes.length||files[path].some((v,i)=>v!==bytes[i]))throw new Error('Two different images share the same file path. Correct the recipe before exporting.');return;}expanded+=bytes.length;if(expanded>LIMITS.expanded||Object.keys(files).length>=LIMITS.files)throw new Error('This export exceeds 80 MB or 500 files. Export individual recipes instead.');files[path]=bytes;};
  if(wholeLibrary)add('library.json',strToU8(JSON.stringify({format:'cookstep-library',version:1,recipes:records.map((_,i)=>`recipes/${i}/recipe.json`)})));
  for(const [i,record] of records.entries()){
    const prefix=wholeLibrary?`recipes/${i}/`:'';
    const manifest=strToU8(JSON.stringify(metricRecipe(record.recipe),null,2));
    if(manifest.length>LIMITS.json)throw new Error('Recipe manifest exceeds 2 MB.');
    add(prefix+'recipe.json',manifest);
    for(const image of record.recipe.images||[]){
      const blob=record.assets?.[image.id];
      if(!blob)throw new Error(`Missing image: ${image.alt}. Sync your library and try again.`);
      if(blob.size>LIMITS.image||!safePath(image.path))throw new Error('Invalid recipe image.');
      add(prefix+image.path,new Uint8Array(await blob.arrayBuffer()));
    }
  }
  const bytes=zipSync(files,{level:6});
  if(bytes.length>LIMITS.package)throw new Error('This ZIP exceeds 25 MB. Export individual recipes or use smaller images.');
  return new Blob([bytes],{type:'application/zip'});
}
export async function importRecipes(file) {
  if(!/\.zip$/i.test(file.name))return [await importPackage(file)];
  if(file.size>LIMITS.package)throw new Error('Package exceeds 25 MB.');
  let total=0,count=0,limitError;const names=new Set();
  const bytes=new Uint8Array(await file.arrayBuffer());
  const files=await new Promise((resolve,reject)=>unzip(bytes,{filter:entry=>{
    total+=entry.originalSize;count++;
    if(names.has(entry.name)||!safePath(entry.name)||count>LIMITS.files||total>LIMITS.expanded||!Number.isFinite(entry.originalSize))limitError='ZIP contains duplicate or unsafe paths, or exceeds 500 files / 80 MB.';
    names.add(entry.name);
    if(/(^|\/)recipe\.json$/.test(entry.name)&&entry.originalSize>LIMITS.json)limitError='Recipe manifest exceeds 2 MB.';
    if(entry.name==='library.json'&&entry.originalSize>LIMITS.json)limitError='Library index exceeds 2 MB.';
    if(/\/images\//.test(entry.name)&&entry.originalSize>LIMITS.image)limitError='Image exceeds 10 MB.';
    return !limitError;
  }},(error,result)=>error?reject(new Error('Cannot read ZIP.')):limitError?reject(new Error(limitError)):resolve(result)));
  if(!files['library.json'])return [await importPackage(file)];
  let index;
  try{index=JSON.parse(strFromU8(files['library.json']));}catch{throw new Error('Invalid library index.');}
  if(index.format!=='cookstep-library'||index.version!==1||!Array.isArray(index.recipes)||!index.recipes.length||index.recipes.length>LIMITS.files)throw new Error('Unsupported library archive.');
  const ids=new Set(),paths=new Set(),records=[];
  for(const path of index.recipes){
    if(typeof path!=='string'||!/^recipes\/\d+\/recipe\.json$/.test(path)||paths.has(path)||!files[path])throw new Error('Invalid library recipe path.');
    paths.add(path);const prefix=path.slice(0,-'recipe.json'.length);
    let recipe;
    try{recipe=JSON.parse(strFromU8(files[path]));}catch{throw new Error('Invalid recipe JSON in library.');}
    const errors=validateRecipe(recipe,new Set(Object.keys(files).filter(p=>p.startsWith(prefix)).map(p=>p.slice(prefix.length))));
    if(errors.length){const error=new Error('Please correct the library archive before importing.');error.details=errors;throw error;}
    recipe=metricRecipe(recipe,{strict:true});
    if(ids.has(recipe.id))throw new Error('Library archive contains duplicate recipe IDs.');
    ids.add(recipe.id);const assets={};
    for(const image of recipe.images||[]){const bytes=files[prefix+image.path],type=imageMime(bytes);if(!type||bytes.length>LIMITS.image)throw new Error('Unsupported recipe image.');assets[image.id]=new Blob([bytes],{type});}
    records.push({id:recipe.id,recipe,assets,savedAt:Date.now()});
  }
  return records;
}
