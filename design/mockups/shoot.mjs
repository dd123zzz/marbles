// Throwaway screenshot driver: headless Chrome over raw CDP (no dependencies; Node 22+ has global WebSocket).
// Usage: node design/mockups/shoot.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'screens');
mkdirSync(out, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const DPR = 2;

const profile = mkdtempSync(join(tmpdir(), 'marbles-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-gpu',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForChrome() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome did not start');
}

try {
  await waitForChrome();
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

  await send('Page.enable');
  const shots = [];
  for (const name of ['sorbet', 'cloud', 'gelato']) {
    const url = (view) => `file://${join(here, name + '.html')}?view=${view}`;
    const jobs = [
      ['light', `${name}-light.png`, 390, 844],
      ['dark', `${name}-dark.png`, 390, 844],
      ['light-full', `${name}-light-full.png`, 390, 844],
      ['dark-full', `${name}-dark-full.png`, 390, 844],
      ['both', `${name}-both.png`, 900, 900],
    ];
    for (const [view, file, w, h] of jobs) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: false });
      await send('Page.navigate', { url: url(view) });
      await sleep(500);
      const rect = await evalJs(
        `(()=>{const r=document.querySelector('.page').getBoundingClientRect();return {x:0,y:0,w:Math.ceil(r.width),h:Math.ceil(document.documentElement.scrollHeight)}})()`,
      );
      let clip;
      if (view === 'light' || view === 'dark') clip = { x: 0, y: 0, width: 390, height: 844, scale: 1 };
      else if (view.endsWith('full')) clip = { x: 0, y: 0, width: 390, height: rect.h, scale: 1 };
      else {
        const box = await evalJs(`(()=>{const r=document.querySelector('.phones').getBoundingClientRect();return {w:Math.ceil(r.width),h:Math.ceil(r.height)}})()`);
        clip = { x: 0, y: 0, width: Math.max(box.w + 64, 0), height: box.h + 56 + 24, scale: 1 };
        await send('Emulation.setDeviceMetricsOverride', { width: clip.width, height: clip.height, deviceScaleFactor: DPR, mobile: false });
        await sleep(200);
      }
      const { data } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
      writeFileSync(join(out, file), Buffer.from(data, 'base64'));
      shots.push(`${file} ${clip.width}x${clip.height}@${DPR}x`);
    }
  }
  await send('Emulation.clearDeviceMetricsOverride');
  console.log(shots.join('\n'));
  ws.close();
} finally {
  chrome.kill();
}
