/**
 * Thin wrapper over the Fullscreen API.
 *
 * Browsers only honour `requestFullscreen()` while a user gesture is still
 * active, so `enterFullscreen` must be called synchronously inside a click
 * handler — not after an `await`, and not from an effect on mount.
 *
 * Every call is best-effort: a rejected request (no gesture, an iframe without
 * `allowfullscreen`, a browser that refuses) resolves quietly rather than
 * throwing, because failing to go fullscreen must never block an exam.
 */

type VendorElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type VendorDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

export function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as VendorDocument;
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as VendorDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  if (typeof document === "undefined" || isFullscreen()) return;

  const element = document.documentElement as VendorElement;
  const request = element.requestFullscreen ?? element.webkitRequestFullscreen;
  if (!request) return;

  try {
    await request.call(element);
  } catch {
    // Denied — Safari on iPhone has no element fullscreen at all, and any
    // browser refuses without a gesture. The exam works either way.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === "undefined" || !isFullscreen()) return;

  const doc = document as VendorDocument;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  if (!exit) return;

  try {
    await exit.call(doc);
  } catch {
    // Nothing useful to do; the user can always press Escape.
  }
}
