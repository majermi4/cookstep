import {messages} from './ui-translations.js';

export const LOCALE_KEY='cookstep.locale';
export const LOCALES=[{id:'en',label:'EN',name:'English'},{id:'es',label:'ES',name:'Español'},{id:'cs',label:'CZ',name:'Čeština'}];
export const normalizeLocale=value=>value==='cz'?'cs':LOCALES.some(l=>l.id===value)?value:'en';
let locale='en';
try{locale=normalizeLocale(globalThis.localStorage?.getItem(LOCALE_KEY)||globalThis.navigator?.language?.split('-')[0]);}catch{}
export function getLocale(){return locale;}
export function setLocale(value){
  locale=normalizeLocale(value);
  if(globalThis.document)document.documentElement.lang=locale;
  try{globalThis.localStorage?.setItem(LOCALE_KEY,locale);return true;}catch{return false;}
}

export function t(message,values=[],language=locale) {
  if(message.trim()!==message&&message.trim())return message.match(/^\s*/)[0]+t(message.trim(),values,language)+message.match(/\s*$/)[0];
  const pair=messages[message],translated=language==='en'||!pair?message:pair[language==='es'?0:1];
  return translated.replace(/\{(\d+)\}/g,(match,i)=>values[i]===undefined?match:String(values[i]));
}

// Translate only authored text/attributes in a template before inserting any
// values. Recipe text, user-entered names, escaped values and HTML from nested
// templates stay untouched. Placeholder order can differ between languages.
function translatePart(text){
  if(!text.trim())return text;
  const leading=text.match(/^\s*/)[0],trailing=text.match(/\s*$/)[0],tokens=[];
  const key=text.trim().replace(/\uE000(\d+)\uE001/g,(_,i)=>{tokens.push(`\uE000${i}\uE001`);return `{${tokens.length-1}}`;});
  return leading+t(key,tokens)+trailing;
}
export function uiText(text){
  if(!text.includes('<')&&!/\b(?:aria-label|title|placeholder)="/.test(text))return translatePart(text);
  return text.replace(/(?:^|>)([^<>]*)(?=<|$)/g,(match,part)=>match.slice(0,match.length-part.length)+translatePart(part))
    .replace(/\b(aria-label|title|placeholder)="([^"]*)"/g,(_,attr,part)=>`${attr}="${translatePart(part)}"`);
}
export function ui(strings,...values){
  const markup=strings.reduce((out,part,i)=>out+(i?`\uE000${i-1}\uE001`:'')+part,'');
  return uiText(markup).replace(/\uE000(\d+)\uE001/g,(_,i)=>String(values[i]??''));
}

// Cloud and validation messages arrive as English text rather than templates.
const templates=Object.keys(messages).filter(key=>/\{\d+\}/.test(key)).map(key=>{
  const slots=[];const pattern=key.split(/(\{\d+\})/).map(part=>{
    const slot=part.match(/^\{(\d+)\}$/);if(slot){slots.push(+slot[1]);return '(.*?)';}
    return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }).join('');
  return {key,slots,regex:new RegExp('^'+pattern+'$')};
});
export function translateMessage(message){
  if(messages[message])return t(message);
  for(const {key,slots,regex} of templates){const match=message.match(regex);if(match){const values=[];slots.forEach((slot,i)=>values[slot]=match[i+1]);return t(key,values);}}
  const colon=message.indexOf(': ');if(colon>=0)return message.slice(0,colon+2)+translateMessage(message.slice(colon+2));
  return message;
}
