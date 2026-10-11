import {spacing,textSizes,artwork} from './theme-scales.js';

export const THEME_STORAGE_KEY = 'cookstep.theme';
export const DEFAULT_THEME = 'editorial-cookbook';
const body = '"DM Sans", system-ui, sans-serif';
const serif = 'Georgia, "Times New Roman", serif';
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
  typography: {'font-body':body,'font-heading':serif,'font-mono':mono,'font-timer':mono,...textSizes},
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
  defineTheme('editorial-cookbook','Editorial Cookbook','Warm paper, serif headings and a recipe-book rhythm.','editorial'),
  defineTheme('kitchen-appliance','Kitchen Appliance','High contrast, clear controls and a prominent timer console.','appliance',{
    colorScheme:'dark',
    colors:{'background':'#161c23','surface':'#222b35','text':'#f0f4f7','text-muted':'#b5c2cf','primary':'#bde879','surface-soft':'#303c32',accent:'#edb969',line:'#485866',hover:'#303d4a','primary-hover':'#d0f59d','on-primary':'#182413','heading-soft':'#bde879','feature-bg':'#253329',overlay:'#ffffff12',backdrop:'#000000a6','check-line':'#a8d16c',focus:'#edb969','warning-bg':'#3d3222','warning-line':'#a88b52','warning-ink':'#ffe1a2','warning-hover':'#514027',danger:'#bb492f','timer-bg':'#0c1117','timer-card':'#19232d','timer-hover':'#253642','timer-line':'#526477','timer-ink':'#d5ff94','timer-muted':'#b9cdb0'},
    typography:{'font-heading':body},
    radii:{'radius-xs':'2px','radius-sm':'4px','radius-control':'5px','radius-md':'6px','radius-lg':'8px','radius-xl':'10px'},
    shadows:{'shadow-panel':'0 2px 0 #00000040','shadow-modal':'0 24px 80px #00000080','shadow-toast':'0 10px 30px #00000070','shadow-floating':'0 4px 24px #00000080'},
  }),
  defineTheme('cozy-illustrated','Cozy Illustrated','Soft peach, plum ink and playful illustrated details.','illustrated',{
    colors:{'background':'#fff2e8','surface':'#fffaf2','text':'#513945','text-muted':'#7c5964','primary':'#804258','surface-soft':'#f7e3e0',accent:'#b15a36',line:'#e7cbbd',hover:'#fae9df','primary-hover':'#663348','on-primary':'#fffaf2','heading-soft':'#a34c69','feature-bg':'#f9e2cf','check-line':'#a76c7d',focus:'#9f4c25','warning-bg':'#ffebcc','warning-line':'#e1bb82','warning-ink':'#85511d','warning-hover':'#fbdcb0','timer-bg':'#613e50','timer-card':'#795567','timer-hover':'#895e73','timer-line':'#c28eaa','timer-ink':'#fff6ed','timer-muted':'#f3d6e4'},
    typography:{'font-heading':serif},
    radii:{'radius-xs':'6px','radius-sm':'10px','radius-control':'14px','radius-md':'18px','radius-lg':'24px','radius-xl':'30px'},
    shadows:{'shadow-panel':'3px 4px 0 #b9846b18','shadow-modal':'6px 10px 0 #b9846b30, 0 20px 70px #51394530','shadow-floating':'3px 5px 0 #b9846b33'},
  }),
  defineTheme('recipe-studio','Recipe Studio','Crisp white, blue accents and a practical workspace.','studio',{
    colors:{'background':'#f2f4f7','surface':'#ffffff','text':'#1e3047','text-muted':'#56687b','primary':'#2457ac','surface-soft':'#e6edf8',accent:'#2457ac',line:'#cfd8e3',hover:'#eaf0f8','primary-hover':'#17468e','on-primary':'#ffffff','heading-soft':'#4871a6','feature-bg':'#e9eff7','check-line':'#7292bd',focus:'#255dad','warning-bg':'#fff2d9','warning-line':'#e3c896','warning-ink':'#755320','warning-hover':'#f9e6c1','timer-bg':'#223752','timer-card':'#324d6e','timer-hover':'#3d5b7f','timer-line':'#7493b9','timer-ink':'#ffffff','timer-muted':'#d0e1f8'},
    typography:{'font-heading':body},
    radii:{'radius-xs':'2px','radius-sm':'3px','radius-control':'4px','radius-md':'5px','radius-lg':'6px','radius-xl':'8px'},
    spacing:{'space-27':'24px','space-38':'32px','space-40':'32px','space-50':'40px'},
    shadows:{'shadow-panel':'0 1px 3px #1e30470d','shadow-modal':'0 24px 80px #1e304733','shadow-floating':'0 4px 20px #1e304733'},
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
