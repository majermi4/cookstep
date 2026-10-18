import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
const choose=async(page,locale)=>{await page.locator('.settings-trigger').click();await page.locator('[data-locale]').selectOption(locale);await page.locator('.modal-close').click();};

test('recipe total time appears on import, saved cards and overview in every locale and theme',async({page})=>{
  await page.goto('/');await page.locator('[data-action="example"]').click();
  await expect(page.locator('.recipe-time')).toHaveText('Total time: ≈ 20 min–25 min');
  await page.locator('[data-action="save-import"]').click();
  await page.locator('[data-action="yield-plus"]').click();
  await expect(page.locator('.recipe-time')).toHaveText('Total time: ≈ 20 min–25 min');
  for(const theme of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
    await page.locator('.settings-trigger').click();await page.locator('[data-action="theme-settings"]').click();await page.locator(`input[name="theme"][value="${theme}"]`).check();await page.locator('[data-action="close-modal"]').last().click();
    for(const [locale,label] of [['en','Total time'],['es','Tiempo total'],['cs','Celkový čas']]){
      await choose(page,locale);
      for(const size of [{width:390,height:844},{width:1360,height:1000}]){
        await page.setViewportSize(size);
        await expect(page.locator('.recipe-time')).toHaveText(`${label}: ≈ 20 min–25 min`);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.locator('[data-action="library"]').first().click();
        await expect(page.locator('.recipe-card .recipe-time')).toHaveText(`${label}: ≈ 20 min–25 min`);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        if(theme==='recipe-studio')await page.screenshot({path:`artifacts/recipe-time-card-${locale}-${size.width}.png`});
        await page.locator('.card-click').click();
        if(theme==='recipe-studio')await page.screenshot({path:`artifacts/recipe-time-overview-${locale}-${size.width}.png`});
      }
    }
  }
  await page.reload();await page.locator('.card-click').click();
  await expect(page.locator('.recipe-time')).toHaveText('Celkový čas: ≈ 20 min–25 min');
});

test('legacy recipes show unknown time without inferring it from timers',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();delete recipe.totalTime;
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets:{},savedAt:Date.now()});
  });
  await page.reload();await expect(page.locator('.recipe-time')).toHaveText('Total time: Time not specified');
  await page.locator('.card-click').click();await expect(page.locator('.recipe-time')).toHaveText('Total time: Time not specified');
});
