import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';

const ingredients=[
  {id:'carrot',name:'Mrkev',quantity:{text:'1 velká',value:1,unit:'piece'}},
  {id:'parsley-root',name:'Kořen petržele',quantity:{text:'1 střední',value:1,unit:'piece'}},
  {id:'celeriac',name:'Bulvový celer',quantity:{text:'100 g',value:100,unit:'g'}},
  {id:'stock',name:'Vlažná voda nebo zeleninový vývar',quantity:{text:'800 ml',value:800,unit:'ml'}},
];
const uses=ingredients.map(i=>({ingredientId:i.id,...(i.id==='stock'?{}:{quantity:i.quantity})}));
const recipe={formatVersion:'0.2',id:'ingredient-layout',title:'Ingredient layout',language:'cs',yield:{quantity:4,unit:'porce'},ingredients,
  images:[{id:'prep-photo',path:'images/layout.png',alt:'Layout test image',kind:'illustration',origin:'user_supplied'}],
  steps:[
    {id:'prep',title:'Připrav zeleninu',instruction:'Oloupej a nakrájej zeleninu.',ingredientUses:uses,imageIds:['prep-photo']},
    {id:'cook',title:'Vař zeleninu',instruction:'Přidej připravenou zeleninu.',ingredientUses:uses,imageIds:['prep-photo'],timers:[{id:'simmer',label:'Vaření',mode:'countdown',durationSeconds:300,startLabel:'Zelenina se vaří'}]},
  ]};

async function seed(page){
  await page.goto('/guide/index.html');
  await page.evaluate(async recipe=>{
    localStorage.setItem('cookstep.locale','cs');localStorage.setItem('cookstep.theme','kitchen-appliance');
    const {write}=await import('/storage.js'),{createSession}=await import('/model.js');
    const record={id:recipe.id,recipe,assets:{'prep-photo':await(await fetch('/icons/icon-192.png')).blob()}};
    await write('recipes',record);await write('sessions',createSession(record,8));
  },recipe);
  await page.goto('/');await page.locator('[data-action="resume"]').click();await page.evaluate(()=>document.fonts.ready);
}

test('ingredient names and missing-amount messages stay readable in every theme and narrow desktop column',async({page})=>{
  await seed(page);
  for(const theme of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
    await page.locator('.settings-trigger').click();await page.locator('[data-action="theme-settings"]').click();
    await page.locator(`input[name="theme"][value="${theme}"]`).check();await page.locator('.modal-close').click();
    for(const step of ['prep','cook']){
      await page.locator(`.step-track [data-index="${step==='prep'?0:1}"]`).click();
      for(const width of [320,390,600,760,768,900,1000,1100,1280,1440]){
        await page.setViewportSize({width,height:900});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const rows=await page.locator('.ingredient-check').evaluateAll(rows=>rows.map(row=>{
          const name=row.querySelector('.ingredient-name'),amount=row.querySelector('.amount'),input=row.querySelector('input');
          const n=name.getBoundingClientRect(),a=amount.getBoundingClientRect(),r=row.getBoundingClientRect();
          const text=document.createRange();text.selectNodeContents(name);
          return {nameWidth:n.width,lines:new Set([...text.getClientRects()].map(rect=>Math.round(rect.top))).size,rowHeight:r.height,
            nameBottom:n.bottom,amountBottom:a.bottom,rowBottom:r.bottom,amountRight:a.right,rowRight:r.right,checkboxWidth:input.getBoundingClientRect().width};
        }));
        for(const [index,row] of rows.entries()){
          const context=`${theme}, ${step}, ${width}px, ${ingredients[index].name}`;
          expect(row.nameWidth,context).toBeGreaterThanOrEqual(100);
          expect(row.lines,context).toBeLessThanOrEqual(index===0?1:3);
          expect(Math.max(row.nameBottom,row.amountBottom),context).toBeLessThanOrEqual(row.rowBottom+1);
          expect(row.amountRight,context).toBeLessThanOrEqual(row.rowRight+1);
          expect(row.checkboxWidth,context).toBeGreaterThanOrEqual(32);
        }
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
  }
  // Divided or unspecified uses must never inherit the shopping total.
  await expect(page.locator('.ingredient-check').nth(2).locator('.amount')).toContainText('200 g');
  await expect(page.locator('.ingredient-check').nth(3).locator('.amount')).toHaveText('Množství pro tento krok není uvedeno');
  await expect(page.locator('.ingredient-check').nth(3).locator('.amount')).not.toContainText('800');
  await expect(page.locator('.timer-card')).toHaveCount(0);
});
