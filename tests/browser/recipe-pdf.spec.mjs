import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

const choose=async(page,locale)=>{await page.locator('.settings-trigger').click();await page.locator('[data-locale]').selectOption(locale);await page.locator('.modal-close').click();};
const exportPdf=async(page,path)=>{
  await page.locator('[data-action="recipe-options"]').click();
  const ready=page.waitForEvent('download');await page.locator('[data-action="export-recipe-pdf"]').click();
  const download=await ready;await download.saveAs(path);
  const bytes=await readFile(path);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.length).toBeGreaterThan(15000);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);return download;
};

test('PDF downloads in every locale at phone and desktop sizes without changing cooking state',async({page})=>{
  await mkdir('artifacts/pdf',{recursive:true});
  await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await page.locator('[data-action="start"]').click();await page.locator('[data-action="cooking-menu"]').click();await page.locator('#modal [data-action="library"]').click();await page.locator('.card-click').click();
  await page.locator('#target').fill('4');await page.locator('#target').dispatchEvent('change');
  const snapshot=()=>page.evaluate(async()=>{const {read}=await import('/storage.js');return {recipes:await read('recipes'),session:await read('sessions','active')};});
  const before=await snapshot();
  for(const [locale,label] of [['en','Export recipe PDF'],['es','Exportar receta en PDF'],['cs','Exportovat recept do PDF']]){
    await choose(page,locale);
    for(const width of [390,1360]){
      await page.setViewportSize({width,height:900});await page.locator('[data-action="recipe-options"]').click();
      await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();await expect(page.locator('[data-action="export-recipe"]')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(width===390)await page.screenshot({path:`artifacts/pdf/menu-${locale}.png`});
      await page.locator('.modal-close').click();await exportPdf(page,`artifacts/pdf/recipe-${locale}-${width}.pdf`);
      await expect(page.locator('#target')).toHaveValue('4');expect(await snapshot()).toEqual(before);
    }
  }
});

test('PDF includes photos and long recipes paginate, including a long source URL',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();delete recipe.translations;
    recipe.title='Kuřecí paprikáš · Příprava a vaření';recipe.language='cs';
    recipe.ingredients[0].name='Žluté těstoviny';recipe.ingredients[0].notes='Uchovávejte v suchu.';
    recipe.steps[0].instruction=Array(45).fill('Připrav všechny suroviny, promíchej omáčku a vař na mírném ohni.').join('\n');
    recipe.notes=['Podávej horké.'];recipe.sources=[{id:'web',title:'Původní recept',author:'Test kitchen',url:'https://example.com/'+('recipe-'.repeat(65))}];
    recipe.images=[{id:'cover',path:'images/cover.png',caption:'Čerstvě uvařené jídlo'}];recipe.coverImageId='cover';
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1200;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#d7bb85';ctx.fillRect(0,0,1800,1200);ctx.fillStyle='#718267';ctx.fillRect(100,100,1600,1000);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets:{cover:blob}});
  });
  await page.reload();await page.locator('.card-click').click();await choose(page,'cs');
  await exportPdf(page,'artifacts/pdf/long-recipe-cs.pdf');
});

test('cover and step photos retain original pixels, aspect ratios and recipe placement',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();delete recipe.translations;delete recipe.components;
    recipe.title='Illustrated recipe';recipe.steps=recipe.steps.slice(0,2).map((step,index)=>({...step,componentId:undefined,suggestedComponentIds:undefined,imageIds:[index?'portrait':'landscape']}));
    recipe.coverImageId='cover';const assets={};recipe.images=[];
    for(const [id,w,h,type,color] of [['cover',1800,1200,'image/jpeg','#935c36'],['landscape',2000,1000,'image/png','#55806a'],['portrait',800,1200,'image/webp','#627b99']]){
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
      ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w/4,h/4);
      assets[id]=await new Promise(resolve=>canvas.toBlob(resolve,type));recipe.images.push({id,path:`images/${id}.${type.split('/')[1]}`,caption:`${id} original picture`});
    }
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets});
  });
  await page.reload();await page.locator('.card-click').click();await exportPdf(page,'artifacts/pdf/original-images.pdf');
  const pdf=(await readFile('artifacts/pdf/original-images.pdf')).toString('latin1');
  const dimensions=[...pdf.matchAll(/\/Subtype \/Image\s*\/Width (\d+)\s*\/Height (\d+)/g)].map(match=>[Number(match[1]),Number(match[2])]);
  expect(dimensions).toEqual([[1800,1200],[2000,1000],[800,1200]]);
  expect(pdf).not.toContain('/Creator (Cookstep)');
});

