import {unzip, strFromU8} from './vendor/fflate.js';
import {validateRecipe,LIMITS,safePath} from './model.js';

export function imageMime(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
export async function importPackage(file) {
  if (file.size > LIMITS.package) throw new Error('Package exceeds 25 MB. Use smaller image files.');
  let recipe, files, assets = {};
  if (/\.zip$/i.test(file.name)) {
    let total = 0, count = 0, limitError;
    const names = new Set();
    const bytes = new Uint8Array(await file.arrayBuffer());
    files = await new Promise((resolve,reject) => unzip(bytes,{filter: entry => {
      total += entry.originalSize; count++;
      if (names.has(entry.name)) limitError = `ZIP contains duplicate file “${entry.name}”.`;
      names.add(entry.name);
      if (!safePath(entry.name) || count > LIMITS.files || total > LIMITS.expanded || !Number.isFinite(entry.originalSize)) limitError = 'ZIP has unsafe paths or exceeds 500 files / 80 MB expanded.';
      if (entry.name === 'recipe.json' && entry.originalSize > LIMITS.json) limitError = 'recipe.json exceeds 2 MB.';
      if (/^images\//.test(entry.name) && entry.originalSize > LIMITS.image) limitError = 'An image exceeds 10 MB.';
      return !limitError && (entry.name === 'recipe.json' || /^images\/.+\.(jpe?g|png|webp)$/i.test(entry.name));
    }},(error,result) => error ? reject(new Error(`Cannot read ZIP: ${error.message}`)) : limitError ? reject(new Error(limitError)) : resolve(result)));
    if (!files['recipe.json']) throw new Error('ZIP must contain recipe.json at its root.');
    try { recipe = JSON.parse(strFromU8(files['recipe.json'])); } catch { throw new Error('recipe.json is not valid UTF-8 JSON.'); }
  } else if (/\.json$/i.test(file.name)) {
    if (file.size > LIMITS.json) throw new Error('JSON exceeds 2 MB.');
    try { recipe = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON. Check for missing commas or quotation marks.'); }
  } else throw new Error('Choose a .json file or a .zip recipe package.');
  const errors = validateRecipe(recipe,files ? new Set(Object.keys(files)) : null);
  if (errors.length) { const error = new Error('Please correct the package before importing.'); error.details = errors; throw error; }
  for (const im of recipe.images || []) {
    const data = files[im.path], type = imageMime(data);
    if (!type) throw new Error(`${im.path}: file is not a supported JPEG, PNG or WebP image.`);
    assets[im.id] = new Blob([data],{type});
  }
  return {id:recipe.id,recipe,assets,savedAt:Date.now()};
}
