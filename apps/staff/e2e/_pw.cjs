// Resolves playwright-core from the repo if installed, else from the cloud
// verification environment. See e2e/README.md.
let pw;
try {
  pw = require('playwright-core');
} catch {
  pw = require('/tmp/node_modules/playwright-core');
}
module.exports = pw;
