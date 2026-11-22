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
  for(const width of [320,390,600]){
    await page.setViewportSize({width,height:844});
    const gallery=await page.locator('.cooking-history').boundingBox();
    const heading=await page.locator('.history-heading').boundingBox();
    const servings=await page.locator('.yield-panel h2').boundingBox();
    expect({left:gallery.x,right:gallery.x+gallery.width}).toEqual({left:0,right:width});
    expect({left:heading.x,right:heading.x+heading.width}).toEqual({left:servings.x,right:servings.x+servings.width});
  }
  await page.setViewportSize({width:390,height:844});
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

test('the gallery title and controls follow the selected language',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  const gallery=page.locator('.cooking-history');
  for(const [locale,title,add,empty] of [
    ['es','Fotos de cocina','Añadir fotos de cocina','Aquí van tus momentos alrededor de la mesa.'],
    ['cs','Fotky z vaření','Přidat fotky z vaření','Sem patří tvoje chvíle u společného stolu.'],
    ['en','Cooking photos','Add cooking photos','Your moments around the table belong here.']
  ]){
    await page.locator('.settings-trigger').click();
    await page.locator('[data-locale]').selectOption(locale);
    await page.locator('.modal-close').click();
    await expect(gallery.getByRole('heading')).toHaveText(title);
    await expect(gallery.getByRole('button',{name:add})).toHaveAttribute('title',add);
    await expect(gallery.locator('.history-empty')).toHaveText(empty);
  }
});
