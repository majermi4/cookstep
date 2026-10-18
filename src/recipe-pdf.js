import {t,getLocale} from './i18n.js';
import {localizeRecipe} from './recipe-locales.js';
import {formatQuantity,formatTemperature,formatTotalTime,number,taskSteps,clockText,safeUrl} from './model.js';

export function recipePdfFilename(title){
  return (title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,80)||'recipe')+'.pdf';
}

// Prepare all text before asynchronous font/image loading. Formatting matches
// the overview, including metric quantities and the spoon/gram spice pairs.
export function recipePdfContent(record,target=record.recipe.yield.quantity){
  const r=localizeRecipe(record.recipe,getLocale()),factor=target/r.yield.quantity;
  if(!Number.isFinite(factor)||factor<=0)throw new Error('Invalid recipe yield');
  const quantity=q=>{const v=formatQuantity(q,factor);return [v.text,v.note].filter(Boolean).join(' · ');};
  const groups=[{id:'main',title:t('Main guide')},...(r.components||[])];
  return {
    title:r.title,description:r.description,cover:r.coverImageId,language:getLocale(),
    facts:`${t('Recipe yield')}: ${number(target)} ${r.yield.unit}${r.servings&&record.recipe.yield.unit!=='servings'?` · ${number(r.servings*factor)} ${t('people')}`:''}  |  ${t('Total time')}: ${formatTotalTime(r)}`,
    scaling:factor!==1?t('Amounts scale. Cooking times stay the same.'):null,
    ingredients:[{title:r.components?.length?t('Main guide & shared ingredients'):t('Ingredients'),items:r.ingredients.filter(i=>!i.componentId)},...(r.components||[]).map(c=>({title:c.title,items:r.ingredients.filter(i=>i.componentId===c.id)}))].filter(g=>g.items.length).map(g=>({...g,items:g.items.map(i=>({name:i.name+(i.optional?` (${t('optional')})`:''),amount:quantity(i.quantity),notes:i.notes}))})),
    equipment:r.equipment||[],notes:r.notes||[],
    tasks:groups.map(g=>({...g,steps:taskSteps(r,g.id).map(s=>({
      title:s.title,instruction:s.instruction,
      details:[
        s.temperature?formatTemperature(s.temperature):null,
        ...(s.ingredientUses||[]).map(u=>`${r.ingredients.find(i=>i.id===u.ingredientId)?.name}: ${quantity(u.quantity)}`),
        ...(s.timers||[]).map(timer=>`${timer.label}: ${timer.mode==='elapsed'?t('Elapsed tracking'):clockText(timer.durationSeconds)} · ${t('Start: {0}',[timer.startLabel])}`),
        s.completionCue?t('Ready when: {0}',[s.completionCue]):null,
        ...(s.notes||[]),
        s.suggestedComponentIds?.length?t('Suggested tasks: {0}',[s.suggestedComponentIds.map(id=>r.components.find(c=>c.id===id)?.title).join(', ')]):null,
        s.sourceIds?.length?t('Sources: {0}',[s.sourceIds.map(id=>r.sources.find(source=>source.id===id)?.title).join(', ')]):null,
      ].filter(Boolean),images:s.imageIds||[],
    }))})).filter(g=>g.steps.length),
    sources:(r.sources||[]).map(s=>({title:s.title,author:s.author,url:safeUrl(s.url)?s.url:null})),
    images:r.images||[],
    labels:Object.fromEntries(['Ingredients','Equipment','Method','Recipe notes','Sources','Page','of'].map(key=>[key,t(key)])),
    translationMissing:!r.translations?.[getLocale()]&&getLocale()!==(r.language||'en').replace('cz','cs')?t('Translation missing for this language; showing the original recipe.'):null,
  };
}

let fontPromise;
async function fonts(){
  if(!fontPromise)fontPromise=Promise.all([5,8].map(async id=>{
    const response=await fetch(new URL(`./fonts/typeface-${id}.ttf`,import.meta.url));
    if(!response.ok)throw new Error('Could not load PDF font');
    const bytes=new Uint8Array(await response.arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary);
  })).catch(error=>{fontPromise=null;throw error;});
  return fontPromise;
}

