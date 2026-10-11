import {spacing,textSizes,artwork} from './theme-scales.js';

export const THEME_STORAGE_KEY = 'cookstep.theme';
export const DEFAULT_THEME = 'editorial-cookbook';
const body = '"Inter", system-ui, sans-serif';
const serif = '"Fraunces", Georgia, serif';
const mono = 'ui-monospace, "SFMono-Regular", Consolas, monospace';
const base = {
  colors: {
    'background':'#f6f2e9','surface':'#fffdf7','text':'#29372e','text-muted':'#626e60','primary':'#284d3c',
    'surface-soft':'#e9eddf',accent:'#b77a38',line:'#dbded1',hover:'#edf0e5',
    'primary-hover':'#3b614b','on-primary':'#fffdf7','heading-soft':'#687a59',
    'feature-bg':'#eeeedf',overlay:'#ffffff66',backdrop:'#172e2470',
    'check-line':'#718665',focus:'#9a621e',
    'warning-bg':'#faf0d9','warning-line':'#e3cd9e','warning-ink':'#775325','warning-hover':'#f2e5c6',
    danger:'#a13b29','expired-bg':'#914321','expired-line':'#e8a975','expired-ink':'#fff3df',
    'timer-bg':'#2e4436','timer-card':'#40583f','timer-hover':'#3c5140','timer-line':'#7b936d',
    'timer-ink':'#fffdf2','timer-muted':'#d2dfc4','shadow-color':'#20392433',
  },
  typography: {'font-body':body,'font-heading':serif,'font-mono':mono,'font-timer':serif,'font-handwriting':'"Caveat", cursive',...textSizes},
  radii: {'radius-xs':'3px','radius-sm':'5px','radius-control':'7px','radius-md':'9px','radius-lg':'12px','radius-xl':'14px','radius-pill':'999px'},
  shadows: {'shadow-panel':'none','shadow-modal':'0 25px 100px #25382226','shadow-toast':'0 10px 30px #223c2422','shadow-floating':'0 5px 22px #20392433'},
  spacing,
  artwork,
};
function defineTheme(id,name,description,layout,overrides={}) {
  const tokens = Object.fromEntries(Object.entries(base).map(([group,values])=>[group,{...values,...overrides[group]}]));
  return {id,name,description,layout,colorScheme:overrides.colorScheme || 'light',tokens};
}
// Add themes here. A layout selects shared CSS composition, never a separate cooking implementation.
export const THEMES = [
  defineTheme('editorial-cookbook','Editorial Cookbook','Parchment, terracotta and a generous, photo-led cookbook page.','editorial',{
    colors:{background:'#faf7f2',surface:'#fffdf9',text:'#2d2a26','text-muted':'#756d62',primary:'#b94f2d','primary-hover':'#9d3f24','on-primary':'#fffaf2','surface-soft':'#f1ebe2',accent:'#c65f46',line:'#ded7ca',hover:'#eee7dc','heading-soft':'#6b7352','feature-bg':'#f3ede3','check-line':'#8d967b',focus:'#9b442a','timer-bg':'#2d2a26','timer-card':'#3a362f','timer-hover':'#494238','timer-line':'#777160','timer-ink':'#faf0dc','timer-muted':'#d4c9b3'},
    typography:{'font-heading':'"Playfair Display", Georgia, serif','font-timer':'"Playfair Display", Georgia, serif'},
    radii:{'radius-control':'7px','radius-lg':'10px','radius-xl':'12px'},
  }),
  defineTheme('kitchen-appliance','Kitchen Appliance','Matte black, cream instructions and a large copper timer dial.','appliance',{
    colorScheme:'dark',
    colors:{background:'#0e0e0e',surface:'#161715',text:'#f4eed7','text-muted':'#b9b9ad',primary:'#67b368','primary-hover':'#80c881','on-primary':'#101a11','surface-soft':'#22241f',accent:'#c89b7b',line:'#383b32',hover:'#282a24','heading-soft':'#e6c1a1','feature-bg':'#1b1d18',overlay:'#ffffff0a',backdrop:'#000000a6','check-line':'#939a82',focus:'#e8b690','warning-bg':'#29241e','warning-line':'#725940','warning-ink':'#f2d9be','warning-hover':'#373025',danger:'#bf5a40','expired-bg':'#713824','expired-line':'#d4a080','expired-ink':'#fff0d9','timer-bg':'#111210','timer-card':'#1c1e18','timer-hover':'#2a2e22','timer-line':'#545a45','timer-ink':'#f4eed7','timer-muted':'#bdbda9'},
    radii:{'radius-control':'12px','radius-md':'14px','radius-lg':'20px','radius-xl':'22px'},
    shadows:{'shadow-panel':'0 12px 32px #00000020','shadow-modal':'0 24px 80px #00000080','shadow-floating':'0 4px 24px #00000080'},
  }),
  defineTheme('cozy-illustrated','Cozy Illustrated','Cream paper, orange buttons, sage timers and hand-painted kitchen details.','illustrated',{
    colors:{background:'#fdf6ec',surface:'#fffaf2',text:'#152b2a','text-muted':'#58675b',primary:'#df712f','primary-hover':'#c55e24','on-primary':'#ffffff','surface-soft':'#eeeeda',accent:'#e97a3c',line:'#e2d7c6',hover:'#f3eadc','heading-soft':'#577451','feature-bg':'#f6ebd9','check-line':'#81966d',focus:'#bd5723','warning-bg':'#f4ecd6','warning-line':'#d7c49c','warning-ink':'#69532c','warning-hover':'#eee1c3','timer-bg':'#eff0e0','timer-card':'#fff9ee','timer-hover':'#e5e8d6','timer-line':'#c6cfb4','timer-ink':'#19312d','timer-muted':'#5a705b'},
    radii:{'radius-control':'999px','radius-md':'16px','radius-lg':'24px','radius-xl':'28px'},
    shadows:{'shadow-panel':'0 4px 16px #77573206','shadow-modal':'0 20px 70px #51394530','shadow-floating':'0 5px 20px #5b644522'},
  }),
  defineTheme('recipe-studio','Recipe Studio','White, herb green and a photographic workspace with a visual step rail.','studio',{
    colors:{background:'#f6f6f3',surface:'#ffffff',text:'#171d17','text-muted':'#646b60',primary:'#2b7032','primary-hover':'#215728','on-primary':'#ffffff','surface-soft':'#e9eee5',accent:'#2b7032',line:'#e0e3dc',hover:'#edf1e9','heading-soft':'#2b7032','feature-bg':'#edf0e8','check-line':'#83a17a',focus:'#276532','timer-bg':'#ffffff','timer-card':'#f5f7f2','timer-hover':'#e9efe4','timer-line':'#d7dfd0','timer-ink':'#1b2f1a','timer-muted':'#687660'},
    radii:{'radius-control':'8px','radius-md':'9px','radius-lg':'12px','radius-xl':'12px'},
    shadows:{'shadow-panel':'none','shadow-modal':'0 24px 80px #203a2433','shadow-floating':'0 4px 20px #203a2422'},
  }),
];
export function getTheme(id) { return THEMES.find(theme=>theme.id===id) || THEMES.find(theme=>theme.id===DEFAULT_THEME); }
export function loadTheme(storage) {
  try { return getTheme((storage || globalThis.localStorage).getItem(THEME_STORAGE_KEY)); }
  catch { return getTheme(DEFAULT_THEME); }
}
export function saveTheme(id,storage) {
  try { (storage || globalThis.localStorage).setItem(THEME_STORAGE_KEY,getTheme(id).id); return true; }
  catch { return false; }
}
export function applyTheme(id,doc=document) {
  const theme=getTheme(id);
  doc.documentElement.dataset.theme=theme.id;
  doc.documentElement.dataset.layout=theme.layout;
  doc.documentElement.style.colorScheme=theme.colorScheme;
  const meta=doc.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=theme.tokens.colors.background;
  return theme;
}
export function themeStyles() {
  return THEMES.map(theme=>`${theme.id===DEFAULT_THEME?':root,':''}[data-theme="${theme.id}"]{\n${Object.values(theme.tokens).flatMap(group=>Object.entries(group).map(([name,value])=>`  --${name}:${value};`)).join('\n')}\n}`).join('\n');
}
// Generated from the registry and run before first paint, including when local storage is unavailable.
export function themeBootstrap() {
  const choices=THEMES.map(t=>({id:t.id,layout:t.layout,colorScheme:t.colorScheme,background:t.tokens.colors.background}));
  return `(()=>{const choices=${JSON.stringify(choices)};let id;try{id=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch{}const t=choices.find(t=>t.id===id)||choices.find(t=>t.id===${JSON.stringify(DEFAULT_THEME)});document.documentElement.dataset.theme=t.id;document.documentElement.dataset.layout=t.layout;document.documentElement.style.colorScheme=t.colorScheme;document.querySelector('meta[name="theme-color"]').content=t.background;})();\n`;
}
