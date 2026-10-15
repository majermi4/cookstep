// Approximate level-spoon weights, checked 2026-10-14. Match ingredient forms
// explicitly: fresh herbs, whole peppercorns and coarse salt differ in density.
const usda='https://ods.od.nih.gov/pubs/usdandb/EPA-Food.pdf';
const seeds='https://ods.od.nih.gov/pubs/usdandb/Selenium-Food.pdf';
const baking='https://www.kingarthurbaking.com/learn/ingredient-weight-chart';
const cumin='https://cairnspring.com/blogs/recipes/afghani-bolani';
const profiles=[
  [/^(?:(?:sweet|hot|smoked|hungarian|style) )*paprika(?: powder)?$/,2.3,usda],
  [/^(?:extra )?(?:ground )?black pepper$/,2.3,usda],
  [/^(?:ground )?cayenne(?: pepper)?$/,1.8,usda],
  [/^(?:dried )?marjoram$/,0.6,usda],
  [/^(?:dried )?oregano(?: leaves)?$/,1,usda],
  [/^onion powder$/,2.4,usda],
  [/^garlic powder$/,3.1,usda],
  [/^ground cumin$/,2,cumin],
  [/^caraway seeds?$/,2.1,seeds],
  [/^ground cinnamon$/,2.6,usda],
  [/^ground ginger$/,1.8,usda],
  [/^ground nutmeg$/,2.2,usda],
  [/^(?:fine |table )?salt(?: for cooking water)?$/,6,baking],
  [/^diamond crystal kosher salt$/,8/3,baking],
  [/^morton'?s? kosher salt$/,16/3,baking],
];
export function spiceProfile(name){
  const normalized=(name||'').toLowerCase().replace(/[,/()-]/g,' ').replace(/\s+/g,' ').trim();
  const match=profiles.find(([pattern])=>pattern.test(normalized));
  return match?{gramsPerTsp:match[1],sourceUrl:match[2]}:null;
}
export function validSpiceMeasure(measure){
  if(!measure||!['tsp','tbsp'].includes(measure.unit)||!Number.isFinite(measure.mlPerUnit)||measure.mlPerUnit<=0||!Number.isFinite(measure.gramsPerUnit)||measure.gramsPerUnit<=0)return false;
  try{return ['http:','https:'].includes(new URL(measure.sourceUrl).protocol);}catch{return false;}
}
export function withSpiceMeasure(quantity,original,profile,inherited){
  if(!quantity||validSpiceMeasure(quantity.spiceMeasure)||!profile)return quantity;
  const amount=quantity.range?.max??quantity.value;
  if(!Number.isFinite(amount)||amount<=0||!['ml','l','g','kg'].includes(quantity.unit))return quantity;
  const ml=quantity.unit==='ml'?amount:quantity.unit==='l'?amount*1000:amount*(quantity.unit==='kg'?1000:1)*5/profile.gramsPerTsp;
  const spoon=original?.unit?.match(/^(tsp|tbsp)(?:_(us|metric|au))?$/);
  const unit=spoon?.[1]||(ml>=15&&Math.abs(ml/15-Math.round(ml/15))<1e-8?'tbsp':'tsp');
  const mlPerUnit=spoon?.[2]==='us'?(unit==='tbsp'?14.78676478125:4.92892159375):spoon?.[2]==='au'&&unit==='tbsp'?20:inherited?.unit===unit?inherited.mlPerUnit:unit==='tbsp'?15:5;
  return {...quantity,spiceMeasure:{unit,mlPerUnit,gramsPerUnit:profile.gramsPerTsp*mlPerUnit/5,sourceUrl:profile.sourceUrl}};
}
// Both displays derive from the same structured quantity, including divided
// step amounts and ranges. No duplicate numeric totals can drift out of sync.
export function spiceAmounts(quantity,factor=1){
  const measure=quantity?.spiceMeasure;
  if(!validSpiceMeasure(measure)||!['ml','l','g','kg'].includes(quantity.unit))return null;
  const amounts=quantity.range?[quantity.range.min,quantity.range.max]:[quantity.value];
  if(amounts.some(n=>!Number.isFinite(n)))return null;
  const mass=quantity.unit==='g'||quantity.unit==='kg';
  const base=amounts.map(n=>n*factor*(['l','kg'].includes(quantity.unit)?1000:1));
  const spoons=base.map(n=>n/(mass?measure.gramsPerUnit:measure.mlPerUnit));
  const grams=mass?base:spoons.map(n=>n*measure.gramsPerUnit);
  return [...spoons,...grams].every(Number.isFinite)?{spoons,grams,unit:measure.unit}:null;
}
