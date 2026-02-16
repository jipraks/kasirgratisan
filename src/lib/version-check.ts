import { db } from './db';

const API_URL = 'https://api.kasirgratisan.com/v1/ping'; // configurable endpoint
const APP_VERSION = '1.0.0';
const TIMEOUT_MS = 5000;

export async function checkVersion(): Promise<void> {
  try {
    const settings = await db.storeSettings.toCollection().first();
    const deviceId = settings?.deviceId ?? 'unknown';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, currentVersion: APP_VERSION }),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch {
    // Silent fail — fire-and-forget
  }
}
