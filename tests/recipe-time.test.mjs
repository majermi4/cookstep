import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRecipe,formatTotalTime,createSession} from '../src/model.js';
import {recipeText,localizeRecipe} from '../src/recipe-locales.js';
import {setLocale} from '../src/i18n.js';
import {importPackage} from '../public/importer.js';
const example=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));

test('total time accepts positive minutes or an ordered range and preserves legacy recipes',()=>{
  for(const totalTime of [undefined,{minutes:90},{range:{min:60,max:90},estimated:true}]){
    assert.deepEqual(validateRecipe({...example,totalTime}),[]);
  }
  for(const totalTime of [null,0,[],{}, {minutes:0},{minutes:-1},{minutes:'60'},{minutes:Infinity},{minutes:NaN},{minutes:60,range:{min:60,max:90}},{range:null},{range:{min:90,max:60}},{range:{min:0,max:60}},{range:{min:10,max:Infinity}},{minutes:60,estimated:'yes'}]){
    assert.ok(validateRecipe({...example,totalTime}).some(e=>e.startsWith('totalTime')));
  }
});

test('time display handles hours, ranges, estimates and unknowns in all locales',()=>{
  for(const [locale,hour,missing] of [['en','hr','Time not specified'],['es','h','Tiempo no especificado'],['cs','h','Čas není uveden']]){
    setLocale(locale);
    assert.equal(formatTotalTime({totalTime:{minutes:90}}),`1 ${hour} 30 min`);
    assert.equal(formatTotalTime({totalTime:{range:{min:120,max:150},estimated:true}}),`≈ 2 ${hour}–2 ${hour} 30 min`);
    assert.equal(formatTotalTime({totalTime:{minutes:20}}),'20 min');
    assert.equal(formatTotalTime({totalTime:{minutes:0.5}}),'1 min');
    assert.equal(formatTotalTime({}),missing);
  }
  setLocale('en');
});

test('import, translations and scaled session snapshots preserve authored totals',async()=>{
  const recipe={...example,totalTime:{range:{min:60,max:75},estimated:true}};
  const record=await importPackage(new File([JSON.stringify(recipe)],'recipe.json'));
  assert.deepEqual(record.recipe.totalTime,recipe.totalTime);
  assert.equal(recipeText(recipe).totalTime,undefined);
  for(const locale of ['en','es','cs'])assert.deepEqual(localizeRecipe(recipe,locale).totalTime,recipe.totalTime);
  const session=createSession(record,recipe.yield.quantity*3);
  assert.deepEqual(session.record.recipe.totalTime,recipe.totalTime);
  assert.equal(session.timers.length,0);
  record.recipe.totalTime.minutes=900;
  assert.deepEqual(session.record.recipe.totalTime,{range:{min:60,max:75},estimated:true});
});
