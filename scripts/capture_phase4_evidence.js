import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity-ide/brain/891a4958-04e2-470d-a7d3-660a7680dadd';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    '--user-data-dir=' + path.join(ARTIFACT_DIR, 'scratch', 'edge-profile'),
    'about:blank',
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const tabs = await res.json();
      if (tabs.length > 0) {
        version = tabs[0];
        break;
      }
    } catch {
      // retry
    }
  }

  if (!version) {
    console.error('Failed to connect to Edge remote debugging port');
    edge.kill();
    return;
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:5173/team' });
  await sleep(3500);

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result?.value;
  }

  async function takeScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  }

  // Click Move Profile specifically on Demo Sub Vendor 1 or Demo Vendor Supervisor
  const clickResult = await evaluate(`(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const target = allButtons.find(b => {
      if (!b.textContent.includes('Move Profile')) return false;
      const card = b.closest('div[role="treeitem"]') || b.closest('.bg-white') || b.parentElement;
      return card && (card.textContent.includes('Demo Sub Vendor 1') || card.textContent.includes('Demo Sub Vendor'));
    });
    if (target) {
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.click();
      return 'clicked Demo Sub Vendor';
    }
    // Fallback: any sub vendor
    const anySub = allButtons.find(b => {
      const card = b.closest('div[role="treeitem"]');
      return b.textContent.includes('Move Profile') && card && card.getAttribute('aria-label')?.includes('Sub Vendor');
    });
    if (anySub) {
      anySub.click();
      return 'clicked fallback sub vendor';
    }
    return 'none';
  })()`);
  console.log('Sub vendor move click:', clickResult);

  await sleep(600);

  // Switch to Change Role mode
  await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const roleRadio = Array.from(dialog.querySelectorAll('input[type="radio"]')).find(r => r.value === 'role');
    if (roleRadio) roleRadio.click();
  })()`);

  await sleep(500);

  // Check role options in select
  const options = await evaluate(`(() => {
    const select = document.querySelector('#new-role-select');
    if (!select) return [];
    return Array.from(select.querySelectorAll('option')).map(o => ({ value: o.value, text: o.textContent }));
  })()`);
  console.log('Available options in Select New Role dropdown:', options);

  // Select Deployment Associate
  await evaluate(`(() => {
    const select = document.querySelector('#new-role-select');
    if (select) {
      select.value = 'DEPLOYMENT_ASSOCIATE';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);

  await sleep(600);

  // Take screenshot showing pre-filtered role and child conflict banner
  await takeScreenshot('phase4_change_role_subvendor_fixed.png');

  ws.close();
  edge.kill();
  console.log('Capture script finished!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
