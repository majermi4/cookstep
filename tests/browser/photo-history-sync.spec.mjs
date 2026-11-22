import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64');
async function synced(page){await page.locator('.settings-trigger').click();await expect(page.locator('.sync-control')).toHaveAttribute('data-state','synced',{timeout:20000});await page.locator('.modal-close').click();}
test('history photos and deletions sync to an independent device',async({browser})=>{
  const aContext=await browser.newContext(),bContext=await browser.newContext({viewport:{width:390,height:844}}),a=await aContext.newPage(),b=await bContext.newPage();
  const recipe={...sample,id:crypto.randomUUID(),title:'Photo sync '+crypto.randomUUID()};
  await a.goto('/signin-with-chatgpt?return_to=%2F');await synced(a);
  await a.locator('#file-input').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});await a.locator('[data-action="save-import"]').click();await synced(a);
  await a.locator('[data-action="history-add"]').click();await a.locator('#history-file').setInputFiles({name:'meal.png',mimeType:'image/png',buffer:png});await a.locator('#history-date').fill('2020-05-06');await a.locator('#history-note').fill('Shared dinner');await a.locator('#history-form button[type=submit]').click();await expect(a.locator('.history-open')).toHaveCount(1);await synced(a);
  await b.goto('/signin-with-chatgpt?return_to=%2F');await synced(b);await b.locator(`.card-click[data-id="${recipe.id}"]`).click();await b.locator('[data-action="history-view"]').click();await expect(b.locator('.history-details')).toContainText('Shared dinner');await expect(b.locator('.history-open img')).toHaveJSProperty('naturalWidth',1);
  await b.locator('[data-action="history-options"]').click();await b.locator('[data-action="history-delete"]').click();await b.locator('[data-action="history-confirm-delete"]').click();await synced(b);await a.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>a.evaluate(async id=>{const {read}=await import('/storage.js');return (await read('recipes',id))?.recipe.cookingHistory?.length;},recipe.id)).toBe(0);
  await a.getByRole('button',{name:'Cookstep home',exact:true}).click();await a.locator(`[data-action="delete"][data-id="${recipe.id}"]`).click();await a.locator('[data-action="confirm-delete"]').click();await synced(a);await aContext.close();await bContext.close();
});
