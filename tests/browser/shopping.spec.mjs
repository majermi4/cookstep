import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
// Legacy fixtures exercise schema mutations independently of translated overlays.
delete sample.translations;
const row=(page,id)=>page.locator(`.shopping-item:has([data-shopping-check="${id}"])`);
const check=(page,id)=>page.locator(`[data-shopping-check="${id}"]`);
async function save(page,recipe=sample){
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await page.locator('[data-action="save-import"], [data-action="save-replace"]').click();
  await page.getByRole('button',{name:'Shopping list',exact:true}).click();
}
async function settings(page){if(!await page.locator('.shopping-settings-panel').evaluate(el=>el.open))await page.locator('.shopping-settings-panel summary').click();}
async function amount(page,value){await settings(page);await page.locator('#shopping-target').fill(String(value));await page.locator('#shopping-target').press('Tab');}

test('scaled shopping checklist persists, filters, resets and stays independent from cooking',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await save(page);await amount(page,4);
  await expect(row(page,'pasta').locator('.amount>strong')).toHaveText('400 g');
  await expect(row(page,'tomatoes').locator('.amount>strong')).toHaveText('800 g');
  await expect(row(page,'salt')).toContainText('Not scaled');
  await check(page,'pasta').check();await expect(page.locator('#shopping-status')).toContainText('1 of 4');
  await expect(page.locator('#shopping-units')).toHaveCount(0);await expect(check(page,'pasta')).toBeChecked();
  await page.getByRole('button',{name:'Copy list',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('[x] Dried pasta');
  await page.reload();await page.getByRole('button',{name:/Simple tomato pasta.*4 servings.*1\/4 essentials/}).click();
  await expect(check(page,'pasta')).toBeChecked();await expect(page.locator('#shopping-target')).toHaveValue('4');
  await page.getByRole('button',{name:'Show remaining',exact:true}).click();await expect(row(page,'pasta')).toHaveCount(0);
  await check(page,'tomatoes').check();await expect(row(page,'tomatoes')).toHaveCount(0);
  await page.getByRole('button',{name:'Show all items',exact:true}).click();await expect(check(page,'tomatoes')).toBeChecked();
  await page.getByRole('button',{name:'Reset checks',exact:true}).click();await expect(page.locator('#shopping-status')).toContainText('0 of 4');
  await check(page,'pasta').check();await amount(page,6);await expect(check(page,'pasta')).not.toBeChecked();
  await check(page,'pasta').check();await page.getByRole('button',{name:'Back to recipe',exact:true}).click();
  await expect(page.locator('#target')).toHaveValue('6');await page.getByRole('button',{name:'Start cooking',exact:true}).click();
  await page.locator('.task-button[data-id="pasta"]').click();
  await expect(page.locator('[data-ingredient-check]')).toHaveCount(1);
  await expect(page.locator('[data-ingredient-check]:checked')).toHaveCount(0);
  await page.getByRole('button',{name:'Cooking options',exact:true}).click();await page.getByRole('button',{name:'My recipes',exact:true}).click();
  await page.locator('[data-action="resume-shopping"]').click();await expect(check(page,'pasta')).toBeChecked();
  await page.getByRole('button',{name:'Remove list',exact:true}).click();await expect(page.locator('.saved-shopping')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Resume cooking',exact:true})).toBeVisible();
});

test('people and item yields retain sizes, optional progress and updated recipe quantities',async({page})=>{
  const recipe={...structuredClone(sample),yield:{quantity:20,unit:'quesadillas'},servings:10};
  recipe.ingredients.push({id:'tortillas',name:'Tortillas',quantity:{text:'20 tortillas, 20 cm diameter',value:20,unit:'pieces'},notes:'20 cm diameter'},
    {id:'garnish',name:'Coriander',quantity:{text:'1–2 bunches',range:{min:1,max:2},unit:'bunches'},optional:true});
  await save(page,recipe);await amount(page,3);
  await expect(row(page,'pasta').locator('.amount>strong')).toHaveText('60 g');
  await expect(row(page,'tortillas')).toContainText('6 pieces');await expect(row(page,'tortillas')).toContainText('20 cm diameter');
  await expect(row(page,'garnish')).toContainText('Buy at least 1 bunches');
  await check(page,'garnish').check();await expect(page.locator('#shopping-status')).toContainText('0 of 5 essentials checked · 1 optional');
  await page.locator('#shopping-mode').selectOption('yield');await expect(page.locator('#shopping-target')).toHaveValue('6');
  await check(page,'pasta').check();
  await page.getByRole('button',{name:'Back to recipe',exact:true}).click();
  recipe.ingredients[0].quantity={text:'300 g',value:300,unit:'g'};
  await page.locator('#file-input').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await page.locator('[data-action="save-replace"]').click();await page.getByRole('button',{name:'Shopping list',exact:true}).click();
  await expect(check(page,'pasta')).not.toBeChecked();await expect(row(page,'pasta').locator('.amount>strong')).toHaveText('300 g');
});

test('shopping remains usable across themes on phone and tablet and does not invent people per item yield',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await save(page,{...sample,servings:undefined,yield:{quantity:20,unit:'quesadillas'}});
  await expect(page.locator('#shopping-mode option[value="people"]')).toHaveCount(0);
  await settings(page);await expect(page.locator('.shopping-settings')).toContainText('People per recipe are not specified');
  await page.locator('.shopping-settings-panel summary').click();
  for(const theme of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
    await page.getByRole('button',{name:'Theme',exact:true}).click();await page.locator(`input[name="theme"][value="${theme}"]`).check();await page.getByRole('button',{name:'Done',exact:true}).click();
    for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768}]){
      await page.setViewportSize(viewport);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const box=await row(page,'pasta').boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:`artifacts/shopping-${theme}-phone.png`,fullPage:false});
  }
  expect(errors).toEqual([]);
});

test('version 2 storage upgrades preserve recipes and active cooking sessions',async({page})=>{
  await page.goto('/guide/index.html');
  await page.evaluate(async recipe=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cookstep',2);r.onupgradeneeded=()=>{for(const name of ['recipes','sessions','sync'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const t=db.transaction(['recipes','sessions'],'readwrite');const record={id:recipe.id,recipe,assets:{}};t.objectStore('recipes').put(record);t.objectStore('sessions').put({id:'active',record,target:2,units:'original',activeTask:'main',opened:['main'],positions:{main:0},completed:[],preparedIngredients:[],timers:[],startedAt:Date.now()});t.oncomplete=resolve;t.onerror=()=>reject(t.error);});db.close();
  },sample);
  await page.goto('/');await expect(page.getByRole('button',{name:'Resume cooking',exact:true})).toBeVisible();
  await page.locator('.card-click').click();await page.getByRole('button',{name:'Shopping list',exact:true}).click();await check(page,'pasta').check();
  await page.reload();await expect(page.locator('.saved-shopping')).toContainText('1/4 essentials');
  await expect(page.getByRole('button',{name:'Resume cooking',exact:true})).toBeVisible();
});
