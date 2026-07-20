// Resolves playwright-core from the repo if installed, else from the cloud
// verification environment. See e2e/README.md.
let pw;
try {
  pw = require('playwright-core');
} catch {
  pw = require('/tmp/node_modules/playwright-core');
}

const fs = require('node:fs');

// Resolve a Chromium executable across the three environments this harness runs
// in, so no suite hardcodes a path:
//   1. KB_CHROME env override (run-all.cjs sets this once for all its children)
//   2. the cloud verification image's pinned build (/opt/pw-browsers)
//   3. whatever playwright-core resolved — CI installs it via `playwright install
//      chromium`, so its executablePath() points at ~/.cache/ms-playwright.
function resolveChrome() {
  if (process.env.KB_CHROME) {
    return process.env.KB_CHROME;
  }
  const cloud = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  try {
    if (fs.existsSync(cloud)) {
      return cloud;
    }
  } catch {
    /* fall through */
  }
  try {
    return pw.chromium.executablePath();
  } catch {
    return cloud;
  }
}

pw.resolveChrome = resolveChrome;
module.exports = pw;