test('ingredient cells have equal padding and step cards have distinct numbered headers',async({page})=>{
  await page.goto('/');
  const drawing=await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();
    recipe.ingredients[0].notes='Keep dry. Store in a sealed container.';
    recipe.ingredients.push(...Array.from({length:30},(_,index)=>({id:`extra-${index}`,name:`Extra ingredient ${index+1}`,quantity:{text:'150 g',value:150,unit:'g'},notes:index%2?'Keep covered and chilled.':undefined})));
    await import('/vendor/jspdf.js');const {createRecipePdf}=await import('/recipe-pdf.js');
    const Original=globalThis.jspdf.jsPDF,texts=[],rects=[],cards=[];
    globalThis.jspdf.jsPDF=function(...args){
      const doc=new Original(...args),text=doc.text.bind(doc),rect=doc.rect.bind(doc),roundedRect=doc.roundedRect.bind(doc);
      doc.text=(value,x,y,options)=>{texts.push({value,x,y,options,page:doc.internal.getCurrentPageInfo().pageNumber});return text(value,x,y,options);};
      doc.rect=(x,y,w,h,...rest)=>{rects.push({x,y,w,h,page:doc.internal.getCurrentPageInfo().pageNumber});return rect(x,y,w,h,...rest);};
      doc.roundedRect=(x,y,w,h,...rest)=>{cards.push({x,y,w,h,page:doc.internal.getCurrentPageInfo().pageNumber});return roundedRect(x,y,w,h,...rest);};
      return doc;
    };
    try{await createRecipePdf({recipe,assets:{}});return {texts,rects,cards,steps:recipe.steps.length};}
    finally{globalThis.jspdf.jsPDF=Original;}
  });
  const name=drawing.texts.find(t=>t.value==='Dried pasta'),amount=drawing.texts.find(t=>t.value==='200 g');
  const row=drawing.rects.find(r=>r.page===name.page&&r.w===174&&r.y<name.y&&r.y+r.h>name.y);
  expect(name.y).toBe(amount.y);expect(name.options.baseline).toBe('middle');expect(amount.options.baseline).toBe('middle');
  expect(name.x-row.x).toBe(6);expect(row.x+row.w-amount.x).toBe(6);
  expect(name.y-row.y).toBeCloseTo(5.65,2);
  const note=drawing.texts.find(t=>String(t.value).startsWith('Keep dry.'));
  expect(note.page).toBe(row.page);expect(note.y).toBeGreaterThan(name.y);expect(row.y+row.h-note.y).toBeGreaterThanOrEqual(5);
  expect(drawing.texts.filter(t=>t.value==='Ingredient').length).toBeGreaterThanOrEqual(2);expect(drawing.texts.some(t=>t.value==='Amount')).toBe(true);
  expect(drawing.cards.filter(card=>card.w===9&&card.h===9)).toHaveLength(drawing.steps);
  const number=drawing.texts.find(t=>t.value==='1'),title=drawing.texts.find(t=>t.value==='Prepare sauce and pasta');
  expect(title.options.baseline).toBe('middle');expect(title.y).toBeCloseTo(number.y,3);
});

