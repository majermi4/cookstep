import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
import {exportRecipes,importRecipes} from '../public/recipe-archive.js';
const sample=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));
// Legacy fixtures exercise schema mutations independently of translated overlays.
delete sample.translations;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64');
const record={id:sample.id,recipe:{...sample,images:[{id:'photo',path:'images/test.png',alt:'Test image',origin:'user_supplied',kind:'photo'}],coverImageId:'photo'},assets:{photo:new Blob([png],{type:'image/png'})}};
test('recipe and full library ZIPs round trip manifests and actual image bytes',async()=>{
  for(const whole of [false,true]){
    const records=whole?[record,{id:'another',recipe:{...sample,id:'another'},assets:{}}]:[record];
    const blob=await exportRecipes(records,whole),restored=await importRecipes(new File([blob],'backup.zip'));
    assert.deepEqual(restored.map(r=>r.recipe),records.map(r=>r.recipe));
    assert.deepEqual(Buffer.from(await restored[0].assets.photo.arrayBuffer()),png);
    assert.equal(restored[0].assets.photo.type,'image/png');
  }
});
test('a corrupt recipe, duplicate IDs or missing image rejects the entire library',async()=>{
  const index={'library.json':strToU8(JSON.stringify({format:'cookstep-library',version:1,recipes:['recipes/0/recipe.json','recipes/1/recipe.json']}))};
  for(const second of [sample,{...sample,id:'bad',steps:[]},{...record.recipe,id:'missing-image'}]){
    const files={...index,'recipes/0/recipe.json':strToU8(JSON.stringify(sample)),'recipes/1/recipe.json':strToU8(JSON.stringify(second))};
    await assert.rejects(importRecipes(new File([zipSync(files)],'backup.zip')));
  }
});
test('export refuses missing assets rather than producing a broken backup',async()=>{
  await assert.rejects(exportRecipes([{...record,assets:{}}]),/Missing image/);
});
