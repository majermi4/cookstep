import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {metricRecipe,metricSnapshot} from '../src/metric.js';
import {formatQuantity,validateRecipe} from '../src/model.js';
import {shoppingQuantity,shoppingText,createShoppingList} from '../src/shopping.js';
import {localizeRecipe} from '../src/recipe-locales.js';
import {setLocale} from '../src/i18n.js';
import {importPackage} from '../public/importer.js';
import {exportRecipes,importRecipes} from '../public/recipe-archive.js';
const sample=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));
function recipe(){
  const r=structuredClone(sample);delete r.translations;
  r.ingredients[0]={id:'paprika',name:'Sweet Hungarian paprika',quantity:{text:'15 ml',value:15,unit:'ml'}};
  r.steps[0].ingredientUses=[{ingredientId:'paprika',quantity:{text:'5 ml',value:5,unit:'ml'}}];
  // Replace references to the original first ingredient.
  for(const step of r.steps)for(const use of step.ingredientUses||[])if(use.ingredientId===sample.ingredients[0].id)use.ingredientId='paprika';
  return r;
}
test('previously converted spices recover spoons and ingredient-specific grams, including split step amounts',()=>{
  const input=recipe(),r=metricRecipe(input,{strict:true});
  assert.equal(input.ingredients[0].quantity.spiceMeasure,undefined);
  assert.equal(formatQuantity(r.ingredients[0].quantity).text,'1 tbsp (≈ 6.9 g)');
  assert.equal(formatQuantity(r.ingredients[0].quantity,2).text,'2 tbsp (≈ 13.8 g)');
  assert.equal(formatQuantity(r.steps[0].ingredientUses[0].quantity).text,'1 tsp (≈ 2.3 g)');
  assert.equal(metricRecipe(r,{strict:true}),r);
  assert.deepEqual(validateRecipe(r),[]);
  const pepper=metricRecipe({...recipe(),ingredients:[{id:'pepper',name:'Ground black pepper',quantity:{text:'1.25 ml',value:1.25,unit:'ml'}}],steps:[]});
  assert.equal(formatQuantity(pepper.ingredients[0].quantity).text,'¼ tsp (≈ 0.6 g)');
});
test('ranges, mass-based spice quantities and explicit US/Australian spoon conventions retain a single scalable basis',()=>{
  for(const [quantity,expected] of [
    [{text:'5–10 ml',range:{min:5,max:10},unit:'ml'},'1–2 tsp (≈ 2.3–4.6 g)'],
    [{text:'4.6 g',value:4.6,unit:'g'},'2 tsp (≈ 4.6 g)'],
    [{text:'1 Australian tbsp',value:1,unit:'tbsp_au'},'1 tbsp (≈ 9.2 g)'],
    [{text:'1 US tsp',value:1,unit:'tsp_us'},'1 tsp (≈ 2.3 g)'],
    [{text:'½ tsp',value:.5,unit:'tsp'},'½ tsp (≈ 1.2 g)'],
  ]){
    const r=recipe();r.ingredients[0].quantity=quantity;
    const q=metricRecipe(r,{strict:true}).ingredients[0].quantity;
    assert.equal(formatQuantity(q).text,expected);
  }
});
test('qualitative amounts, counts, fresh herbs, vegetables and distinct spice forms never acquire an invented weight',()=>{
  for(const [name,quantity] of [
    ['Ground cinnamon',{text:'a pinch'}],['Salt',{text:'to taste'}],['Bay leaves',{text:'4 leaves',value:4,unit:'leaf'}],
    ['Fresh parsley',{text:'15 ml',value:15,unit:'ml'}],['Red bell peppers',{text:'3 peppers',value:3,unit:'piece'}],
    ['Whole black peppercorns',{text:'5 ml',value:5,unit:'ml'}],['Coarse sea salt',{text:'5 ml',value:5,unit:'ml'}],
  ]){
    const r=recipe();r.ingredients[0]={id:'paprika',name,quantity};
    const result=metricRecipe(r,{strict:true}).ingredients[0].quantity;
    assert.equal(result.spiceMeasure,undefined);assert.equal(formatQuantity(result).text,quantity.text);
  }
});
test('migration and locales preserve progress, translate numbers, and update shopping/copy amounts together',()=>{
  const r=recipe();
  r.translations=Object.fromEntries(['en','es','cs'].map(locale=>[locale,{ingredients:[{id:'paprika',name:locale==='cs'?'Sladká paprika':locale==='es'?'Pimentón dulce':'Sweet paprika',quantity:{text:'15 ml'}}]}]));
  const session={record:{recipe:r,assets:{}},completed:['step'],preparedIngredients:['step:0'],timers:[{instanceId:'keep'}]};
  const migrated=metricSnapshot(session);
  assert.deepEqual(migrated.completed,session.completed);assert.deepEqual(migrated.timers,session.timers);assert.deepEqual(migrated.preparedIngredients,session.preparedIngredients);
  try{
    for(const locale of ['en','es','cs']){
      setLocale(locale);const localized=localizeRecipe(migrated.record.recipe,locale);
      const expected=locale==='en'?'2 tbsp (≈ 13.8 g)':'2 tbsp (≈ 13,8 g)';
      assert.equal(formatQuantity(localized.ingredients[0].quantity,2).text,expected);
      assert.equal(shoppingQuantity(localized.ingredients[0],2).text,expected);
      assert.ok(shoppingText(createShoppingList(migrated.record.recipe,r.yield.quantity*2)).includes(expected));
    }
  }finally{setLocale('en');}
});
test('import/export retains sourced spice metadata; invalid metadata is rejected',async()=>{
  const record=await importPackage(new File([JSON.stringify(recipe())],'recipe.json'));
  const archive=await exportRecipes([record],true),[restored]=await importRecipes(new File([archive],'recipes.zip'));
  assert.equal(formatQuantity(restored.recipe.ingredients[0].quantity).text,'1 tbsp (≈ 6.9 g)');
  const invalid=metricRecipe(recipe());invalid.ingredients[0].quantity.spiceMeasure.gramsPerUnit=0;
  assert.ok(validateRecipe(invalid).some(e=>e.includes('spiceMeasure')));
});
