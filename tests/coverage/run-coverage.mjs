#!/usr/bin/env node
// @ts-check
/**
 * Collect V8 JS coverage by launching a Chromium instance, navigating
 * to the app, exercising all JS modules, and converting the result to
 * Istanbul text + lcov reports under coverage/.
 *
 * Starts its own static file server on port 3001 so it can run
 * independently of the main test suite.
 *
 * Usage:  node tests/coverage/run-coverage.js
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import v8toIstanbul from 'v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'coverage');
const PORT = 3001;
const BASE = `http://localhost:${PORT}`;
const INCLUDE_PREFIX = `${BASE}/js/`;

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['serve', '.', '-p', String(PORT), '-L'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15000);
    proc.stdout.on('data', (data) => {
      if (data.toString().includes('Accepting connections')) {
        clearTimeout(timeout);
        resolve(proc);
      }
    });
    proc.stderr.on('data', (data) => {
      if (data.toString().includes('Accepting connections')) {
        clearTimeout(timeout);
        resolve(proc);
      }
    });
    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

async function main() {
  console.log('Starting server...');
  const server = await startServer();

  try {
    console.log('Launching browser for coverage collection...');
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.coverage.startJSCoverage({ resetOnNavigation: false });

    await page.goto(BASE);
    await page.evaluate(() => localStorage.setItem('kpc-disclaimer-accepted', 'true'));
    await page.reload();

    // Force-import all JS modules so they appear in coverage
    await page.evaluate(async () => {
      await import('/js/engine/Board.js');
      await import('/js/engine/Move.js');
      await import('/js/engine/Rules.js');
      await import('/js/engine/GameState.js');
      await import('/js/engine/AI.js');
      await import('/js/engine/Evaluator.js');
      await import('/js/engine/fen.js');
      await import('/js/engine/uciMatch.js');
      await import('/js/utils/html-sanitizer.js');
      await import('/js/storage.js');
      await import('/js/Game.js');
    });

    // Exercise core flows to get meaningful branch/function coverage
    await page.click('#new-game-btn');
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.click('.chess-square[data-square="e2"]');
    await page.click('.chess-square[data-square="e4"]');
    await page.waitForTimeout(2000);

    const coverage = await page.coverage.stopJSCoverage();
    await browser.close();

    // Convert to Istanbul
    const coverageMap = libCoverage.createCoverageMap({});

    for (const entry of coverage) {
      if (!entry.url || !entry.url.startsWith(INCLUDE_PREFIX)) continue;
      const relativePath = entry.url.replace(`${BASE}/`, '');
      const absolutePath = path.join(ROOT, relativePath);
      if (!fs.existsSync(absolutePath)) continue;

      const converter = v8toIstanbul(absolutePath, 0, { source: entry.source });
      await converter.load();
      converter.applyCoverage(entry.functions);
      coverageMap.merge(converter.toIstanbul());
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const ctx = libReport.createContext({
      dir: OUT_DIR,
      coverageMap,
      watermarks: {
        statements: [50, 80],
        branches: [50, 80],
        functions: [50, 80],
        lines: [50, 80],
      },
    });

    for (const name of ['text', 'lcov', 'json-summary']) {
      reports.create(name).execute(ctx);
    }

    console.log('\nCoverage report written to coverage/');
  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
