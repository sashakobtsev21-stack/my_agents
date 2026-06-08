#!/usr/bin/env node
/**
 * gif-to-webp.mjs — one-shot conversion of ruflo-plugins.gif to animated WebP.
 *
 * Rationale: the gif is 5.5 MB; WebP at quality 75 typically delivers 5-10x
 * smaller files with the same frame rate and dimensions. Sharp 0.32+ ships
 * animated webp support out of the box (libvips ≥ 8.13 + libwebpmux).
 *
 * Run once:  node scripts/gif-to-webp.mjs
 * Then update README.md: ./ruflo-plugins.gif -> ./ruflo-plugins.webp
 */
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'ruflo-plugins.gif');
const dst = join(root, 'ruflo-plugins.webp');

// Sharp lives under pnpm's content-addressed store; resolve directly.
// ESM dynamic import on Windows requires a file:// URL, not a raw c:\ path.
import { pathToFileURL } from 'node:url';
const sharpPath = join(root, 'v3/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js');
const { default: sharp } = await import(pathToFileURL(sharpPath).href);

const srcBytes = statSync(src).size;
console.log(`Source: ruflo-plugins.gif (${(srcBytes / 1_048_576).toFixed(2)} MB)`);

// limitInputPixels: large gif (animated, many frames stacked) exceeds the
// default 268M pixel safety cap. The file is trusted (lives in this repo).
await sharp(src, { animated: true, limitInputPixels: false })
  .webp({ quality: 75, effort: 5 })
  .toFile(dst);

const dstBytes = statSync(dst).size;
const ratio = (srcBytes / dstBytes).toFixed(2);
console.log(`Output: ruflo-plugins.webp (${(dstBytes / 1_048_576).toFixed(2)} MB) — ${ratio}x smaller`);
console.log(`\nNext: update README.md line 52`);
console.log(`  ![Ruflo Plugins](./ruflo-plugins.gif)`);
console.log(`  ->`);
console.log(`  ![Ruflo Plugins](./ruflo-plugins.webp)`);
