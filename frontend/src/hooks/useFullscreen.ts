"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  isFullscreenSupported,
} from "@/lib/fullscreen";

/** Subscribes to the browser's own fullscreen state. Stable across renders. */
function subscribe(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);

  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
  };
}

/** Whether fullscreen is available never changes after load, so nothing to watch. */
const noSubscription = () => () => {};

/** The server has no `document`; both values start false and correct on hydration. */
const serverSnapshot = () => false;

/**
 * Tracks fullscreen state and exposes toggles.
 *
 * The browser is the source of truth rather than React state: pressing Escape
 * leaves fullscreen without going through our code, so reading via
 * `useSyncExternalStore` keeps the UI honest where a `useState` mirror would
 * drift.
 */
export function useFullscreen() {
  const active = useSyncExternalStore(subscribe, isFullscreen, serverSnapshot);
  const supported = useSyncExternalStore(
    noSubscription,
    isFullscreenSupported,
    serverSnapshot,
  );

  const enter = useCallback(() => enterFullscreen(), []);
  const exit = useCallback(() => exitFullscreen(), []);
  const toggle = useCallback(
    () => (isFullscreen() ? exitFullscreen() : enterFullscreen()),
    [],
  );

  return { active, supported, enter, exit, toggle };
}
