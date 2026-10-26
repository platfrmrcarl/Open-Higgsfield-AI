// Google Gemini image generation ("Nano Banana") over the REST API. No deps.
import { readFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';

export const GEMINI_MODELS = {
    'nano-banana': 'gemini-2.5-flash-image',
    'nano-banana-pro': 'gemini-3-pro-image-preview',
};

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export function loadApiKey(root = process.cwd()) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    for (const file of ['.env.local', '.env']) {
        const path = resolve(root, file);
        if (!existsSync(path)) continue;
        const match = readFileSync(path, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)/m);
        if (match) return match[1].trim();
    }
    throw new Error('GEMINI_API_KEY not set (env, .env.local or .env)');
}

export function resolveModel(id = 'nano-banana') {
    const key = Object.keys(GEMINI_MODELS).find(k => String(id).includes(k) && (k !== 'nano-banana' || !String(id).includes('pro')));
    return GEMINI_MODELS[key] || (String(id).startsWith('gemini-') ? id : GEMINI_MODELS['nano-banana']);
}

export function fileToPart(path) {
    const mimeType = MIME[extname(path).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported reference image type: ${path}`);
    return { inlineData: { mimeType, data: readFileSync(path).toString('base64') } };
}

// images: array of { inlineData: { mimeType, data } }
export async function generate({ apiKey, prompt, model, aspectRatio, imageSize, images = [] }) {
    const modelId = resolveModel(model);
    const imageConfig = {};
    if (aspectRatio && aspectRatio !== 'auto') imageConfig.aspectRatio = aspectRatio;
    if (imageSize && modelId.includes('pro')) imageConfig.imageSize = String(imageSize).toUpperCase();
    const body = {
        contents: [{ role: 'user', parts: [...images, { text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
    };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error?.message || `Gemini request failed (${res.status})`);
    const parts = json.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData?.data);
    if (!img) throw new Error(`No image returned (${json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || 'unknown'})`);
    return { modelId, mimeType: img.inlineData.mimeType, base64: img.inlineData.data, usage: json.usageMetadata };
}