test('step ingredient checkboxes and right-aligned amounts work beside images and at full width',async({page})=>{
  await page.goto('/');
  const layouts=await page.evaluate(async()=>{
    const sample=await (await fetch('/examples/recipe.json')).json();
    await import('/vendor/jspdf.js');const {createRecipePdf}=await import('/recipe-pdf.js'),Original=globalThis.jspdf.jsPDF;
    const layouts=[];
    for(const columns of [false,true]){
      const recipe=structuredClone(sample),assets={};delete recipe.translations;delete recipe.components;
      recipe.ingredients[0].name='A long descriptive ingredient name that wraps clearly onto more than one line';
      recipe.steps=[{id:'prepare',title:'Prepare ingredients',instruction:'Gather these ingredients.',ingredientUses:[{ingredientId:'pasta',quantity:{text:'200 g',value:200,unit:'g'}},{ingredientId:'salt',quantity:{text:'a pinch'}}]}];
      if(columns){
        const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;canvas.getContext('2d').fillRect(0,0,200,100);
        assets.photo=await new Promise(resolve=>canvas.toBlob(resolve));recipe.images=[{id:'photo',path:'images/photo.png'}];recipe.steps[0].imageIds=['photo'];
      }
      let inStep=false;const texts=[],checks=[];
      globalThis.jspdf.jsPDF=function(...args){
        const doc=new Original(...args),text=doc.text.bind(doc),rect=doc.rect.bind(doc),roundedRect=doc.roundedRect.bind(doc);
        doc.roundedRect=(x,y,w,h,...rest)=>{if(w===9&&h===9)inStep=true;return roundedRect(x,y,w,h,...rest);};
        doc.rect=(x,y,w,h,...rest)=>{if(inStep&&w===3.2&&h===3.2)checks.push({x,y});return rect(x,y,w,h,...rest);};
        doc.text=(value,x,y,options)=>{if(inStep)texts.push({value,x,y,width:doc.getTextWidth(String(value)),options});return text(value,x,y,options);};
        return doc;
      };
      try{await createRecipePdf({recipe,assets},4);layouts.push({columns,texts,checks});}
      finally{globalThis.jspdf.jsPDF=Original;}
    }
    return layouts;
  });
  for(const layout of layouts){
    expect(layout.checks).toHaveLength(2);
    const name=layout.texts.find(text=>text.x===31),amount=layout.texts.find(text=>text.value==='400 g');
    expect(amount.x).toBe(layout.columns?110:186);expect(amount.options.align).toBe('right');
    expect(amount.y).toBe(name.y);expect(name.options.baseline).toBe('middle');
    expect(layout.checks[0].y+1.6).toBeCloseTo(name.y,3);
    expect(name.x+name.width).toBeLessThanOrEqual(amount.x-amount.width-2);
    if(layout.columns)expect(layout.texts.filter(text=>text.x===31).length).toBeGreaterThan(2);
  }
});

test.describe('Export errors',()=>{
test.use({serviceWorkers:'block'});
test('failed font loading reports an error and allows retry',async({page})=>{
  await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await page.route('**/fonts/typeface-5.ttf',route=>route.abort());
  await page.locator('[data-action="recipe-options"]').click();await page.locator('[data-action="export-recipe-pdf"]').click();
  await expect(page.locator('#modal h2')).toHaveText('Couldn’t export PDF');await page.locator('.modal-close').click();
  await page.unroute('**/fonts/typeface-5.ttf');await exportPdf(page,'artifacts/pdf/retry.pdf');
});
test('a missing or broken recipe photo blocks export with a useful error',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();recipe.coverImageId='missing';
    recipe.images=[{id:'missing',path:'images/missing.png'}];
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets:{}});
  });
  await page.reload();await page.locator('.card-click').click();
  await page.locator('[data-action="recipe-options"]').click();await page.locator('[data-action="export-recipe-pdf"]').click();
  await expect(page.locator('#modal h2')).toHaveText('Couldn’t export PDF');
  await expect(page.locator('#modal')).toContainText('A recipe image could not be loaded. Sync your recipes and try again.');
});
});

test('PDF downloads offline once the installed app has cached its tools',async({page,context})=>{
  await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await expect(page.locator('[data-action="recipe-options"]')).toBeVisible();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.locator('.card-click').click();
  await context.setOffline(true);
  await exportPdf(page,'artifacts/pdf/offline.pdf');
  await context.setOffline(false);
});
