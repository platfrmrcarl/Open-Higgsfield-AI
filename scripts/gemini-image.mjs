#!/usr/bin/env node
// CLI: generate 2D game graphics with Gemini Nano Banana.
// npm run gen -- "pixel-art knight sprite, side view" --out assets/knight.png [--aspect 1:1] [--pro] [--size 2K] [--ref a.png ...] [--count 4]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApiKey, generate, fileToPart } from './gemini-core.mjs';

const args = process.argv.slice(2);
const opts = { out: 'output/image.png', aspect: '1:1', model: 'nano-banana', size: undefined, refs: [], count: 1 };
const promptParts = [];
for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out' || a === '-o') opts.out = args[++i];
    else if (a === '--aspect' || a === '-a') opts.aspect = args[++i];
    else if (a === '--model' || a === '-m') opts.model = args[++i];
    else if (a === '--pro') opts.model = 'nano-banana-pro';
    else if (a === '--size') opts.size = args[++i];
    else if (a === '--ref' || a === '-r') opts.refs.push(args[++i]);
    else if (a === '--count' || a === '-n') opts.count = Math.max(1, parseInt(args[++i], 10) || 1);
    else if (a === '--help' || a === '-h') { console.log(readHelp()); process.exit(0); }
    else promptParts.push(a);
}
const prompt = promptParts.join(' ').trim();
if (!prompt) { console.error(readHelp()); process.exit(1); }

function readHelp() {
    return 'Usage: npm run gen -- "<prompt>" [--out file.png] [--aspect 1:1|16:9|9:16|4:3|3:2|...] [--pro] [--size 1K|2K|4K] [--ref image.png]... [--count N]';
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiKey = loadApiKey(root);
const images = opts.refs.map(fileToPart);

for (let n = 1; n <= opts.count; n++) {
    const r = await generate({ apiKey, prompt, model: opts.model, aspectRatio: opts.aspect, imageSize: opts.size, images });
    const ext = r.mimeType === 'image/jpeg' ? '.jpg' : '.png';
    let out = resolve(opts.out);
    if (extname(out).toLowerCase() !== ext) out = out.replace(/\.[^./]+$/, '') + ext;
    if (opts.count > 1) out = out.replace(/(\.[^.]+)$/, `-${n}$1`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(r.base64, 'base64'));
    console.log(`${out}  (${r.modelId}, tokens: ${r.usage?.totalTokenCount ?? '?'})`);
}
