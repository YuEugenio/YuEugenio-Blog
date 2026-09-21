import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const [from, to] of [['index.html','index.html'],['src','src'],['public/assets','assets']]) {
  await cp(new URL(from, root), new URL('dist/' + to, root), { recursive: true });
}

// Source files run directly from the project root, where assets live under
// public/. The published build flattens those assets beside src/ in dist/.
for (const name of ['index.html', 'src/fonts.css', 'src/styles.css', 'src/fluid.js']) {
  const file = new URL('dist/' + name, root);
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replaceAll('public/assets/', 'assets/'));
}

for (const name of ['src/fonts.css','src/styles.css','src/bio.css']) {
  const file = new URL('dist/' + name, root);
  const css = await readFile(file, 'utf8');
  for (const match of css.matchAll(/url\(['"]?(\.\.\/assets\/[^)'"\s]+)['"]?\)/g)) {
    await stat(new URL(match[1], file));
  }
}
console.log(`Built and verified: ${fileURLToPath(new URL('dist/', root))}`);
