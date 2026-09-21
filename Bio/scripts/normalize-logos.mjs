// Normalize the visible artwork, not the source canvas. Bitmap pixels are
// preserved in embedded SVG images; viewBox selects and frames the mark only.
import { readFile, writeFile } from 'node:fs/promises';

const assets = new URL('../public/assets/logos/', import.meta.url);
const marks = [
  // The original already has a transparent exterior and the correct white disc.
  { name: 'sysu-mark', source: 'sysu.png', size: [536, 536], bounds: [7, 7, 529, 529] },
  { name: 'jaist-mark', source: 'jaist-transparent.png', size: [1738, 905], bounds: [1062, 129, 1666, 736] },
  { name: 'shumei-mark', source: 'shumei-symbol.png', size: [1254, 1254], bounds: [125, 208, 1129, 1045] },
];

for (const { name, source, size: [width, height], bounds: [left, top, right, bottom] } of marks) {
  // Bounds measured from the opaque silhouette (alpha >= 128), ignoring
  // isolated edge noise. The longest visible dimension fills one square.
  const side = Math.max(right - left, bottom - top);
  const x = (left + right - side) / 2;
  const y = (top + bottom - side) / 2;
  const pixels = (await readFile(new URL(source, assets))).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}" overflow="hidden"><image x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,${pixels}"/></svg>\n`;
  await writeFile(new URL(`${name}.svg`, assets), svg);
  console.log(`${name}: visible ${right - left} × ${bottom - top}, square ${side}`);
}

// HKU already has native vector artwork with a tightly fitted crest viewport.
const crest = await readFile(new URL('hku-crest.svg', assets), 'utf8');
if (!crest.includes('viewBox="0 0 93 105"')) throw new Error('Unexpected HKU crest viewport');
// The source ribbon contains outlines and lettering but no paper fill. Follow
// its existing upper rim and outer lower edge, leaving the gap above it clear.
const ribbonPaper = `M9.8 70.38
c-.94 .46-1.45 1.4-1.52 2.79
c-.26 5.09 8.71 12.87 20 17.34
c5.81 2.3 11.66 3.42 17.88 3.42
c6.63 0 14.05-1.67 17.95-3.33
c10.45-4.42 21.09-12.52 20.81-18.42
c-.06-1.27-.54-2.13-1.42-2.57
L83.17 67.83
C85.25 68.18 85.83 69.44 86.65 71.19
C87.10 72.15 87.61 73.23 88.48 74.47
C89.65 76.13 90.46 77.09 91.05 77.79
C91.79 78.67 92.19 79.15 92.46 80.01
c.54 1.76-.34 3.53-3.14 6.33
c-8.55 8.55-18.88 14.26-30.71 16.95
c-4.32 .98-12.11 1.31-12.47 1.32
c-.33-.01-8.12-.34-12.43-1.32
c-17.44-3.97-26.65-13.19-29.67-16.22
l-.15-.16
c-2.86-2.86-4.29-4.30-3.77-6
c.24-.78 .77-1.28 1.5-1.97
a22.651 22.651 0 0 0 3.21-3.68
c.86-1.22 1.38-2.31 1.83-3.27
c.84-1.77 1.45-3.06 3.53-3.41 Z`;
const ribbonOutline = crest.match(/<path d="(m9\.8 70\.38[^"]+)"[^>]*\/>/);
if (!ribbonOutline) throw new Error('HKU ribbon outline is missing');
const rightFold = ribbonOutline[1].match(/m70\.5 3\.21.*?z/)[0].replace('m70.5 3.21', 'M80.3 73.59l');
const leftFold = ribbonOutline[1].match(/m-60\.55 5\.55.*?z/)[0].replace('m-60.55 5.55', 'M19.75 79.14');
const filledCrest = crest.replace(ribbonOutline[0], `<path id="ribbon-paper" fill="#fff" d="${ribbonPaper} ${rightFold} ${leftFold}"/>${ribbonOutline[0]}`);
await writeFile(new URL('hku-mark.svg', assets), filledCrest.replace('viewBox="0 0 93 105"', 'viewBox="-5.805 0 104.61 104.61"'));
console.log('hku-mark: native crest framed in a 104.61 × 104.61 square');
