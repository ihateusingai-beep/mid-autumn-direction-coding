#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, detail || ''); }
}

ok('S1 title', /中秋方向編程/.test(html));
ok('S2 themes', /data-theme="neko"/.test(html) && /data-theme="mario"/.test(html));
ok('S3 three diffs', /data-diff="easy"/.test(html) && /data-diff="mid"/.test(html) && /data-diff="hard"/.test(html));
ok('S4 screen-diff', /id="screen-diff"/.test(html));
ok('S5 PACKS', /const PACKS/.test(html));
ok('S6 easy F only', /key: 'easy'[\s\S]*?cmds: \['F'\]/.test(html));
ok('S7 no bare input', !/<input(?![^>]*type="hidden")/i.test(html));
ok('S8 touch', /touch-action:\s*manipulation/.test(html));
ok('S9 sfx', /function beep\(/.test(html));
ok('S10 keep retry', /loadLevel\(state\.levelIdx, true\)/.test(html));

const m = html.match(/<script>([\s\S]*?)<\/script>/);
ok('S11 script', !!m);

if (m) {
  const dom = {
    data: {},
    getElementById(id) {
      if (!this.data[id]) {
        this.data[id] = {
          id, style: {}, className: '', value: '', innerHTML: '', textContent: '', disabled: false,
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
          appendChild(c) { this.children.push(c); return c; },
          querySelector() { return null; },
          setAttribute() {},
          animate() { return { onfinish: null }; },
          remove() {},
        };
      }
      return this.data[id];
    },
    querySelectorAll(sel) {
      if (sel === '.screen' || sel === '.theme-card' || sel === '.diff-card') return [];
      if (sel === '.controls') return [this.getElementById('controls_fake')];
      return [];
    },
    createElement() { return this.getElementById('el_' + Math.random().toString(36).slice(2)); },
    querySelector(sel) {
      if (sel === '.controls') return this.getElementById('controls_fake');
      return null;
    },
  };

  const sandbox = {
    window: { speechSynthesis: null, DirCoding: null, AudioContext: null, webkitAudioContext: null },
    document: dom,
    localStorage: { getItem() { return null; }, setItem() {} },
    console, setTimeout, clearTimeout, Math, Promise,
  };
  sandbox.window.document = dom;
  try {
    vm.runInNewContext(m[1], sandbox, { timeout: 4000 });
    const DC = sandbox.window.DirCoding;
    ok('L0 exists', !!DC);
    if (DC) {
      // easy
      DC.setDiff('easy');
      DC.loadLevel(0);
      ok('E1 levels 4', DC.getLevels().length === 4);
      ok('E2 L1 F win', DC.simulate(['F']) === 'win');
      DC.loadLevel(1);
      ok('E3 L2 FF win', DC.simulate(['F', 'F']) === 'win');
      ok('E4 pack cmds F only', DC.getPack().cmds.join() === 'F');

      // mid
      DC.setDiff('mid');
      DC.loadLevel(0);
      ok('M1 levels 6', DC.getLevels().length === 6);
      ok('M2 L1 F', DC.simulate(['F']) === 'win');
      DC.loadLevel(3);
      ok('M3 L4 B', DC.simulate(['B']) === 'win');
      DC.loadLevel(5);
      ok('M4 L6 FF miss', ['miss', 'fail'].includes(DC.simulate(['F', 'F'])));

      // hard
      DC.setDiff('hard');
      DC.loadLevel(0);
      ok('H1 levels 8', DC.getLevels().length === 8);
      ok('H2 L1 FFFF', DC.simulate(['F', 'F', 'F', 'F']) === 'win');
      DC.loadLevel(3); // facing 3
      ok('H3 face left FFF', DC.simulate(['F', 'F', 'F']) === 'win');
      DC.loadLevel(6);
      ok('H4 exact FF', DC.simulate(['F', 'F']) === 'win');
      ok('H5 overshoot', ['miss', 'fail'].includes(DC.simulate(['F', 'F', 'F'])));
    }
  } catch (e) {
    ok('L0 vm', false, String(e && e.stack || e));
  }
}

console.log('---');
console.log(passed + ' passed,', failed + ' failed');
process.exit(failed ? 1 : 0);
