/**
 * Compress and resize an image file to a base64 data URL.
 * - Resizes proportionally so the longest side is max 800px
 * - Compresses as JPEG, reducing quality until ≤ maxSizeKB
 *
 * IMPORTANT: Every product photo upload MUST go through this function.
 */
export async function compressImage(file: File, maxSizeKB = 200): Promise<string> {
  const img = await loadImage(file);

  const maxDim = 800;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Compress iteratively
  let quality = 0.8;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  while (getBase64SizeKB(dataUrl) > maxSizeKB && quality > 0.1) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function getBase64SizeKB(dataUrl: string): number {
  // base64 string after the comma
  const base64 = dataUrl.split(',')[1] ?? '';
  return (base64.length * 3) / 4 / 1024;
}
