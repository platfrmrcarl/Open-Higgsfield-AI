// Local Gemini (Nano Banana) backend, served by the Vite dev middleware in
// vite.config.mjs. Enabled with `npm run gemini` (VITE_IMAGE_BACKEND=gemini).
export const GEMINI_MODE = import.meta.env.VITE_IMAGE_BACKEND === 'gemini';

async function generate(params) {
    const images = params.images_list?.length ? params.images_list : (params.image_url ? [params.image_url] : []);
    const res = await fetch('/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: params.prompt || '',
            model: params.model,
            aspectRatio: params.aspect_ratio,
            imageSize: params.resolution,
            images
        })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || `Gemini request failed (${res.status})`);
    return json;
}

export const gemini = {
    generateImage: generate,
    generateI2I: generate,
    uploadFile: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    })
};
