import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createSession} from '../../src/model.js';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
delete sample.translations;
const next={...structuredClone(sample),id:'next-dinner',title:'Next dinner'};
async function stored(page,store='sessions',id='active'){
  return page.evaluate(async({store,id})=>{const db=await new Promise(resolve=>{const r=indexedDB.open('cookstep',3);r.onsuccess=()=>resolve(r.result);});const value=await new Promise(resolve=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);});db.close();return value;},{store,id});
}
async function seed(page){
  const record={id:sample.id,recipe:sample,assets:{}},session=createSession(record,2);
  session.completed=[sample.steps[0].id];session.preparedIngredients=['saved-prep'];
  session.timers=[{instanceId:'old-timer',label:'Old simmer',mode:'countdown',durationSeconds:3600,startedAt:Date.now(),task:'main'}];
  await page.goto('/guide/index.html');
  await page.evaluate(async({record,next,session})=>{
    localStorage.setItem('cookstep.locale','en');
    const db=await new Promise(resolve=>{const r=indexedDB.open('cookstep',3);r.onupgradeneeded=()=>{for(const name of ['recipes','sessions','shopping','sync'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);});
    await new Promise((resolve,reject)=>{const tx=db.transaction(['recipes','sessions','shopping'],'readwrite');tx.objectStore('recipes').put(record);tx.objectStore('recipes').put({id:next.id,recipe:next,assets:{}});tx.objectStore('sessions').put(session);tx.objectStore('shopping').put({id:record.id,recipe:record.recipe,target:2,checked:['pasta']});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  },{record,next,session});
  await page.goto('/');await expect(page.locator('.resume-banner')).toBeVisible();
  return session;
}
async function openNext(page){await page.locator(`[data-action="overview"][data-id="${next.id}"]`).click();}
test('library finish icon stays visible and touch-sized in all themes, and finishing requires confirmation',async({page})=>{
  await seed(page);const original=await stored(page);
  const finish=page.locator('.resume-banner').getByRole('button',{name:'Finish cooking',exact:true});
  for(const theme of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
    await page.locator('.settings-trigger').click();await page.getByRole('button',{name:'Theme',exact:true}).click();await page.locator(`input[name="theme"][value="${theme}"]`).check();await page.getByRole('button',{name:'Done',exact:true}).click();
    for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]){
      await page.setViewportSize(viewport);await expect(finish).toBeVisible();await expect(finish.locator('svg')).toBeVisible();
      const box=await finish.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/session-banner-phone.png'});
  await finish.click();await expect(page.getByRole('dialog')).toContainText('1 timer is still running');
  await page.getByRole('button',{name:'Keep cooking',exact:true}).click();expect(await stored(page)).toEqual(original);
  await finish.click();await page.locator('[data-action="confirm-finish"]').click();
  await expect(page.locator('.resume-banner')).toHaveCount(0);expect(await stored(page)).toBeUndefined();
  await page.reload();await expect(page.locator('.resume-banner')).toHaveCount(0);await expect(page.locator('.recipe-card')).toHaveCount(2);
});
test('switching meals preserves the old session on cancel and starts a clean persisted session at the selected yield on confirmation',async({page})=>{
  await seed(page);const original=await stored(page),shopping=await stored(page,'shopping',sample.id);
  await openNext(page);await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Resume current meal',exact:true})).toHaveCount(0);
  await page.locator('#target').fill('6');await page.locator('#target').dispatchEvent('change');
  await page.getByRole('button',{name:'Start cooking',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Start a new meal?');await expect(dialog).toContainText(sample.title);await expect(dialog).toContainText(next.title);await expect(dialog).toContainText('Running timers will stop');
  expect(await stored(page)).toEqual(original);await page.getByRole('button',{name:'Keep current meal',exact:true}).click();expect(await stored(page)).toEqual(original);
  await page.getByRole('button',{name:'Start cooking',exact:true}).click();await page.keyboard.press('Escape');expect(await stored(page)).toEqual(original);
  await page.getByRole('button',{name:'Start cooking',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/session-replacement-phone.png'});
  await page.getByRole('button',{name:'Finish & start new meal',exact:true}).click();
  await expect(page.locator('.cooking-top h1')).toHaveText(next.title);
  const replacement=await stored(page);expect(replacement.record.id).toBe(next.id);expect(replacement.target).toBe(6);expect(replacement.completed).toEqual([]);expect(replacement.preparedIngredients).toEqual([]);expect(replacement.timers).toEqual([]);
  expect(await stored(page,'shopping',sample.id)).toEqual(shopping);
  await page.reload();await expect(page.locator('.resume-banner')).toContainText(next.title);await page.getByRole('button',{name:'Resume cooking',exact:true}).click();await expect(page.locator('.cooking-top h1')).toHaveText(next.title);
});
test('the active recipe resumes its existing progress and timers without a replacement prompt',async({page})=>{
  await seed(page);const original=await stored(page);
  await page.locator(`[data-action="overview"][data-id="${sample.id}"]`).click();await page.getByRole('button',{name:'Resume current meal',exact:true}).click();
  await expect(page.locator('.cooking-top h1')).toHaveText(sample.title);await expect(page.getByRole('dialog')).not.toBeVisible();expect(await stored(page)).toEqual(original);
});
test('a failed replacement save retains the old meal and allows retrying the confirmation',async({page})=>{
  await seed(page);const original=await stored(page);await openNext(page);await page.getByRole('button',{name:'Start cooking',exact:true}).click();
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='sessions'&&window.failSessionWrites)throw new DOMException('Test storage full','QuotaExceededError');return put.apply(this,args);};window.failSessionWrites=true;});
  await page.getByRole('button',{name:'Finish & start new meal',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await stored(page)).toEqual(original);
  await page.evaluate(()=>window.failSessionWrites=false);await page.getByRole('button',{name:'Finish & start new meal',exact:true}).click();await expect(page.locator('.cooking-top h1')).toHaveText(next.title);expect((await stored(page)).record.id).toBe(next.id);
});
