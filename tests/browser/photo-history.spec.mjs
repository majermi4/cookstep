import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64');
test('phone gallery adds, edits and removes photos while retaining a queued local change',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await page.locator('[data-action="history-add"]').click();await page.locator('#history-file').setInputFiles([{name:'one.png',mimeType:'image/png',buffer:png},{name:'two.png',mimeType:'image/png',buffer:png}]);
  await expect(page.locator('#history-form')).toBeVisible();await page.locator('#history-date').fill('2023-04-12');await page.locator('#history-note').fill('Family dinner');await page.locator('#history-form button[type=submit]').click();
  await expect(page.locator('.history-open')).toHaveCount(2);await expect(page.locator('.history-meta')).toContainText('Family dinner');
  await page.locator('[data-action="history-options"]').click();await page.locator('[data-action="history-edit"]').click();await page.locator('#history-date').fill('2023-04-13');await page.locator('#history-note').fill('Edited');await page.locator('#history-form button[type=submit]').click();await expect(page.locator('.history-meta')).toContainText('Apr 13, 2023');
  await page.locator('[data-action="history-options"]').click();await page.locator('[data-action="history-add"]').last().click();await page.locator('#history-file').setInputFiles({name:'three.png',mimeType:'image/png',buffer:png});await page.locator('#history-form button[type=submit]').click();await expect(page.locator('.history-open')).toHaveCount(3);
  await page.locator('[data-action="history-view"]').first().click();await page.locator('[data-action="history-remove-photo"]').click();await page.locator('[data-action="history-confirm-delete"]').click();await expect(page.locator('.history-open')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await page.locator('.card-click').first().click();await expect(page.locator('.history-meta')).toContainText('Edited');
  await page.locator('[data-action="history-options"]').click();await page.locator('[data-action="history-delete"]').click();await page.locator('[data-action="history-confirm-delete"]').click();await expect(page.locator('.history-open')).toHaveCount(0);
  expect(await page.evaluate(async()=>{const {read}=await import('/storage.js');return (await read('sync')).length;})).toBeGreaterThan(0);
});
