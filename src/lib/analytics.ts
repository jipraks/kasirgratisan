// Google Analytics 4 (gtag.js) — thin wrapper.
//
// Design goals (mirrors version-check.ts):
//   * Fire-and-forget, never throws into the app.
//   * No-op when no measurement ID is configured (dev / build without env).
//   * Respects the user's opt-out preference stored in localStorage.
//   * Sends event names + non-sensitive params only — NEVER product names,
//     prices, or transaction amounts.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const OPT_OUT_KEY = 'kg_analytics_opt_out';

let initialized = false;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** True when the user has explicitly opted out of analytics. Default: tracking on. */
export function isAnalyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Convenience inverse used by the Settings toggle. */
export function isAnalyticsEnabled(): boolean {
  return !isAnalyticsOptedOut();
}

/** Persist the user's choice. Enabling (re)inits gtag; disabling stops further sends. */
export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.removeItem(OPT_OUT_KEY);
      initAnalytics();
    } else {
      localStorage.setItem(OPT_OUT_KEY, '1');
    }
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

/** Whether analytics is actually able to run (configured + opted in + browser). */
function canTrack(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!MEASUREMENT_ID &&
    !isAnalyticsOptedOut()
  );
}

/** Inject gtag.js once and configure it. Safe to call multiple times. */
export function initAnalytics(): void {
  try {
    if (initialized || !canTrack()) return;
    initialized = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    // Disable automatic page_view — we send them manually on route change
    // so SPA navigation is captured correctly.
    window.gtag('config', MEASUREMENT_ID, { send_page_view: false });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  } catch {
    // Silent fail — analytics must never break the app.
  }
}

/** Send a SPA page_view for the given path. */
export function trackPageView(path: string): void {
  try {
    if (!canTrack() || typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.origin + path,
      page_title: document.title,
    });
  } catch {
    // Silent fail
  }
}

/** Send a custom event. Only pass non-sensitive params. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  try {
    if (!canTrack() || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params ?? {});
  } catch {
    // Silent fail
  }
}
