import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { loadApiKey, generate } from './scripts/gemini-core.mjs';

const OUTPUT_DIR = resolve('output');

// Dev-only endpoint for `npm run gemini`: keeps GEMINI_API_KEY server-side and
// saves every generated image to output/ so it can be dropped into a game.
function geminiBackend() {
    return {
        name: 'gemini-backend',
        configureServer(server) {
            server.middlewares.use('/gemini/generate', (req, res) => {
                const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
                if (req.method !== 'POST') return send(405, { error: 'POST only' });
                let raw = '';
                req.on('data', chunk => { raw += chunk; });
                req.on('end', async () => {
                    try {
                        const body = JSON.parse(raw || '{}');
                        const images = (body.images || []).map(src => {
                            const local = String(src).match(/^\/gemini-output\/([^/?#]+)$/);
                            if (local) return { inlineData: { mimeType: 'image/png', data: readFileSync(resolve(OUTPUT_DIR, basename(local[1]))).toString('base64') } };
                            const m = String(src).match(/^data:([^;]+);base64,(.+)$/);
                            if (!m) throw new Error('Reference images must be uploaded files');
                            return { inlineData: { mimeType: m[1], data: m[2] } };
                        });
                        const r = await generate({ apiKey: loadApiKey(), prompt: body.prompt, model: body.model, aspectRatio: body.aspectRatio, imageSize: body.imageSize, images });
                        mkdirSync(OUTPUT_DIR, { recursive: true });
                        const name = `${Date.now()}.${r.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
                        writeFileSync(resolve(OUTPUT_DIR, name), Buffer.from(r.base64, 'base64'));
                        console.log(`[gemini] ${r.modelId} -> output/${name} (tokens: ${r.usage?.totalTokenCount ?? '?'})`);
                        send(200, { id: name, url: `/gemini-output/${name}` });
                    } catch (e) {
                        send(500, { error: e.message });
                    }
                });
            });
            server.middlewares.use('/gemini-output', (req, res, next) => {
                const file = resolve(OUTPUT_DIR, basename(decodeURIComponent(req.url.split('?')[0])));
                if (!existsSync(file)) return next();
                res.setHeader('Content-Type', file.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
                res.end(readFileSync(file));
            });
        }
    };
}

export default defineConfig({
    base: './',
    plugins: [
        tailwindcss(),
        geminiBackend(),
    ],
    server: {
        proxy: {
            '/api': {
                target: 'https://api.kie.ai',
                changeOrigin: true,
                secure: false
            },
            '/.netlify/functions': {
                target: 'https://higgsfield-matu.netlify.app',
                changeOrigin: true,
                secure: true
            },
            '/download-media': {
                target: 'https://higgsfield-matu.netlify.app',
                changeOrigin: true,
                secure: true
            }
        }
    }
});
