import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
test('old spice volumes display spoons and grams in overview, scaled shopping and active cooking on phone/tablet',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const recipe=structuredClone(sample);delete recipe.translations;
  recipe.ingredients.push({id:'paprika',name:'Sweet paprika',quantity:{text:'15 ml',value:15,unit:'ml'}});
  recipe.steps[0].ingredientUses=[{ingredientId:'paprika',quantity:{text:'5 ml',value:5,unit:'ml'}}];
  await page.goto('/guide/index.html');
  await page.evaluate(async recipe=>{
    localStorage.setItem('cookstep.locale','en');
    const db=await new Promise(resolve=>{const r=indexedDB.open('cookstep',3);r.onupgradeneeded=()=>{for(const name of ['recipes','sessions','shopping','sync'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);});
    await new Promise((resolve,reject)=>{const tx=db.transaction(['recipes','sessions','shopping'],'readwrite'),record={id:recipe.id,recipe,assets:{}};
      tx.objectStore('recipes').put(record);
      tx.objectStore('sessions').put({id:'active',record,target:2,activeTask:'main',opened:['main'],positions:{main:0},completed:[],preparedIngredients:[],timers:[{instanceId:'keep',mode:'elapsed',label:'Existing timer',startedAt:Date.now()}]});
      tx.objectStore('shopping').put({id:recipe.id,recipe,target:2,checked:['paprika']});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  },recipe);
  await page.goto('/');await page.locator('.card-click').click();
  const spice=page.locator('.ingredient-row').filter({hasText:'Sweet paprika'}).first();
  await expect(spice).toContainText('1 tbsp (≈ 6.9 g)');
  await page.locator('#target').fill('4');await page.locator('#target').dispatchEvent('change');
  await expect(spice).toContainText('2 tbsp (≈ 13.8 g)');
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:'Shopping list',exact:true}).click();
  const item=page.locator('.shopping-item').filter({hasText:'Sweet paprika'});
  await expect(item).toContainText('2 tbsp (≈ 13.8 g)');await expect(item).not.toContainText('ml');
  await page.screenshot({path:'artifacts/spice-measures-shopping.png',fullPage:false});
  await page.getByRole('button',{name:'Back to recipe',exact:true}).click();
  await page.getByRole('button',{name:'Resume current meal',exact:true}).click();
  await expect(page.locator('.step-ingredient-box')).toContainText('1 tsp (≈ 2.3 g)');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/spice-measures-cooking-phone.png',fullPage:false});
  await page.reload();await page.getByRole('button',{name:'Resume cooking',exact:true}).click();
  await expect(page.locator('.step-ingredient-box')).toContainText('1 tsp (≈ 2.3 g)');
  const stored=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('cookstep',3);r.onsuccess=()=>resolve(r.result);});const result=await new Promise(resolve=>{const r=db.transaction('sessions').objectStore('sessions').get('active');r.onsuccess=()=>resolve(r.result);});db.close();return result;});
  expect(stored.timers[0].instanceId).toBe('keep');expect(stored.record.recipe.ingredients.at(-1).quantity.spiceMeasure.unit).toBe('tbsp');
  expect(errors).toEqual([]);
});
