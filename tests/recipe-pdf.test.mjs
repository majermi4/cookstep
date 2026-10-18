import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recipePdfContent,recipePdfFilename} from '../src/recipe-pdf.js';
import {setLocale} from '../src/i18n.js';
import {localizeRecipe} from '../src/recipe-locales.js';

const example=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));
test('PDF content scales ingredients and step uses while retaining all tasks and timing',()=>{
  setLocale('en');const recipe=structuredClone(example);
  recipe.notes=['Keep leftovers chilled.'];recipe.steps[0].completionCue='Both pans are ready.';recipe.steps[0].notes=['Use separate pans.'];
  recipe.sources=[{id:'source',title:'Original recipe',author:'Cook',url:'https://example.com/recipe'}];recipe.steps[0].sourceIds=['source'];
  const before=structuredClone(recipe),content=recipePdfContent({recipe},4);
  assert.equal(content.ingredients[0].items[0].amount,'400 g');
  assert.match(content.facts,/4 servings.*20 min–25 min/);
  assert.equal(content.tasks.flatMap(g=>g.steps).length,recipe.steps.length);
  const pasta=content.tasks.flatMap(task=>task.steps).flatMap(step=>step.ingredients).find(ingredient=>ingredient.name==='Dried pasta');
  assert.equal(pasta.amount,'400 g');
  assert.ok(content.tasks.flatMap(task=>task.steps).some(step=>step.ingredients.some(ingredient=>ingredient.name==='Salt'&&ingredient.amount.includes('Not scaled'))));
  assert.ok(content.tasks.flatMap(g=>g.steps.flatMap(s=>s.details)).some(d=>d.includes('10:00')));
  assert.ok(content.tasks[0].steps[0].details.includes('Ready when: Both pans are ready.'));
  assert.deepEqual(content.tasks[0].steps[0].notes,['Use separate pans.']);
  assert.deepEqual(content.notes,recipe.notes);assert.deepEqual(content.equipment,recipe.equipment);
  assert.equal(content.sources[0].url,recipe.sources[0].url);assert.deepEqual(recipe,before);
  assert.throws(()=>recipePdfContent({recipe},0),/Invalid recipe yield/);
});

test('PDF utensils and notes clean pasted formatting without altering quantities or saved prose',()=>{
  setLocale('en');const recipe=structuredClone(example);delete recipe.translations;
  recipe.equipment=['- **2 mixing bowls**','A 24 cm\n  ovenproof dish'];
  recipe.notes=['• Keep at **4 °C**.\nWrap tightly.\n\nFreeze for 3 months.','- Use `250 ml` milk.\n- Rest for 10 min.'];
  recipe.steps[0].notes=['  **Prepare ahead:**\nKeep chilled.  '];const before=structuredClone(recipe);
  const content=recipePdfContent({recipe});
  assert.deepEqual(content.equipment,['2 mixing bowls','A 24 cm ovenproof dish']);
  assert.deepEqual(content.notes,['Keep at 4 °C. Wrap tightly.','Freeze for 3 months.','Use 250 ml milk.','Rest for 10 min.']);
  assert.deepEqual(content.tasks[0].steps[0].notes,['Prepare ahead: Keep chilled.']);
  assert.deepEqual(recipe,before);
});

test('PDF text keeps Czech and Spanish overlays and their translated headings',()=>{
  for(const [locale,heading] of [['es','Ingredientes'],['cs','Suroviny']]){
    setLocale(locale);const recipe=localizeRecipe(example,locale),content=recipePdfContent({recipe:example});
    assert.equal(content.title,example.translations[locale].title);
    assert.equal(content.ingredients[0].items[0].name,example.translations[locale].ingredients[0].name);
    assert.equal(content.labels.Ingredients,heading);assert.equal(content.translationMissing,null);
  }
  setLocale('en');
});

test('PDF filenames are portable and source links only allow HTTP(S)',()=>{
  assert.equal(recipePdfFilename('Kuřecí / paprika: ¿qué?'),'Kureci-paprika-que.pdf');
  assert.equal(recipePdfFilename('...'),'recipe.pdf');
  const recipe={...example,sources:[{title:'Unsafe',url:'javascript:alert(1)'}]};
  assert.equal(recipePdfContent({recipe}).sources[0].url,null);
});
