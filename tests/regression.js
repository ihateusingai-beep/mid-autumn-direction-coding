#!/usr/bin/env node
/**
 * Structural + logic regression for direction-coding MVP
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('PASS', name);
  } else {
    failed++;
    console.log('FAIL', name, detail || '');
  }
}

// Structural
ok('S1 has index title 中秋', /中秋方向編程/.test(html));
ok('S2 themes neko+mario', /data-theme="neko"/.test(html) && /data-theme="mario"/.test(html));
ok('S3 cmds 前後走', /id="btn-f"/.test(html) && /id="btn-b"/.test(html) && /id="btn-go"/.test(html));
ok('S4 no system input', !/<input(?![^>]*type="hidden")/i.test(html));
ok('S5 MAX_STEPS 6', /MAX_STEPS = 6/.test(html));
ok('S6 LEVELS 6', (html.match(/id: [1-6]/g) || []).length >= 6);
ok('S7 original SVG not external mario art', !/nintendo|official.*mario|doraemon\.com/i.test(html));
ok('S8 touch manipulation', /touch-action:\s*manipulation/.test(html));
ok('S9 teacher panel', /id="teacher-panel"/.test(html));
ok('S12 sfx beep helpers', /function beep\(/.test(html) && /SFX/.test(html));
ok('S13 starCount', /function starCount\(/.test(html));
ok('S14 coach', /id="coach"/.test(html));
ok('S15 keep program retry', /loadLevel\(state\.levelIdx, true\)/.test(html));

// Extract script and run simulate logic in vm
const m = html.match(/<script>([\s\S]*?)<\/script>/);
ok('S11 inline script', !!m);
if (m) {
  const dom = {
    data: {},
    getElementById(id) {
      if (!this.data[id]) {
        const el = {
          id,
          style: {},
          classList: {
            _s: new Set(),
            add(c) { this._s.add(c); },
            remove(c) { this._s.delete(c); },
            toggle(c, on) {
              if (on === false) this._s.delete(c);
              else if (on === true) this._s.add(c);
              else if (this._s.has(c)) this._s.delete(c); else this._s.add(c);
            },
            contains(c) { return this._s.has(c); },
          },
          children: [],
          innerHTML: '',
          textContent: '',
          value: '',
          disabled: false,
          onclick: null,
          onchange: null,
          appendChild(c) { this.children.push(c); return c; },
          querySelector() { return null; },
          setAttribute() {},
          animate() { return { onfinish: null }; },
          remove() {},
        };
        this.data[id] = el;
      }
      return this.data[id];
    },
    querySelectorAll(sel) {
      if (sel === '.screen') return [];
      if (sel === '.theme-card') return [];
      return [];
    },
    createElement(tag) {
      return this.getElementById('el_' + Math.random().toString(36).slice(2));
    },
  };

  const sandbox = {
    window: { speechSynthesis: null, DirCoding: null },
    document: dom,
    localStorage: { getItem() { return null; }, setItem() {} },
    speechSynthesis: null,
    console,
    setTimeout,
    clearTimeout,
    Math,
    Promise,
  };
  sandbox.window.document = dom;
  sandbox.global = sandbox;
  try {
    vm.runInNewContext(m[1], sandbox, { timeout: 3000 });
    const DC = sandbox.window.DirCoding;
    ok('L1 DirCoding exists', !!DC);
    if (DC) {
      // Level 1: F -> win
      DC.loadLevel(0);
      ok('L2 level1 F win', DC.simulate(['F']) === 'win');
      // Level 2: FF win
      DC.loadLevel(1);
      ok('L3 level2 FF win', DC.simulate(['F', 'F']) === 'win');
      ok('L4 level2 F miss', DC.simulate(['F']) === 'miss');
      // Level 3: FFF
      DC.loadLevel(2);
      ok('L5 level3 FFF win', DC.simulate(['F', 'F', 'F']) === 'win');
      // Level 4: B
      DC.loadLevel(3);
      ok('L6 level4 B win', DC.simulate(['B']) === 'win');
      ok('L7 level4 F fail/miss', ['fail', 'miss'].includes(DC.simulate(['F'])));
      // Level 5: BB
      DC.loadLevel(4);
      ok('L8 level5 BB win', DC.simulate(['B', 'B']) === 'win');
      // Level 6: only one F; FF overshoots → miss (or fail if OOB)
      DC.loadLevel(5);
      ok('L9 level6 F win', DC.simulate(['F']) === 'win');
      ok('L10 level6 FF miss/fail', ['miss', 'fail'].includes(DC.simulate(['F', 'F'])));
      // theme switch doesn't break
      DC.state.theme = 'mario';
      DC.loadLevel(0);
      ok('L11 mario theme L1', DC.simulate(['F']) === 'win');
    }
  } catch (e) {
    ok('L0 vm run', false, String(e && e.stack || e));
  }
}

console.log('---');
console.log(passed + ' passed,', failed + ' failed');
process.exit(failed ? 1 : 0);
