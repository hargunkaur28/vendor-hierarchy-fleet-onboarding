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
  console.log('Launching headless Edge...');
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

  console.log('Connected to tab:', version.webSocketDebuggerUrl);
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

  console.log('Navigating to http://localhost:5173/team ...');
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

  // Find Move Profile button on Arunkumar QA or Demo Group Vendor
  console.log('Looking for Move Profile button...');
  const moveClick = await evaluate(`(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const arunBtn = allButtons.find(b => {
      if (!b.textContent.includes('Move Profile')) return false;
      const card = b.closest('div[role="treeitem"]') || b.closest('.bg-white') || b.parentElement;
      return card && card.textContent.includes('Arunkumar QA');
    });
    if (arunBtn) {
      arunBtn.scrollIntoView({ block: 'center', inline: 'center' });
      arunBtn.click();
      return 'clicked Arunkumar QA Move Profile';
    }
    return 'none';
  })()`);
  console.log('Move button click result:', moveClick);

  await sleep(600);

  // Capture Screen 2: Move Profile Modal
  console.log('Capturing Screen 2: Move Profile Modal...');
  await takeScreenshot('phase4_screen2_move_modal.png');

  // Open the Combobox INSIDE Dialog specifically
  console.log('Opening Combobox inside dialog...');
  const openedCombobox = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'dialog not found';
    const trigger = dialog.querySelector('button[aria-haspopup="listbox"]');
    if (!trigger) return 'combobox trigger inside dialog not found';
    trigger.click();
    return 'combobox inside dialog opened';
  })()`);
  console.log('Combobox open result:', openedCombobox);

  await sleep(600);

  // Capture Screen 3: Combobox Dropdown
  console.log('Capturing Screen 3: Combobox Dropdown...');
  await takeScreenshot('phase4_screen3_combobox_dropdown.png');

  // Select a new parent from combobox options
  console.log('Selecting new parent in combobox...');
  const selectedParent = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'no dialog';
    const options = Array.from(dialog.querySelectorAll('button[role="option"]'));
    if (options.length === 0) return 'no options';
    const opt = options.find(o => o.textContent.includes('DeepakTesting1')) || options[0];
    const text = opt.textContent;
    opt.click();
    return 'selected: ' + text;
  })()`);
  console.log('Parent selection result:', selectedParent);

  await sleep(500);

  // Click Move button in dialog
  console.log('Submitting Move in dialog...');
  const submitMove = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'no dialog';
    const moveBtn = Array.from(dialog.querySelectorAll('button[type="submit"]')).find(b => b.textContent.includes('Move'));
    if (moveBtn && !moveBtn.disabled) {
      moveBtn.click();
      return 'clicked Move submit';
    }
    return 'Move button disabled or not found';
  })()`);
  console.log('Submit Move result:', submitMove);

  // Wait for mock API roundtrip (approx 800ms) and modal to close
  await sleep(1500);

  // Capture Toast and Pulse state
  console.log('Capturing Toast notification and pulse ring...');
  await takeScreenshot('phase4_toast_and_pulse.png');

  // Click Undo in toast
  console.log('Testing Undo in toast...');
  const undoResult = await evaluate(`(() => {
    const toast = document.querySelector('[data-sonner-toast]');
    if (!toast) return 'toast element not found';
    const undoBtn = Array.from(toast.querySelectorAll('button')).find(b => b.textContent.trim() === 'Undo');
    if (undoBtn) {
      undoBtn.click();
      return 'clicked Undo button inside toast';
    }
    return 'Undo button not found inside toast';
  })()`);
  console.log('Undo result:', undoResult);

  await sleep(1200);
  await takeScreenshot('phase4_after_undo.png');

  // Open modal again on Demo Group Vendor and test Change Role mode
  console.log('Testing Change Role mode on Demo Group Vendor...');
  await evaluate(`(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const demoBtn = allButtons.find(b => {
      if (!b.textContent.includes('Move Profile')) return false;
      const card = b.closest('div[role="treeitem"]') || b.closest('.bg-white') || b.parentElement;
      return card && card.textContent.includes('Demo Group Vendor');
    });
    if (demoBtn) demoBtn.click();
  })()`);
  await sleep(600);

  const switchedRole = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'no dialog';
    const roleRadio = Array.from(dialog.querySelectorAll('input[type="radio"]')).find(r => r.value === 'role');
    if (roleRadio) {
      roleRadio.click();
      return 'switched to Change Role radio';
    }
    return 'role radio not found';
  })()`);
  console.log('Change role switch:', switchedRole);

  await sleep(500);
  await takeScreenshot('phase4_change_role_mode.png');

  ws.close();
  edge.kill();
  console.log('Phase 4 evidence script complete!');
}

main().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
