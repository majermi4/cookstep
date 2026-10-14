import './local-library-fixture.mjs';
import{test,expect}from'@playwright/test';
const choose=async(page,locale)=>{await page.locator('.settings-trigger').click();await page.locator('[data-locale]').selectOption(locale);await page.locator('.modal-close').click();};
const snapshot=page=>page.evaluate(async()=>{const{read}=await import('/storage.js');return{session:await read('sessions','active'),shopping:await read('shopping')};});
test('locale switches translate every view, preserve cooking and shopping state, and survive reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await choose(page,'es');await expect(page.locator('html')).toHaveAttribute('lang','es');await expect(page.locator('.settings-trigger')).toHaveAttribute('aria-label','Ajustes');
 await page.locator('[data-action="example"]').click();await expect(page.locator('h1')).toHaveText('Pasta sencilla con tomate');
 await choose(page,'cs');await expect(page.locator('h1')).toHaveText('Jednoduché těstoviny s rajčaty');await expect(page.locator('[data-action="save-import"]')).toHaveText('Uložit do mých receptů');
 await page.locator('[data-action="save-import"]').click();await page.locator('[data-action="shopping"]').click();
 await expect(page.locator('.shopping-heading h1')).toHaveText('Nákupní seznam');await expect(page.locator('.shopping-item').first()).toContainText('Sušené těstoviny');
 await page.locator('[data-shopping-check="pasta"]').check();const shoppingBefore=await snapshot(page);
 await choose(page,'es');await expect(page.locator('.shopping-heading h1')).toHaveText('Lista de compra');await expect(page.locator('[data-shopping-check="pasta"]')).toBeChecked();expect((await snapshot(page)).shopping).toEqual(shoppingBefore.shopping);
 await page.locator('[data-action="shopping-back"]').click();await page.locator('[data-action="start"]').click();await page.locator('.task-button[data-id="sauce"]').click();
 await page.locator('[data-action="start-timer"]').click();await page.locator('[data-ingredient-check]').first().check();const before=await snapshot(page);
 await choose(page,'cs');await expect(page.locator('.current-step h2')).toHaveText('Povař omáčku');await expect(page.locator('.timer-card-heading strong')).toHaveText('Rajčatová omáčka');await expect(page.locator('[data-action="previous"]')).toHaveText('Předchozí');
 expect((await snapshot(page)).session).toEqual(before.session);await expect(page.locator('[data-ingredient-check]').first()).toBeChecked();
 await choose(page,'en');await expect(page.locator('.current-step h2')).toHaveText('Simmer the sauce');expect((await snapshot(page)).session).toEqual(before.session);
 await choose(page,'cs');await page.reload();await expect(page.locator('[data-action="resume"]')).toContainText('Pokračovat ve vaření');await page.locator('[data-action="resume"]').click();await expect(page.locator('.timer-card-heading strong')).toHaveText('Rajčatová omáčka');
 expect((await snapshot(page)).session).toEqual(before.session);expect(errors).toEqual([]);
});
test('language controls and translated layouts fit every theme on phone and tablet',async({page})=>{
 await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
 for(const theme of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
  await page.locator('.settings-trigger').click();await page.locator('[data-action="theme-settings"]').click();await page.locator(`input[name="theme"][value="${theme}"]`).check();await page.locator('[data-action="close-modal"]').last().click();
  for(const locale of ['en','es','cs']){await choose(page,locale);for(const size of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768}]){await page.setViewportSize(size);await page.locator('.settings-trigger').click();await expect(page.locator('[data-locale]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(size.width===390)await page.screenshot({path:`artifacts/settings-${theme}-${locale}.png`});await page.locator('.modal-close').click();}}
 }
 await page.screenshot({path:'artifacts/localization/czech-tablet.png'});
});

test('task dialogs have no locale picker and settings remain reachable while cooking',async({page})=>{
 await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
 await page.locator('[data-action="recipe-options"]').click();await expect(page.locator('#modal [data-locale]')).toHaveCount(0);await expect(page.locator('[data-action="export-recipe"]')).toBeVisible();await page.locator('.modal-close').click();
 await page.locator('[data-action="start"]').click();await page.locator('.timer-panel summary').click();await page.locator('[data-action="manual"]').click();
 await expect(page.locator('#modal [data-locale]')).toHaveCount(0);await page.locator('#timer-name').fill('My custom rice');await page.locator('#timer-minutes').fill('9');await page.locator('#timer-batch').fill('Batch A');
 await page.locator('#manual-form [type="submit"]').click();await expect(page.locator('.timer-card-heading')).toContainText('My custom rice');const before=await snapshot(page);
 await choose(page,'es');await page.locator('[data-action="cooking-menu"]').click();await expect(page.locator('#modal h2')).toHaveText('Opciones de cocina');await expect(page.locator('#modal [data-locale]')).toHaveCount(0);expect((await snapshot(page)).session).toEqual(before.session);
});

test('cached translations also enrich matching older session and shopping snapshots on launch',async({page})=>{
 await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();await page.locator('[data-action="shopping"]').click();await page.locator('[data-shopping-check="pasta"]').check();await page.locator('[data-action="shopping-back"]').click();await page.locator('[data-action="start"]').click();
 const before=await page.evaluate(async()=>{const{read,write}=await import('/storage.js');const session=await read('sessions','active'),list=(await read('shopping'))[0];delete session.record.recipe.translations;delete list.recipe.translations;await write('sessions',session);await write('shopping',list);return {session,list};});
 await page.reload();await choose(page,'cs');await page.locator('[data-action="resume"]').click();await expect(page.locator('.current-step h2')).toHaveText('Připrav omáčku a těstoviny');const after=await snapshot(page);expect(after.session.completed).toEqual(before.session.completed);expect(after.session.positions).toEqual(before.session.positions);expect(after.session.timers).toEqual(before.session.timers);expect(after.shopping[0].checked).toEqual(before.list.checked);expect(Object.keys(after.session.record.recipe.translations)).toEqual(['en','es','cs']);
});
