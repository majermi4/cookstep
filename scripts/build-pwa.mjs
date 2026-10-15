import {readdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function buildPwa(directory = 'dist') {
  async function files(directory) {
    const entries = await readdir(directory, {withFileTypes: true});
    return (await Promise.all(entries.map(entry => entry.isDirectory()
      ? files(directory + '/' + entry.name) : directory + '/' + entry.name))).flat();
  }
  // Only shipped interface files enter this cache; private data stays in IndexedDB.
  const assets = (await files(directory)).filter(path => path !== directory + '/sw.js' && !path.startsWith(directory + '/guide/')).sort();
  const template = await readFile(new URL('./pwa-worker.js', import.meta.url), 'utf8');
  const hash = createHash('sha256').update(template);
  for (const file of assets) hash.update(file.slice(directory.length)).update(await readFile(file));
  const version = hash.digest('hex').slice(0, 20);
  await writeFile(directory + '/sw.js', template.replace('__PWA_VERSION__', JSON.stringify(version))
    .replace('__PWA_ASSETS__', JSON.stringify(assets.map(path => path.slice(directory.length)))));
}
