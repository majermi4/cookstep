import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64');
const photo={name:'meal.png',mimeType:'image/png',buffer:png};
async function openOptions(page,index=0){await page.locator('[data-action="history-view"]').nth(index).click();await page.locator('[data-action="history-options"]').click();}
test('phone gallery combines occasions and keeps details and controls in the viewer',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  for(const [date,note] of [['2023-04-12','Family dinner'],['2024-05-14','Another meal']]){
    await page.locator('[data-action="history-add"]').click();await page.locator('#history-file').setInputFiles(photo);
    await page.locator('#history-date').fill(date);await page.locator('#history-note').fill(note);await page.locator('#history-form button[type=submit]').click();
  }
  await expect(page.locator('.history-photos')).toHaveCount(1);await expect(page.locator('.history-open')).toHaveCount(2);
  await expect(page.locator('.cooking-history')).not.toContainText('Family dinner');await expect(page.locator('.cooking-history')).not.toContainText('2024');
  await page.locator('[data-action="history-view"]').first().click();await expect(page.locator('.history-details')).toContainText('May 14, 2024');await expect(page.locator('.history-details')).toContainText('Another meal');
  await expect(page.locator('.history-count')).toHaveText('1 / 2');await expect(page.locator('[data-action="history-previous"]')).toHaveCount(0);
  await page.locator('[data-action="history-next"]').click();await expect(page.locator('.history-count')).toHaveText('2 / 2');await expect(page.locator('.history-details')).toContainText('Family dinner');await expect(page.locator('[data-action="history-next"]')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');await expect(page.locator('.history-details')).toContainText('Another meal');
  await page.locator('.history-stage').evaluate(el=>{const touch=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(300,200)]}));el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[touch(100,205)]}));});
  await expect(page.locator('.history-details')).toContainText('Family dinner');await page.keyboard.press('ArrowLeft');await expect(page.locator('.history-details')).toContainText('Another meal');
  await page.locator('[data-action="history-options"]').click();await page.locator('[data-action="history-edit"]').click();await page.locator('#history-note').fill('Edited');await page.locator('#history-form button[type=submit]').click();
  await openOptions(page);await page.locator('[data-action="history-add"]').last().click();await page.locator('#history-file').setInputFiles(photo);await page.locator('#history-form button[type=submit]').click();await expect(page.locator('.history-open')).toHaveCount(3);
  await openOptions(page);await page.locator('[data-action="history-remove-photo"]').click();await page.locator('[data-action="history-confirm-delete"]').click();await expect(page.locator('.history-open')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await page.locator('.card-click').first().click();await page.locator('[data-action="history-view"]').first().click();await expect(page.locator('.history-details')).toContainText('Edited');
  await page.locator('[data-action="history-options"]').click();await page.locator('[data-action="history-delete"]').click();await page.locator('[data-action="history-confirm-delete"]').click();await expect(page.locator('.history-open')).toHaveCount(1);
  expect(await page.evaluate(async()=>{const {read}=await import('/storage.js');return (await read('sync')).length;})).toBeGreaterThan(0);
});
