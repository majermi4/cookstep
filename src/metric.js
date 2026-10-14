import {repairLegacyMeasurements} from './metric-migrations.js';
// One-way ingestion compatibility. Stored recipes and displays use metric only.
// Factors never convert volume to mass or infer ingredient density.
export const METRIC_UNITS = {g:['mass',1],kg:['mass',1000],ml:['volume',1],l:['volume',1000],mm:['length',1],cm:['length',10],m:['length',1000]};
const legacy = {
  oz:['g',28.349523125],lb:['g',453.59237],fl_oz_us:['ml',29.5735295625],fl_oz_uk:['ml',28.4130625],
  cup_us:['ml',236.5882365],cup_us_legal:['ml',240],cup_metric:['ml',250],cup_uk:['ml',284.130625],
  tbsp_us:['ml',14.78676478125],tbsp_metric:['ml',15],tbsp_au:['ml',20],tsp_us:['ml',4.92892159375],tsp_metric:['ml',5],
  stone:['g',6350.29318],yard:['cm',91.44],inch:['cm',2.54],in:['cm',2.54],ft:['cm',30.48],pint_us:['ml',473.176473],pint_uk:['ml',568.26125],
  quart_us:['ml',946.352946],quart_uk:['ml',1136.5225],gallon_us:['ml',3785.411784],gallon_uk:['ml',4546.09],stick_us:['g',113.3980925],
};
const fractions={'¼':.25,'½':.5,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
const amount='(?:\\d+\\s+[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\s+\\d+\\/\\d+|\\d+[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+(?:[.,]\\d+)?(?:\\/\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])';
const measurement=new RegExp(`(${amount})(?:\\s*[–—-]\\s*(${amount}))?\\s*(?:de\\s+)?[-‑]?\\s*(?:(?:packed|pěchovaný|pěchovaného|compacta|compactada)\\s+)?((?:US|UK|metric|Australian)\\s+)?(fl\\.?\\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|cups?|tablespoons?|tbsp|teaspoons?|tsp|inches|inch|in(?=\\s*(?:[),.;]|$))|feet|foot|ft|yards?|yd|stones?|pints?|quarts?|gallons?|sticks?|tazas?|cucharadas?|cucharaditas?|hrnků|hrnky|hrnku|hrnek|lžíce|lžic|lžičky|lžiček|palc(?:e|ů|ové|ových|ový|ův)?|pulgadas?)(?![\\p{L}_])`,'giu');
const nonMetric=/(?:^|[^\p{L}_])(?:cup(?:s|_\w+)?|tbsp(?:_\w+)?|tsp(?:_\w+)?|fl_oz(?:_\w+)?|oz|ounces?|lb|lbs|pounds?|feet|foot|ft|yards?|yd|stones?|inches|inch|pints?|quarts?|gallons?|fahrenheit|tablespoons?|teaspoons?|tazas?|cucharadas?|cucharaditas?|hrnků|hrnky|hrnku|hrnek|lžíce|lžic|lžičky|lžiček|palc(?:e|ů|ové|ových|ový|ův)?|pulgadas?)(?![\p{L}_])|°\s*F\b|[\d¼½¾⅓⅔⅛⅜⅝⅞]\s*(?:US\s+)?sticks?\b/iu;
export const hasNonMetric = text => typeof text==='string' && nonMetric.test(text);
const decimal=n=>new Intl.NumberFormat('en',{useGrouping:false,maximumFractionDigits:3}).format(n);
function value(text){text=text.trim().replace(',','.');const last=text.at(-1);if(fractions[last]!==undefined)return Number(text.slice(0,-1)||0)+fractions[last];if(text.includes('/')){const parts=text.split(/\s+/),[a,b]=parts.pop().split('/').map(Number);return Number(parts[0]||0)+a/b;}return Number(text);}
function code(unit,convention,context){
  const u=unit.toLowerCase(),c=convention?.trim().toLowerCase();
  if(/^(oz|ounce)/.test(u))return 'oz';if(/^(lb|pound)/.test(u))return 'lb';
  if(/^(in$|inch|palc|pulg)/.test(u))return 'inch';
  if(/^(feet|foot|ft)$/.test(u))return 'ft';if(/^(yard|yd)/.test(u))return 'yard';if(/^stone/.test(u))return 'stone';
  const type=/^(cup|taza|hrn)/.test(u)?'cup':/^(teaspoon|tsp|cucharadita|lžič)/.test(u)?'tsp':/^(tablespoon|tbsp|cucharada|lžíc|lžic)/.test(u)?'tbsp':/^(fl|fluid)/.test(u)?'fl_oz':/^(stick)/.test(u)?'stick':u.replace(/s$/,'');
  if(c)return `${type}_${c==='australian'?'au':c}`;
  return context[type]||type;
}
export function metricText(text,context={},strict=true){
  if(typeof text!=='string')return text;
  let result=text.replace(new RegExp(`(\\d+(?:[.,]\\d+)?\\s*cm)\\s*[/]\\s*${amount}\\s*(?:in|inches|inch|palc(?:e|ů)|pulgadas?)(?![\\p{L}_])`,'giu'),'$1').replace(new RegExp(`(-?${amount})(?:\\s*[–—]\\s*(-?${amount}))?\\s*(?:°\\s*[Ff]|[Dd]egrees?\\s*[Ff]ahrenheit|F)\\b`,'g'),(_,n,max)=>`${decimal((value(n)-32)*5/9)}${max?'–'+decimal((value(max)-32)*5/9):''} °C`);
  result=result.replace(measurement,(match,min,max,convention,unit)=>{
    const conversion=legacy[code(unit,convention,context)];
    if(!conversion)return match;
    return `${decimal(value(min)*conversion[1])}${max?'–'+decimal(value(max)*conversion[1]):''} ${conversion[0]}`;
  });
  if(hasNonMetric(result)){
    if(strict)throw new Error('Use metric measurements with a known source convention. Re-prepare this amount in g, kg, ml, l, cm or °C.');
    return 'Amount needs metric clarification';
  }
  return result;
}
export function metricQuantity(q,context={},strict=true){
  if(!q||typeof q!=='object')return q;
  const conversion=legacy[q.unit]||legacy[context[q.unit]]||legacy[code(q.unit||'',null,context)];
  if(conversion&&(q.value!==undefined||q.range)){
    const result={...q,unit:conversion[0]};
    if(q.range)result.range={min:q.range.min*conversion[1],max:q.range.max*conversion[1]};else result.value=q.value*conversion[1];
    // Render exact structured values; retain descriptors after the source amount.
    const suffix=(q.text||'').replace(measurement,'').trim();
    const packed=/packed|pěchovan|compactad/.test(q.text||'')?' (packed)':'';
    const numbers=result.range?[result.range.min,result.range.max]:[result.value];
    result.text=numbers.map(decimal).join('–')+' '+result.unit+packed+(suffix?' '+metricText(suffix,context,strict):'');
    return result;
  }
  if(hasNonMetric(q.unit)){
    if(strict)throw new Error('Measurement convention is unknown. Supply a metric quantity before saving.');
    return {text:'Amount needs metric clarification'};
  }
  const text=metricText(q.text,context,strict);
  const result={...q,text};
  // Simple text-only measurements become scalable after conversion.
  if(q.value===undefined&&!q.range&&text!==q.text){const m=text.match(/^([\d.]+)(?:–([\d.]+))? (g|kg|ml|l|cm)$/);if(m){result.unit=m[3];const sourceMatch=[...q.text.matchAll(measurement)][0],conversion=sourceMatch&&legacy[code(sourceMatch[4],sourceMatch[3],context)];if(m[2])result.range={min:conversion?value(sourceMatch[1])*conversion[1]:Number(m[1]),max:conversion?value(sourceMatch[2])*conversion[1]:Number(m[2])};else result.value=conversion?value(sourceMatch[1])*conversion[1]:Number(m[1]);}}
  return result;
}
export function metricRecipe(recipe,{strict=false}={}){
  if(!recipe||typeof recipe!=='object')return recipe;
  const original=recipe;
  recipe=repairLegacyMeasurements(structuredClone(recipe));
  const context={};
  for(const i of recipe.ingredients||[]){for(const type of ['cup','tbsp','tsp','fl_oz','stick'])if(i.quantity?.unit?.startsWith(type+'_')){const previous=context[type];context[type]=previous&&previous!==i.quantity.unit?'ambiguous':i.quantity.unit;}}
  const czechSource=recipe.sources?.some(s=>/^https:\/\/(www\.)?cooklikeczechs\.com\//.test(s.url||''));
  const verifiedLegacy=['bramboracka-czech-potato-soup','cooklikeczechs-chicken-breast-paprikash','cooklikeczechs-czech-bread-dumplings'].includes(recipe.id);
  if(czechSource&&verifiedLegacy)Object.assign(context,{cup:'cup_us_legal',tbsp:'tbsp_metric',tsp:'tsp_metric',stick:'stick_us'});
  // This legacy meal uses the author's documented Australian volume convention.
  if(recipe.id==='e0b8a34c-83ae-4f8f-9cfb-33bff01b595b')Object.assign(context,{cup:'cup_metric',tbsp:'tbsp_metric',tsp:'tsp_metric'});
  if(czechSource&&verifiedLegacy){for(const i of recipe.ingredients||[])if(i.quantity){const map={cup_us:'cup_us_legal',tbsp_us:'tbsp_metric',tsp_us:'tsp_metric'};if(map[i.quantity.unit])i.quantity={...i.quantity,unit:map[i.quantity.unit]};}for(const step of recipe.steps||[])for(const u of step.ingredientUses||[])if(u.quantity){const map={cup_us:'cup_us_legal',tbsp_us:'tbsp_metric',tsp_us:'tsp_metric'};if(map[u.quantity.unit])u.quantity={...u.quantity,unit:map[u.quantity.unit]};}}
  function walk(input,key=''){
    if(key==='translations')return input;
    if(typeof input==='string')return ['id','ingredientId','componentId','coverImageId','path','url','sourceUrl','author','language','formatVersion','unit'].includes(key)||key.endsWith('Ids')?input:metricText(input,context,strict);
    if(Array.isArray(input))return input.map(v=>walk(v,key));
    if(!input||typeof input!=='object')return input;
    if(key==='quantity')return metricQuantity(input,context,strict);
    if(key==='temperature'&&input.unit==='F')return {...input,value:(input.value-32)*5/9,unit:'C'};
    return Object.fromEntries(Object.entries(input).filter(([k])=>k!=='units'&&k!=='unitSystem').map(([k,v])=>[k,walk(v,k)]));
  }
  const result=walk(recipe);
  // Text overlays must follow the shared converted quantity, never restore old units.
  for(const [locale,sourceOverlay] of Object.entries(result.translations||{})){
    const overlay=structuredClone(sourceOverlay);
    for(const collection of ['ingredients','steps'])for(const entry of overlay[collection]||[]){
      const base=result[collection]?.find(v=>v.id===entry.id);
      if(base?.quantity&&entry.quantity&&JSON.stringify(original[collection]?.find(v=>v.id===entry.id)?.quantity)!==JSON.stringify(base.quantity))entry.quantity.text=base.quantity.text;
      for(const use of entry.ingredientUses||[]){const canonical=base?.ingredientUses?.find(u=>u.ingredientId===use.ingredientId);if(canonical?.quantity&&use.quantity){const previous=original.steps?.find(s=>s.id===entry.id)?.ingredientUses?.find(u=>u.ingredientId===use.ingredientId);if(JSON.stringify(previous?.quantity)!==JSON.stringify(canonical.quantity))use.quantity.text=canonical.quantity.text;}}
    }
    result.translations[locale]=walk(overlay);
  }
  return JSON.stringify(result)===JSON.stringify(original)?original:result;
}
export function metricRecord(record,options){if(!record?.recipe)return record;const recipe=metricRecipe(record.recipe,options);return recipe===record.recipe?record:{...record,recipe};}
export function metricSnapshot(snapshot){if(!snapshot)return snapshot;const {units,unitSystem,...rest}=snapshot;return {...rest,...(snapshot.record?{record:metricRecord(snapshot.record)}:{recipe:metricRecipe(snapshot.recipe)})};}
