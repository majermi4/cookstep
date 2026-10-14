import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{localizeRecipe,recipeText,validateTranslations}from'../src/recipe-locales.js';
import{validateRecipe,formatQuantity,createSession,startTimer}from'../src/model.js';
import{setLocale,getLocale,ui,t,translateMessage}from'../src/i18n.js';
import{shoppingText,createShoppingList,shoppingQuantity}from'../src/shopping.js';
const example=JSON.parse(await readFile(new URL('../examples/recipe.json',import.meta.url),'utf8'));
test('complete locales translate recipe prose without changing measurements, IDs, images or source quotations',()=>{
 const original=structuredClone(example),es=localizeRecipe(example,'es'),cs=localizeRecipe(example,'cs');
 assert.deepEqual(validateRecipe(example),[]);assert.equal(es.ingredients[0].name,'Pasta seca');assert.equal(cs.steps[0].title,'Připrav omáčku a těstoviny');
 for(const view of [es,cs]){assert.equal(view.id,original.id);assert.equal(view.yield.quantity,original.yield.quantity);assert.equal(view.ingredients[0].quantity.value,200);assert.equal(view.ingredients[0].quantity.unit,'g');assert.equal(view.steps[2].timers[0].durationSeconds,600);}
 assert.deepEqual(example,original);assert.equal(localizeRecipe(example,'cz').title,cs.title);
 const reordered=structuredClone(example);reordered.steps.reverse();assert.equal(localizeRecipe(reordered,'cs').steps[0].title,'Smíchej a podávej');
});
test('locale validation rejects incomplete locales, changed IDs and numeric overrides but accepts legacy manifests',()=>{
 const r=structuredClone(example);delete r.translations.cs;assert.ok(validateRecipe(r).some(e=>e.includes('translations.cs')));
 r.translations=structuredClone(example.translations);r.translations.es.ingredients[0].id='other';assert.ok(validateRecipe(r).some(e=>e.includes('canonical ID')));
 r.translations=structuredClone(example.translations);r.translations.cs.ingredients[0].quantity.value=400;assert.ok(validateRecipe(r).some(e=>e.includes('only translatable')));
 delete r.translations;assert.deepEqual(validateRecipe(r),[]);assert.equal(localizeRecipe(r,'cs'),r);
});
test('language switching leaves active sessions untouched, localizes shopping and uses locale numbers',()=>{
 const s=createSession({id:example.id,recipe:example,assets:{}},4,'metric');s.timers.push(startTimer(s,example.steps[2].timers[0],example.steps[2],1000));const before=structuredClone(s);
 try{setLocale('cs');assert.equal(formatQuantity({text:'1 piece',value:1,unit:'piece'},1.5).text,'1,5 kus');assert.match(shoppingText(createShoppingList(example,4,'metric')),/Sušené těstoviny — 400 g/);assert.match(shoppingQuantity({quantity:{text:'1 egg',value:1,unit:'piece'}},.5,'metric').notes.join(),/Kup alespoň 1 kus/);setLocale('es');assert.equal(localizeRecipe(s.record.recipe,getLocale()).title,'Pasta sencilla con tomate');assert.deepEqual(s,before);}finally{setLocale('en');}
});
test('UI templates translate authored HTML and accessible labels while keeping interpolated user text intact',()=>{
 try{setLocale('es');const user='Next <script>';assert.equal(ui`<button aria-label="Open ${user}">Next</button>`,'<button aria-label="Abrir Next <script>">Siguiente</button>');assert.equal(ui`${2} of ${5} steps done`,'Completados: 2 de 5 pasos');assert.equal(ui`\n`,'\n');assert.equal(translateMessage('Saved on this device · 2 changes waiting to upload'),'Guardado en este dispositivo · cambios pendientes de subir: 2');assert.equal(t('My recipes'),'Mis recetas');}finally{setLocale('en');}
});
