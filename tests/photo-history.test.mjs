import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {exifDate,suggestedDate,validDate} from '../src/photo-history.js';
import {validateRecipe} from '../src/model.js';
import {metricRecipe} from '../src/metric.js';
import {exportRecipes,importRecipes} from '../public/recipe-archive.js';
const sample=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));
function exif(date){
  const b=Buffer.alloc(80);b.writeUInt16BE(0xffd8,0);b.writeUInt16BE(0xffe1,2);b.writeUInt16BE(76,4);b.write('Exif\0\0',6,'binary');b.write('II',12);b.writeUInt16LE(42,14);b.writeUInt32LE(8,16);b.writeUInt16LE(1,20);b.writeUInt16LE(0x8769,22);b.writeUInt16LE(4,24);b.writeUInt32LE(1,26);b.writeUInt32LE(26,30);b.writeUInt16LE(1,38);b.writeUInt16LE(0x9003,40);b.writeUInt16LE(2,42);b.writeUInt32LE(20,44);b.writeUInt32LE(44,48);b.write(date,56,'ascii');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
}
test('capture date is extracted before processing and earliest valid date wins',()=>{
  assert.equal(exifDate(exif('2024:02:29 12:30:00')),'2024-02-29');
  assert.equal(exifDate(exif('2023:02:29 12:30:00')),null);
  assert.equal(exifDate(new Uint8Array([1,2]).buffer),null);
  assert.equal(suggestedDate([null,'2025-01-01','2024-02-29'],new Date(2026,0,2)),'2024-02-29');
  assert.equal(suggestedDate([null],new Date(2026,0,2)),'2026-01-02');assert.equal(validDate('2025-02-29'),false);
});
test('history and photo bytes survive both backup formats and reject broken references',async()=>{
  const recipe=structuredClone(sample);delete recipe.translations;
  recipe.images=[{id:'history-photo',path:'images/history.jpg',alt:'Cooking photo',kind:'photo',origin:'user_supplied'}];
  recipe.cookingHistory=[{id:'meal',date:'2024-02-29',note:'Used 2 cups',photoIds:['history-photo']}];
  const blob=new Blob([Buffer.from('ffd8ff00','hex')],{type:'image/jpeg'}),record={id:recipe.id,recipe,assets:{'history-photo':blob}};
  assert.equal(metricRecipe(recipe).cookingHistory[0].note,'Used 2 cups');
  assert.deepEqual(validateRecipe(recipe,new Set(['images/history.jpg'])),[]);
  for(const whole of [false,true]){const zip=await exportRecipes([record],whole),[restored]=await importRecipes(new File([zip],'backup.zip'));assert.deepEqual(restored.recipe.cookingHistory,recipe.cookingHistory);assert.deepEqual(await restored.assets['history-photo'].arrayBuffer(),await blob.arrayBuffer());}
  recipe.cookingHistory[0].photoIds=['missing'];assert.ok(validateRecipe(recipe,new Set(['images/history.jpg'])).some(e=>e.includes('reference')));
});
