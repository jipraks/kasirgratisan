import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import i18n from '@/i18n';

/**
 * Converts an ArrayBuffer to a Base64 string safely without causing stack overflow on large files.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000; // Chunk size to avoid "Maximum call stack size exceeded"
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface SaveAndShareOptions {
  fileName: string;
  dialogTitle?: string;
  shareTitle?: string;
  shareText?: string;
  mimeType?: string;
}

/**
 * Downloads a file on the web, or saves and shares it using native share sheet on Capacitor Android/iOS.
 * This bypasses WebView download restrictions on Android.
 *
 * @param data ArrayBuffer, ArrayBufferView (like Uint8Array), data URL string (e.g. image/png;base64), or normal text string
 * @param options configuration options for sharing/downloading
 */
export async function downloadOrShareFile(
  data: ArrayBuffer | ArrayBufferView | string,
  options: SaveAndShareOptions
): Promise<void> {
  const {
    fileName,
    dialogTitle = i18n.t('files.saveShareTitle', { ns: 'common' }) as string,
    shareTitle = i18n.t('files.shareTitle', { ns: 'common' }) as string,
    shareText = fileName,
    mimeType = 'application/octet-stream',
  } = options;

  let normalizedData = data;
  if (ArrayBuffer.isView(normalizedData)) {
    // Extract ArrayBuffer correctly from views like Uint8Array
    normalizedData = normalizedData.buffer.slice(
      normalizedData.byteOffset,
      normalizedData.byteOffset + normalizedData.byteLength
    );
  }

  if (Capacitor.isNativePlatform()) {
    let base64Data = '';
    let isUtf8 = false;

    if (normalizedData instanceof ArrayBuffer) {
      base64Data = arrayBufferToBase64(normalizedData);
    } else if (typeof normalizedData === 'string' && normalizedData.startsWith('data:')) {
      // Data URL (e.g., data:image/png;base64,...)
      const commaIndex = normalizedData.indexOf(',');
      if (commaIndex !== -1) {
        base64Data = normalizedData.substring(commaIndex + 1);
      } else {
        base64Data = normalizedData;
      }
    } else if (typeof normalizedData === 'string') {
      // Plain text (e.g. JSON backup)
      base64Data = normalizedData;
      isUtf8 = true;
    }

    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      ...(isUtf8 ? { encoding: Encoding.UTF8 } : {}),
    });

    await Share.share({
      title: shareTitle,
      text: shareText,
      url: result.uri,
      dialogTitle: dialogTitle,
    });
    return;
  }

  // Web fallback: download using standard browser anchor tag
  let blob: Blob;
  if (normalizedData instanceof ArrayBuffer) {
    blob = new Blob([normalizedData], { type: mimeType });
  } else if (typeof normalizedData === 'string' && normalizedData.startsWith('data:')) {
    const response = await fetch(normalizedData);
    blob = await response.blob();
  } else {
    blob = new Blob([normalizedData], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
