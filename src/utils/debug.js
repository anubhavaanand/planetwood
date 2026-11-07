/**
 * Shared debug logger that only logs in development mode.
 * Automatically gated on import.meta.env.DEV so console statements
 * are stripped out of production builds.
 */

export function debugLog(...args) {
  if (import.meta.env?.DEV) {
    console.log(...args);
  }
}

export function debugWarn(...args) {
  if (import.meta.env?.DEV) {
    console.warn(...args);
  }
}

export function debugError(...args) {
  if (import.meta.env?.DEV) {
    console.error(...args);
  }
}
