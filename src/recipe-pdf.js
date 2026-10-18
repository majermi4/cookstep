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
      highlights:[
        s.temperature?formatTemperature(s.temperature):null,
        ...(s.timers||[]).map(timer=>`${timer.label}: ${timer.mode==='elapsed'?t('Elapsed tracking'):clockText(timer.durationSeconds)} · ${t('Start: {0}',[timer.startLabel])}`),
      ].filter(Boolean),
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
    labels:Object.fromEntries(['Ingredients','Ingredient','Amount','Equipment','Method','Recipe notes','Sources','Page','of'].map(key=>[key,t(key)])),
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
  function detailSpace(step,maxWidth){
    const highlights=step.highlights.length?6+step.highlights.reduce((sum,detail)=>sum+measure(detail,{size:9.5,bold:true,maxWidth:maxWidth-6,after:1}),0):0;
    return highlights+step.details.filter(detail=>!step.highlights.includes(detail)).reduce((sum,detail)=>sum+measure(detail,{size:9.5,maxWidth:maxWidth-3,after:2}),0);
  }
  function stepLayout(step){
    const headerHeight=Math.max(13,measure(step.title,{size:12,bold:true,maxWidth:143,after:0})+7);
    if(step.images.length===1){
      const picture=pictures.get(step.images[0]),caption=content.images.find(i=>i.id===step.images[0])?.caption;
      const imageHeight=Math.min(78,68/picture.ratio)+4+(caption?measure(caption,{size:9,maxWidth:68}):0);
      const textHeight=measure(step.instruction,{maxWidth:86})+detailSpace(step,86);
      const height=headerHeight+10+Math.max(imageHeight,textHeight);
      if(height<=210)return {columns:true,framed:true,headerHeight,space:height};
    }
    const imageHeight=step.images.reduce((sum,id)=>{
      const picture=pictures.get(id),caption=content.images.find(i=>i.id===id)?.caption;
      return sum+Math.min(66,162/picture.ratio)+4+(caption?measure(caption,{size:9,maxWidth:162}):0);
    },0);
    const height=headerHeight+10+measure(step.instruction,{maxWidth:162})+detailSpace(step,162)+imageHeight;
    return {columns:false,framed:height<=210,headerHeight,space:height<=210?height:100};
  }
  const stepSpace=step=>stepLayout(step).space;
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
  const tableHeader=()=>{
    doc.setFillColor('#e9eee9');doc.rect(margin,y,width,9,'F');style(9,true,'#425c49');
    doc.text(content.labels.Ingredient,24,y+4.5,{baseline:'middle'});
    doc.text(content.labels.Amount,186,y+4.5,{align:'right',baseline:'middle'});y+=9;
  };
  for(const group of content.ingredients){
    ensure(30);
    if(content.ingredients.length>1||record.recipe.components?.length)text(group.title,{bold:true});
    tableHeader();
    for(const [row,item] of group.items.entries()){
      style();const names=doc.splitTextToSize(item.name,101);style(10.5,true);const amounts=doc.splitTextToSize(item.amount,53);
      const height=Math.max(names.length,amounts.length)*lineHeight;
      style(9);const notes=item.notes?doc.splitTextToSize(item.notes,162):[],noteSpace=notes.length?1+notes.length*4.4:0,rowHeight=height+noteSpace+6;
      if(rowHeight>bottom-32){text(`${item.name} · ${item.amount}`);if(item.notes)text(item.notes,{size:9,color:'#69766d'});}else{
        if(y+rowHeight>bottom){page();tableHeader();}
        const top=y,start=top+3+lineHeight/2;
        if(row%2===0){doc.setFillColor('#f5f6f3');doc.rect(margin,top,width,rowHeight,'F');}
        style();for(const [index,line] of names.entries())doc.text(line,24,start+index*lineHeight,{baseline:'middle'});
        style(10.5,true);for(const [index,line] of amounts.entries())doc.text(line,186,start+index*lineHeight,{align:'right',baseline:'middle'});
        style(9,false,'#69766d');for(const [index,line] of notes.entries())doc.text(line,24,top+3+height+1+(index+0.5)*4.4,{baseline:'middle'});
        y=top+rowHeight;doc.setDrawColor('#e2e7e2');doc.line(margin,y,192,y);
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
      const layout=stepLayout(step);ensure(layout.space);
      const top=y;
      if(layout.framed){doc.setFillColor('#ffffff');doc.roundedRect(margin,top,width,layout.space,2,2,'F');}
      doc.setFillColor('#eef2ed');doc.roundedRect(margin,top,width,layout.headerHeight,2,2,'F');
      const badgeY=top+(layout.headerHeight-9)/2;
      doc.setFillColor('#48634f');doc.roundedRect(23,badgeY,9,9,1.4,1.4,'F');
      style(11,true,'#ffffff');doc.text(String(index+1),27.5,badgeY+4.5,{align:'center',baseline:'middle'});
      style(12,true);const titleLines=doc.splitTextToSize(step.title,143),titleY=top+(layout.headerHeight-titleLines.length*lineHeight)/2+lineHeight/2;
      for(const [lineIndex,line] of titleLines.entries())doc.text(line,37,titleY+lineIndex*lineHeight,{baseline:'middle'});
      y=top+layout.headerHeight+7;
      const bodyTop=y;
      const bodyWidth=layout.columns?86:162;
      text(step.instruction,{x:24,maxWidth:bodyWidth});
      if(step.highlights.length){
        const height=4+step.highlights.reduce((sum,detail)=>sum+measure(detail,{size:9.5,bold:true,maxWidth:bodyWidth-6,after:1}),0);
        ensure(height);doc.setFillColor('#eef2ed');doc.roundedRect(24,y-3,bodyWidth,height,1,1,'F');y+=2;
        for(const detail of step.highlights)text(detail,{size:9.5,bold:true,color:'#425c49',x:27,maxWidth:bodyWidth-6,after:1});y+=4;
      }
      for(const detail of step.details.filter(detail=>!step.highlights.includes(detail)))text(detail,{size:9.5,color:'#526259',x:27,maxWidth:bodyWidth-3,after:2});
      if(layout.columns){
        const textBottom=y;y=bodyTop-3;await image(step.images[0],false,{maxWidth:68,maxHeight:78,x:118});y=Math.max(textBottom,y);
      }else for(const id of step.images)await image(id,false,{maxWidth:162});
      if(layout.framed){doc.setDrawColor('#d8dfd8');doc.roundedRect(margin,top,width,layout.space,2,2,'S');y=top+layout.space;}
      y+=7;
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
