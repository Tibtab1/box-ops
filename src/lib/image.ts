// Client-side image compression. Turns big camera photos into a reasonable
// base64 data URL that fits under Vercel's 4.5 MB body limit when sent to
// the API. Target: max 1600px on the longest side, JPEG quality 0.82.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<string> {
  // Read the file into an Image element via object URL
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitInside(img.width, img.height, MAX_EDGE);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, width, height);

    // If original was already small and a photo, JPEG keeps size low.
    // For PNGs with transparency this still emits JPEG but that's OK for our use.
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function fitInside(
  w: number,
  h: number,
  maxEdge: number
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const ratio = Math.min(maxEdge / w, maxEdge / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/** Approximate bytes of a data URL (base64-encoded payload). */
export function dataUrlByteSize(dataUrl: string): number {
  const idx = dataUrl.indexOf(",");
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  // Base64 = 4 chars per 3 bytes
  return Math.round((b64.length * 3) / 4);
}
