import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const example=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
test('old stored measurements migrate durably in recipes, active cooking and shopping',async({page})=>{
  const recipe=structuredClone(example);delete recipe.translations;
  recipe.ingredients[0].quantity={text:'1 lb',value:1,unit:'lb'};
  recipe.steps[0].instruction='Cut into ½-inch pieces.';recipe.steps[0].temperature={value:350,unit:'F'};
  await page.goto('/guide/index.html');
  await page.evaluate(async recipe=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cookstep',3);r.onupgradeneeded=()=>{for(const name of ['recipes','sessions','shopping','sync'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction(['recipes','sessions','shopping'],'readwrite'),record={id:recipe.id,recipe,assets:{}};
      tx.objectStore('recipes').put(record);
      tx.objectStore('sessions').put({id:'active',record,units:'imperial',target:2,activeTask:'main',opened:['main'],positions:{main:0},completed:['boil-water'],preparedIngredients:[],timers:[{instanceId:'existing',templateId:'old',mode:'elapsed',label:'Existing timer',startedAt:Date.now()}]});
      tx.objectStore('shopping').put({id:recipe.id,recipe,units:'original',checked:['pasta'],target:2});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  },recipe);
  await page.goto('/');await page.locator('.card-click').click();
  await expect(page.locator('#units')).toHaveCount(0);await expect(page.locator('.ingredient-row').first()).toContainText('453.592 g');
  await page.screenshot({path:'artifacts/metric-only/overview.png',fullPage:false});
  await page.getByRole('button',{name:'Resume current meal',exact:true}).click();
  await expect(page.locator('.instruction')).toContainText('1.27 cm');await expect(page.locator('.temperature')).toContainText('176.67 °C');
  const stores=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('cookstep',3);r.onsuccess=()=>resolve(r.result);});const records={};for(const store of ['recipes','sessions','shopping'])records[store]=await new Promise(resolve=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);});db.close();return records;});
  expect(stores.recipes[0].recipe.ingredients[0].quantity.unit).toBe('g');expect(stores.sessions[0].units).toBeUndefined();expect(stores.sessions[0].timers[0].instanceId).toBe('existing');expect(stores.sessions[0].completed).toEqual(['boil-water']);expect(stores.shopping[0].units).toBeUndefined();expect(stores.shopping[0].checked).toEqual(['pasta']);
  await page.screenshot({path:'artifacts/metric-only/cooking.png',fullPage:false});
});
