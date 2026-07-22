// One command to run the whole demo-mode e2e harness (L2 in the verification
// plan): build must have run first (serves apps/staff/dist), then this boots a
// preview server, runs every suite against it, and aggregates pass/fail.
//
//   pnpm e2e            # from repo root (builds, then runs this)
//   node e2e/run-all.cjs   # if dist is already built
//
// Exit code is 0 only if every suite passes. A suite "fails" if it exits non-zero
// OR prints a `FAIL` line — the four ledger suites (checkin_multi/minor/interact/
// roundtrip) exit 0 even when a check fails, so output must be scanned too.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { resolveChrome } = require('./_pw.cjs');

const STAFF_DIR = path.join(__dirname, '..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

// Order: crash-sweep and core regression first, then the focused suites.
const ALL_SUITES = [
  'sweep.cjs',
  'sim_verify.cjs',
  'owner_shift.cjs',
  'login_stamp.cjs',
  'checkin_multi.cjs',
  'minor.cjs',
  'interact.cjs',
  'roundtrip.cjs',
  'shift_end.cjs',
  'checkin_undecided.cjs',
  'calendar.cjs',
  'shift_plan.cjs',
  'bento.cjs',
];

// KB_E2E_ONLY=owner_shift.cjs,login_stamp.cjs runs a subset (CI debugging / quick
// checks); default runs everything.
const SUITES = process.env.KB_E2E_ONLY
  ? process.env.KB_E2E_ONLY.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ALL_SUITES;

function waitForServer(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`preview did not come up within ${timeoutMs}ms`));
        } else {
          setTimeout(tick, 300);
        }
      });
    };
    tick();
  });
}

function runSuite(file, env) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, file)], {
      cwd: STAFF_DIR,
      env,
    });
    let out = '';
    const capture = (chunk) => {
      const text = chunk.toString();
      out += text;
      // stderr is unbuffered: keeps live progress readable even when a parent
      // wrapper signals the process group (and streams in CI logs).
      process.stderr.write(text);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('close', (code) => {
      // Case-sensitive FAIL: matches the suites' "FAIL — <name>" checks but not
      // console noise like "Failed to load resource". Also catch sweep's own
      // regression markers — it exits 0 and never prints "FAIL", so a blank or
      // content-missing route would otherwise slip through as a pass.
      const failed = code !== 0 || /\bFAIL\b/.test(out) || /NEAR-BLANK|EXPECT-MISSING/.test(out);
      resolve({ file, ok: !failed, code });
    });
    child.on('error', (err) => {
      process.stdout.write(`  spawn error: ${err.message}\n`);
      resolve({ file, ok: false, code: -1 });
    });
  });
}

(async () => {
  const distIndex = path.join(STAFF_DIR, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error('dist/ not found — run `pnpm --filter @kraft-base/staff build` first.');
    process.exit(1);
  }

  const chrome = resolveChrome();
  console.error(`Chromium: ${chrome}`);
  const env = { ...process.env, KB_CHROME: chrome };

  console.error(`Starting preview on ${BASE} …`);
  // Spawn vite directly (not via `pnpm exec`) as a detached process group. The
  // pnpm wrapper leaves the real vite server orphaned when killed, which holds
  // the port and the parent's stdio pipes open — the process then gets signalled
  // and its buffered output is lost. Detached + group-kill tears the whole tree
  // down cleanly so this process can exit normally.
  // vite@6's exports map does not expose ./bin/vite.js, so resolve the package
  // root (./package.json IS exported) and join the bin path from there.
  const vitePkg = require.resolve('vite/package.json', { paths: [STAFF_DIR] });
  const viteBin = path.join(path.dirname(vitePkg), 'bin', 'vite.js');
  const preview = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: STAFF_DIR, env, detached: true },
  );
  let previewExited = false;
  preview.on('close', (code) => {
    previewExited = true;
    if (code) console.error(`preview exited early with code ${code}`);
  });
  preview.stderr.on('data', (c) => {
    const t = c.toString();
    if (/error|EADDRINUSE/i.test(t)) process.stderr.write(`[preview] ${t}`);
  });

  const stop = () => {
    if (previewExited) return;
    try {
      process.kill(-preview.pid, 'SIGTERM'); // kill the whole group (vite + children)
    } catch {
      preview.kill('SIGTERM');
    }
  };

  try {
    await waitForServer(BASE, 30_000);
  } catch (err) {
    console.error(err.message);
    stop();
    process.exit(1);
  }

  const results = [];
  for (const suite of SUITES) {
    console.error(`\n===== ${suite} =====`);
    results.push(await runSuite(suite, env));
    if (previewExited) {
      console.error('preview died mid-run — aborting.');
      break;
    }
  }

  stop();

  const passed = results.filter((r) => r.ok).length;
  console.error('\n──────── e2e summary ────────');
  for (const r of results) {
    console.error(`  ${r.ok ? 'PASS' : 'FAIL'} — ${r.file}${r.ok ? '' : ` (exit ${r.code})`}`);
  }
  console.error(`\nRESULT: ${passed}/${SUITES.length} suites passed`);
  process.exit(passed === SUITES.length ? 0 : 1);
})();