async function pdfImage(blob){
  const url=URL.createObjectURL(blob);
  try{
    const image=new Image();image.src=url;await image.decode();
    const bytes=new Uint8Array(await blob.arrayBuffer()),ratio=image.naturalWidth/image.naturalHeight;
    // Keep original JPEG/PNG data and pixels. WebP is decoded losslessly to PNG
    // because the PDF library's WebP path would recompress it as JPEG.
    if(bytes[0]===0xff&&bytes[1]===0xd8)return {data:bytes,format:'JPEG',ratio};
    if(bytes[0]===0x89&&bytes[1]===0x50)return {data:bytes,format:'PNG',ratio};
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    canvas.getContext('2d').drawImage(image,0,0);
    return {data:canvas.toDataURL('image/png'),format:'PNG',ratio};
  }finally{URL.revokeObjectURL(url);}
}

export async function createRecipePdf(record,target){
  const content=recipePdfContent(record,target);
  const pictures=new Map();
  const imageIds=[...new Set([content.cover,...content.tasks.flatMap(task=>task.steps.flatMap(step=>step.images))].filter(Boolean))];
  // Verify every referenced picture before creating the file; never silently
  // turn an illustrated recipe into a text-only export.
  await Promise.all(imageIds.map(async id=>{
    try{
      if(!record.assets?.[id])throw new Error('Missing recipe image');
      pictures.set(id,await pdfImage(record.assets[id]));
    }catch{const error=new Error('Recipe image unavailable');error.code='PDF_IMAGE_UNAVAILABLE';throw error;}
  }));
  const [fontData]=await Promise.all([fonts(),import('./vendor/jspdf.js')]);
  const doc=new globalThis.jspdf.jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  for(const [index,style] of ['normal','bold'].entries()){
    doc.addFileToVFS(`Inter-${style}.ttf`,fontData[index]);doc.addFont(`Inter-${style}.ttf`,'Inter',style);
  }
  doc.setProperties({title:content.title,subject:'Recipe'});
  doc.setLanguage(content.language);
  const margin=18,width=174,bottom=276,lineHeight=5.3;
  let y=22;
  const style=(size=10.5,bold=false,color='#28312d')=>{doc.setFont('Inter',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);};
  const page=()=>{doc.addPage();y=23;style(8,false,'#69766d');doc.text(doc.splitTextToSize(content.title,width)[0],margin,13);};
  const ensure=height=>{if(y+height>bottom)page();};
  function text(value,{size=10.5,bold=false,color,indent=0,after=3,maxWidth=width-indent,x=margin+indent}={}){
    style(size,bold,color);const lines=doc.splitTextToSize(String(value),maxWidth),leading=size>14?size*0.44:lineHeight;
    for(const line of lines){ensure(leading);style(size,bold,color);doc.text(line,x,y);y+=leading;}
    y+=after;
  }
  function measure(value,{size=10.5,bold=false,indent=0,after=3,maxWidth=width-indent}={}){
    style(size,bold);return doc.splitTextToSize(String(value),maxWidth).length*(size>14?size*0.44:lineHeight)+after;
  }
  function heading(value,keep=12){
    ensure(7+measure(value,{size:15,bold:true,after:5})+keep);y+=6;text(value,{size:15,bold:true,after:3});
    doc.setDrawColor('#d8dfd8');doc.line(margin,y-1,192,y-1);y+=3;
  }
  function stepLayout(step,index){
    const titleHeight=measure(`${index+1}. ${step.title}`,{size:12,bold:true});
    if(step.images.length===1){
      const picture=pictures.get(step.images[0]),caption=content.images.find(i=>i.id===step.images[0])?.caption;
      const imageHeight=Math.min(78,70/picture.ratio)+4+(caption?measure(caption,{size:9,maxWidth:70}):0);
      const textHeight=measure(step.instruction,{maxWidth:96})+step.details.reduce((sum,detail)=>sum+measure(detail,{size:9.5,maxWidth:92,after:2}),0);
      const height=titleHeight+Math.max(imageHeight,textHeight)+6;
      if(height<=210)return {columns:true,space:height};
    }
    return {columns:false,space:Math.min(120,titleHeight+measure(step.instruction)+step.details.reduce((sum,detail)=>sum+measure(detail,{size:9.5,indent:4,after:2}),0)+(step.images.length?72:0)+4)};
  }
  const stepSpace=(step,index)=>stepLayout(step,index).space;
  async function image(id,cover=false,layout={}){
    const picture=pictures.get(id);
    const maxWidth=layout.maxWidth||width,h=Math.min(layout.maxHeight||(cover?50:66),maxWidth/picture.ratio),w=h*picture.ratio;
    const caption=content.images.find(i=>i.id===id)?.caption;
    style(9);const captionLines=caption?doc.splitTextToSize(caption,maxWidth):[];
    ensure(h+Math.min(15,captionLines.length*lineHeight)+5);
    const x=layout.x??margin+(width-w)/2;
    doc.addImage(picture.data,picture.format,x,y,w,h,id,'FAST');y+=h+4;
    if(caption)text(caption,{size:9,color:'#69766d',x,maxWidth});
  }
  text(content.title,{size:24,bold:true,after:4});
  if(content.description)text(content.description,{color:'#69766d',after:5});
  text(content.facts,{size:10,bold:true,after:5});
  if(content.scaling)text(content.scaling,{size:9});
  if(content.translationMissing)text(content.translationMissing,{size:9});
  if(content.cover)await image(content.cover,true);
  heading(content.labels.Ingredients);
  for(const group of content.ingredients){
    if(content.ingredients.length>1||record.recipe.components?.length){ensure(18);text(group.title,{bold:true});}
    for(const [row,item] of group.items.entries()){
      style();const names=doc.splitTextToSize(item.name,101);style(10.5,true);const amounts=doc.splitTextToSize(item.amount,59);
      const height=Math.max(names.length,amounts.length)*lineHeight;
      const noteSpace=item.notes?measure(item.notes,{size:9,indent:3,after:1}):0,rowHeight=height+noteSpace+5;
      if(rowHeight>bottom-23){text(`${item.name} · ${item.amount}`);if(item.notes)text(item.notes,{size:9,color:'#69766d'});}else{
        ensure(rowHeight);
        if(row%2===0){doc.setFillColor('#f5f6f3');doc.rect(margin,y-3,width,rowHeight,'F');}
        const start=y;style();for(const [index,line] of names.entries())doc.text(line,margin+3,start+index*lineHeight);
        style(10.5,true);for(const [index,line] of amounts.entries())doc.text(line,189,start+index*lineHeight,{align:'right'});
        y+=height;
        if(item.notes)text(item.notes,{size:9,color:'#69766d',indent:3,after:1});
        y+=5;
      }
    }
    y+=2;
  }
  if(content.equipment.length){heading(content.labels.Equipment);for(const item of content.equipment)text(item,{after:1});}
  const taskHeadingSpace=content.tasks.length>1?12:0;
  heading(content.labels.Method,content.tasks.length?taskHeadingSpace+stepSpace(content.tasks[0].steps[0],0):12);
  for(const task of content.tasks){
    if(content.tasks.length>1){ensure(taskHeadingSpace+stepSpace(task.steps[0],0));text(task.title,{size:12,bold:true,after:5});if(task.description)text(task.description);}
    for(const [index,step] of task.steps.entries()){
      const layout=stepLayout(step,index);ensure(layout.space);
      text(`${index+1}. ${step.title}`,{size:12,bold:true});
      const bodyTop=y;
      text(step.instruction,{maxWidth:layout.columns?96:width});
      for(const detail of step.details)text(detail,{size:9.5,color:'#526259',indent:4,maxWidth:layout.columns?92:width-4,after:2});
      if(layout.columns){
        const textBottom=y;y=bodyTop;await image(step.images[0],false,{maxWidth:70,maxHeight:78,x:122});y=Math.max(textBottom,y);
      }else for(const id of step.images)await image(id);
      y+=6;
    }
  }
  if(content.notes.length){heading(content.labels['Recipe notes']);for(const note of content.notes)text(note);}
  if(content.sources.length){
    const sourceSpace=source=>Math.min(100,measure(source.title,{bold:true})+(source.author?measure(source.author,{size:9}):0)+(source.url?measure(source.url,{size:9,after:4}):0));
    heading(content.labels.Sources,sourceSpace(content.sources[0]));
    for(const source of content.sources){
      ensure(sourceSpace(source));text(source.title,{bold:true});if(source.author)text(source.author,{size:9});
      if(source.url){
        style(9);for(const line of doc.splitTextToSize(source.url,width)){ensure(lineHeight);style(9,false,'#55725a');doc.textWithLink(line,margin,y,{url:source.url});y+=lineHeight;}y+=4;
      }
    }
  }
  const pages=doc.getNumberOfPages();
  for(let n=1;n<=pages;n++){
    doc.setPage(n);doc.setDrawColor('#d8dfd8');doc.line(margin,282,192,282);style(8,false,'#69766d');
    doc.text(`${content.labels.Page} ${n} ${content.labels.of} ${pages}`,192,288,{align:'right'});
  }
  return doc.output('blob');
}
