import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {metricRecipe,metricSnapshot,metricText,metricQuantity} from '../src/metric.js';
import {importPackage} from '../public/importer.js';
import {importRecipes,exportRecipes} from '../public/recipe-archive.js';
import {formatQuantity,formatTemperature,validateRecipe} from '../src/model.js';
const sample=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));
function legacy(){const r=structuredClone(sample);delete r.translations;r.ingredients[0].quantity={text:'1 lb',value:1,unit:'lb'};r.steps[0].instruction='Cut into ½-inch pieces and heat to 350 °F.';r.steps[0].temperature={value:350,unit:'F'};return r;}

test('one-way conversion preserves dimension, exact quantities and range precision',()=>{
  const r=metricRecipe(legacy(),{strict:true});
  assert.equal(r.ingredients[0].quantity.value,453.59237);assert.equal(r.ingredients[0].quantity.unit,'g');
  assert.equal(r.steps[0].temperature.unit,'C');assert.match(r.steps[0].instruction,/1.27 cm/);assert.match(r.steps[0].instruction,/176.667 °C/);
  assert.equal(metricRecipe(r,{strict:true}),r);
  const volume=metricQuantity({text:'1–2 US cups',range:{min:1,max:2},unit:'cup_us'});
  assert.equal(volume.unit,'ml');assert.equal(volume.range.max,473.176473);
  assert.equal(formatQuantity(volume,2,'imperial').text,'473.18–946.35 ml');assert.equal(formatTemperature({value:180,unit:'C'},'imperial'),'180 °C');
  assert.equal(metricText('Use a stick blender.'),'Use a stick blender.');
  assert.equal(metricText('Stir it in.'),'Stir it in.');
  assert.equal(metricText('Cloud test e7a54491-b925-4b2f-91f3-87d8e34b392a'),'Cloud test e7a54491-b925-4b2f-91f3-87d8e34b392a');
  assert.equal(metricQuantity({text:'1 US cup'}).value,236.5882365);
  assert.throws(()=>metricText('1 stick'),/metric/);
  assert.equal(metricText('1 ½ US cups'),'354.882 ml');
  assert.equal(metricText('-40 °F'),'−40 °C'.replace('−','-'));
  assert.equal(metricText('350–375 °F'),'176.667–190.556 °C');
  assert.equal(metricText('⅓ de pulgada; 8 palců; 20 cm / 8 in'),'0.847 cm; 20.32 cm; 20 cm');
});
test('all translations share converted quantities without restoring a source unit',()=>{
  const r=structuredClone(sample);r.ingredients[0].quantity={text:'1 lb',value:1,unit:'lb'};
  for(const locale of ['en','es','cs'])r.translations[locale].ingredients[0].quantity.text=locale==='cs'?'1 libra':'1 pound';
  const converted=metricRecipe(r,{strict:true});
  for(const locale of ['en','es','cs'])assert.equal(converted.translations[locale].ingredients[0].quantity.text,'453.592 g');
  assert.deepEqual(validateRecipe(converted),[]);assert.equal(r.ingredients[0].quantity.unit,'lb');
});
test('imports and exports convert legacy data; ambiguous new measurements cannot be saved',async()=>{
  const source=legacy(),file=new File([JSON.stringify(source)],'old.json');
  const record=await importPackage(file);assert.equal(record.recipe.ingredients[0].quantity.unit,'g');
  const archive=await exportRecipes([{id:source.id,recipe:source,assets:{}}],true);
  const restored=await importRecipes(new File([archive],'library.zip'));assert.equal(restored[0].recipe.ingredients[0].quantity.unit,'g');
  source.ingredients[0].quantity={text:'1 cup',value:1,unit:'cup'};
  await assert.rejects(importPackage(new File([JSON.stringify(source)],'unclear.json')),/convention|metric/);
});
test('source repairs do not overwrite an adapted source quantity',()=>{
  const r=legacy();r.id='cooklikeczechs-chicken-breast-paprikash';r.sources=[{id:'source',title:'Recipe',url:'https://www.cooklikeczechs.com/chicken-breast-paprikash/'}];r.ingredients[0].id='chicken-breast';r.ingredients[0].quantity={text:'3 lb',value:3,unit:'lb'};
  assert.equal(metricRecipe(r,{strict:true}).ingredients[0].quantity.value,1360.77711);
});
test('migration removes preferences and preserves cooking progress and shopping checks',()=>{
  const record={id:sample.id,recipe:legacy(),assets:{image:new Blob(['bytes'])}};
  const session={id:'active',record,units:'imperial',target:3,completed:['one'],preparedIngredients:['one:0'],positions:{main:2},timers:[{instanceId:'timer',startedAt:1000}],startedAt:500};
  const migrated=metricSnapshot(session);
  assert.ok(!Object.hasOwn(migrated,'units'));assert.deepEqual(migrated.timers,session.timers);assert.deepEqual(migrated.completed,session.completed);assert.deepEqual(migrated.positions,session.positions);assert.equal(migrated.record.assets,record.assets);
  const list=metricSnapshot({id:sample.id,recipe:legacy(),units:'original',checked:['pasta'],target:4});assert.deepEqual(list.checked,['pasta']);assert.ok(!Object.hasOwn(list,'units'));
});
