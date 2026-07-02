/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build stamp injected at build time (see vite.config define). Shown on Setup so
// the owner can confirm which build a device is running.
declare const __APP_BUILD__: string;
