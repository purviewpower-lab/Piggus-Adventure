// Piggus Adventure automatic checker.
// Plays every level in a hidden browser and writes a report, so James only needs to
// play the levels a change actually touched.
//
//   node check-game.mjs                       check the latest game, compare with the newest backup in older/
//   node check-game.mjs NEW.html OLD.html     check NEW, compare with OLD
//   node check-game.mjs NEW.html --no-compare
//
// What it does, for the game file being checked:
//   1. Loads it and watches for any script error the whole time.
//   2. Checks the settings James wants kept (SHARPNESS = 1.2, 15 levels).
//   3. "Whole game" run: a robot plays from Level 1 to the end with Piggus unable to get hurt,
//      going through the real level-complete, Buffet and boss screens, to prove every level
//      can still be finished and moves on to the next one.
//   4. "Real" run on each level: a robot plays for about a minute with no cheats, so Piggus
//      gets caught, crashes and restarts, which exercises all the oops/retry code.
//   5. Takes pictures of each level and, with the random numbers fixed, compares them with the
//      older file to say which levels look different (those are the ones worth playing).
// Results go in report/ next to this file: report.html (open in a browser) and summary.txt.

import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const noCompare = args.includes('--no-compare');
const files = args.filter(a => !a.startsWith('--'));
const NEW = path.resolve(files[0] || path.join(GAME_DIR, 'Piggus-Adventure.html'));
function newestBackup() {
  const dir = path.join(GAME_DIR, 'older');
  const v = fs.readdirSync(dir).map(f => [f, +(f.match(/-v(\d+)\.html$/) || [])[1]]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  return v.length ? path.join(dir, v[0][0]) : null;
}
const OLD = noCompare ? null : files[1] ? path.resolve(files[1]) : newestBackup();
const OUT = path.join(HERE, 'report');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'pictures'), { recursive: true });

// ---------- runs inside the game page ----------
function installTester() {
  const T0 = window.PT = { deaths: [], log: [] };
  const realDie = die, realHurt = hurtPig;
  T0.god = on => {
    die = on ? (k => { T0.deaths.push(k); }) : (k => { T0.deaths.push(k); return realDie(k); });
    hurtPig = on ? (() => {}) : (() => { if (bs && bs.inv <= 0) T0.deaths.push('boss hit'); return realHurt(); });
    T0.godOn = on;
  };
  let mv = { vdir: -1, wait: 0, cd: 0, held: 0 };
  const clearHeld = () => { for (const k in held) held[k] = 0; };
  T0.reset = () => { mv = { vdir: -1, wait: 0, cd: 0, held: 0 }; clearHeld(); };
  // one robot for every kind of screen
  T0.bot = () => {
    const god = T0.godOn;
    if (state === 'title') { act(1, 0); return; }
    if (state === 'strength') { if (fr % 3 === 0) mash(); return; }
    if (state === 'level') { if (fr - t0 > 41) act(1, 0); return; }
    if (state === 'won') return;
    if (state === 'buffet') {
      if (bf.phase === 'end') { if (fr - bf.t > 61) anyPress(); return; }
      if (fr % 30 === 0) { clearHeld(); const r = Math.random(); if (r < .4) held.ArrowLeft = 1; else if (r < .8) held.ArrowRight = 1; }
      if (fr % 45 === 0) bJump();
      return;
    }
    if (state === 'boss') {
      const b = bs; if (!b) return;
      if (b.phase === 'lose') { if (fr - b.t > 51) bossKey('Space'); return; }
      if (b.phase === 'defeat') { if (fr - b.t > 201) bossKey('Space'); return; }
      if (b.phase === 'won') { return; }
      if (b.phase !== 'fight') return;
      const c = b.cp; held.ArrowLeft = held.ArrowRight = 0;
      const dx = c.x - b.px;
      if (c.mode === 'tired') {
        if (Math.abs(dx) > 6) held[dx > 0 ? 'ArrowRight' : 'ArrowLeft'] = 1;
        if (Math.abs(dx) < 90 && b.py >= GROUND - .5) bossKey('Space');
      } else if (Math.abs(dx) < 170) held[dx < 0 ? 'ArrowRight' : 'ArrowLeft'] = 1;
      if (!god && b.proj.length && b.py >= GROUND - .5 && fr % 20 === 0) bossKey('Space');
      return;
    }
    if (typeof pl !== 'undefined' && pl) { // the hop across the swamp at the end of the harder Dino Jungle level
      if (state === 'ready') { act(1, 0); return; }
      if (state === 'dead') { if (fr - t0 > 31) act(1, 0); return; }
      if (state !== 'play') return;
      const P = pl.p; held.ArrowLeft = held.ArrowRight = 0;
      if (mv.held > 0 && --mv.held === 0) held.Space = 0;
      if (!god && Math.random() < .02) { if (Math.random() < .5) { pl.buf = 8; held.Space = 1; mv.held = 20; } held.ArrowRight = 1; return; }
      const ahead = pl.list.filter(o => o !== P.on && o.s.x1 > P.x + 20 && o.s.x0 > P.x - 60).sort((a, b) => a.s.x0 - b.s.x0);
      const tgt = !P.ground && mv.tgt ? mv.tgt : ahead[0];
      if (!tgt) { held.ArrowRight = 1; return; }
      if (P.ground) {
        const gap = tgt.s.x0 - P.x, up = P.y - tgt.s.top;
        if (gap < 140 && gap > -30 && up < 160 && up > -150) { pl.buf = 8; held.Space = 1; mv.held = 20; held.ArrowRight = 1; mv.tgt = tgt; }
        else if (P.x < P.on.s.x1 - 24) held.ArrowRight = 1;
      } else { const mid = (tgt.s.x0 + tgt.s.x1) / 2; if (P.x < mid - 6) held.ArrowRight = 1; else if (P.x > mid + 6 && P.y > tgt.s.top - 60) held.ArrowLeft = 1; }
      return;
    }
    if (run) { // Super Snoutmarket side-scroller
      if (state === 'ready') { runAct(); return; }
      if (state === 'dead') { if (fr - t0 > 31) runAct(); return; }
      if (state !== 'play') return;
      const P = run.p;
      if (mv.held > 0) { mv.held--; if (!mv.held) { held.Space = 0; held.ArrowDown = 0; } }
      // holes in the floor: in god mode jump them, and if he still drops in, lift him out the far side
      if (god && run.gaps) {
        if (P.hole) { P.x = P.hole.x + P.hole.w + 30; P.y = RGY; P.vy = 0; P.ground = true; P.hole = null; }
        else if (P.ground && run.gaps.some(o => !o.big && o.x - P.x > 0 && o.x - P.x < 40)) run.buf = 8;
      }
      if (P.stuck || P.stuckT) { run.buf = 8; held.Space = 1; mv.held = 20; }
      else if (!god && !mv.held && Math.random() < .02) { if (Math.random() < .6) { run.buf = 8; held.Space = 1; } else held.ArrowDown = 1; mv.held = 25; }
      return;
    }
    // lane-crossing levels
    if (state === 'ready') { act(1, 0); return; }
    if (state === 'dead') { if (fr - t0 > 31) act(1, 0); return; }
    if (state !== 'play') return;
    if (god) { pig.inv = Math.max(pig.inv, 2); pig.key = true; if (pig.air != null) pig.air = 1; }
    if (--mv.cd > 0) return; mv.cd = god ? 7 : 12 + (Math.random() * 20 | 0);
    if (pig.fly) { aimFly(1, 0); return; }
    if (pig.slide) return;
    const row = Math.floor(pig.y / T), rows = H / T, nc = pig.col + 1;
    if (!god && Math.random() < .25) { const d = [[0, -1], [0, 1], [-1, 0]][Math.random() * 3 | 0]; act(d[0], d[1]); return; }
    if (nc < N && !blocked(lanes[nc], row)) { act(1, 0); mv.wait = 0; return; }
    if (++mv.wait < 4) return;
    let ny = row + mv.vdir;
    if (ny < 0 || ny >= rows || blocked(lanes[pig.col], ny)) { mv.vdir *= -1; ny = row + mv.vdir; }
    if (ny >= 0 && ny < rows && !blocked(lanes[pig.col], ny)) act(0, mv.vdir);
  };
  // run n frames with the robot; stop early when done() says so
  T0.play = (n, drawEvery, doneSrc) => {
    const done = doneSrc ? new Function('return (' + doneSrc + ')') : null;
    for (let i = 0; i < n; i++) {
      if (lvl !== T0.lastLvl && state !== 'buffet') { T0.log.push({ lvl, fr }); T0.lastLvl = lvl; }
      try { T0.bot(); update(); if (i % drawEvery === 0) draw(); }
      catch (e) { return { error: String(e && e.stack || e).split('\n').slice(0, 2).join(' ').replace(/\(file:[^)]*\//g, '(').replace(/\s+/g, ' '), lvl, state, fr }; }
      if (done && done()) return { done: true, frames: i + 1, lvl, state };
    }
    return { done: false, frames: n, lvl, state };
  };
  T0.where = () => ({ lvl, state, world: world(lvl), boss: bs && bs.phase, buffet: bf && bf.phase });
  // small grey thumbnail of the screen for comparing two versions
  T0.thumb = () => {
    draw();
    const c = document.createElement('canvas'); c.width = 80; c.height = 56;
    const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 80, 56);
    const d = x.getImageData(0, 0, 80, 56).data, g = [];
    for (let i = 0; i < d.length; i += 4) g.push((d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10 | 0);
    return g;
  };
}

async function openGame(browser, file, errors) {
  const page = await browser.newPage({ viewport: { width: 800, height: 560 } });
  page.on('pageerror', e => errors.push('Script error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push('Console error: ' + m.text()); });
  await page.addInitScript(() => {
    // fixed random numbers (so two versions can be compared) and no automatic game loop (the checker drives it)
    let s = 1;
    window.__reseed = n => { s = n >>> 0 || 1; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let first = true;
    window.requestAnimationFrame = cb => { if (first) { first = false; } return 0; };
  });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 120000 });
  // wait for the embedded pictures to finish decoding
  let last = -1;
  for (let k = 0; k < 40; k++) {
    const n = await page.evaluate(() => Object.keys(img).length);
    if (n === last && k > 3) break; last = n; await page.waitForTimeout(250);
  }
  await page.evaluate(() => { if (typeof fitCanvas === 'function') fitCanvas(); });
  await page.evaluate(installTester);
  return page;
}

async function shot(page, name) {
  await page.evaluate(() => draw());
  await page.locator('#c').screenshot({ path: path.join(OUT, 'pictures', name) });
  return 'pictures/' + name;
}

const WORLD_NAMES = { dino: 'Dino Jungle', meadow: 'Sunny Meadow', desert: 'Desert Dunes', shop: 'Super Snoutmarket', prison: 'Wrongfoot Prison', sea: 'Under the Sea', forest: "Lady Squishshot's Forest", boss: 'Dino-Capy boss', ice: 'Frosty Mountains', hard: "Lady Squishshot's Meadow" };

async function checkFile(browser, file, opts) {
  const errors = [], res = { file, errors, levels: {}, settings: {}, thumbs: {} };
  const src = fs.readFileSync(file, 'utf8');
  const setting = n => (src.match(new RegExp('const ' + n + '\\s*=\\s*([^;]+);')) || [])[1];
  res.settings = { SHARPNESS: setting('SHARPNESS'), LEVELS: setting('LEVELS'), BOSS_LEVEL: setting('BOSS_LEVEL'), sizeMB: (src.length / 1048576).toFixed(1) };
  const page = await openGame(browser, file, errors);
  const LEVELS = await page.evaluate(() => LEVELS);
  res.LEVELS = LEVELS;

  // pictures for comparing: each level's start, and after a short robot run, same random numbers every time
  for (let l = 1; l <= LEVELS; l++) {
    const info = res.levels[l] = { world: WORLD_NAMES[await page.evaluate(l => world(l), l)] || '?', problems: [] };
    // the random numbers (and the frame counter animations use) depend on the world and the level's place in it, so a change to an earlier level doesn't change later levels' pictures
    await page.evaluate(l => { let k = 0; for (let x = 1; x <= l; x++) if (world(x) === world(l)) k++; fr = 30000 + k * 1000 + world(l).length * 100; __reseed(1000 + [...world(l)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973 * 10 + k); PT.reset(); PT.god(true); PT.deaths = []; bonusNext = false; lastBonus = false; build(l); }, l);
    res.thumbs[l + 'a'] = await page.evaluate(() => PT.thumb());
    if (opts.pictures) info.picStart = await shot(page, `L${l}-start.png`);
    const r = await page.evaluate(() => PT.play(240, 1));
    if (r.error) info.problems.push('Crashed in the first seconds: ' + r.error);
    res.thumbs[l + 'b'] = await page.evaluate(() => PT.thumb());
    if (opts.pictures) info.picPlay = await shot(page, `L${l}-playing.png`);
  }
  if (!opts.full) { await page.close(); return res; }

  // whole game in one go, Piggus can't get hurt
  await page.evaluate(() => { __reseed(7); PT.reset(); PT.god(true); bonusNext = false; lastBonus = false; build(1); state = 'title'; });
  let total = 0;
  const whole = res.whole = { finished: false, buffets: 0 };
  let inBuffet = false;
  await page.evaluate(() => { PT.log = []; PT.lastLvl = 0; });
  while (total < 120000) {
    const r = await page.evaluate(() => PT.play(600, 4, "state==='won'||(state==='boss'&&bs.phase==='won')"));
    total += r.frames;
    if (r.error) { errors.push(`Whole-game run crashed on level ${r.lvl} (${r.state}): ${r.error}`); res.levels[r.lvl]?.problems.push('Crashed during the whole-game run: ' + r.error); break; }
    const w = await page.evaluate(() => PT.where());
    if (w.state === 'buffet' && !inBuffet) { whole.buffets++; inBuffet = true; }
    if (w.state !== 'buffet') inBuffet = false;
    if (r.done) { whole.finished = !whole.skipped; whole.reachedEnd = true; break; }
    const log = await page.evaluate(() => PT.log);
    const curL = log[log.length - 1];
    if (curL && (await page.evaluate(() => fr)) - curL.fr > 15000) {
      res.levels[curL.lvl].problems.push('The robot could not finish this level (even with Piggus unable to get hurt).');
      if (curL.lvl >= LEVELS) break;
      whole.skipped = (whole.skipped || []).concat(curL.lvl); // carry on from the next level so one stuck level doesn't hide the rest
      await page.evaluate(l => { PT.reset(); build(l); }, curL.lvl + 1);
    }
  }
  const log = await page.evaluate(() => [PT.log, fr]);
  log[0].forEach((e, k) => { const end = k + 1 < log[0].length ? log[0][k + 1].fr : (whole.reachedEnd ? log[1] : null); if (end != null && !(whole.skipped || []).includes(e.lvl)) res.levels[e.lvl].godFrames = end - e.fr; });
  const cur = log[0].length ? log[0][log[0].length - 1].lvl : 0;
  whole.reached = cur;

  // a minute of real play on every level, no cheats: Piggus gets caught and restarts
  for (let l = 1; l <= LEVELS; l++) {
    const info = res.levels[l];
    await page.evaluate(l => { __reseed(500 + l); PT.reset(); PT.god(false); PT.deaths = []; bonusNext = false; lastBonus = false; build(l); }, l);
    let r;
    for (let k = 0; k < 6; k++) { r = await page.evaluate(() => PT.play(600, 3)); if (r.error) break; }
    if (r.error) info.problems.push('Crashed during real play: ' + r.error);
    info.realDeaths = await page.evaluate(() => PT.deaths.length);
    info.deathKinds = [...new Set(await page.evaluate(() => PT.deaths.map(d => typeof d === 'string' ? d : JSON.stringify(d))))];
    info.realState = (await page.evaluate(() => PT.where())).state;
  }
  // the buffet on its own
  await page.evaluate(() => { __reseed(9); PT.reset(); PT.god(false); lvl = 2; startBuffet(); });
  const b = await page.evaluate(() => PT.play(BUFFET_SECONDS * 60 + 300, 3, "state==='buffet'&&bf.phase==='end'"));
  res.buffet = b.error ? 'Crashed: ' + b.error : b.done ? 'OK' : 'Did not reach the end screen';
  if (opts.pictures) res.buffetPic = await shot(page, 'buffet-end.png');
  await page.close();
  return res;
}

// the older file's level with the same world and the same place in that world (so adding a world doesn't make every later level look changed)
function sameLevel(a, b, l) {
  const w = a.levels[l].world, k = Object.keys(a.levels).filter(x => +x <= l && a.levels[x].world === w).length;
  const m = Object.keys(b.levels).filter(x => b.levels[x].world === w);
  return m.length >= k ? m[k - 1] : null;
}
function compare(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) { if (i % 80 < 17 && i < 80 * 10) continue; if (Math.abs(a[i] - b[i]) > 24) diff++; }
  return diff / a.length;
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
console.log('Checking ' + path.basename(NEW) + ' ...');
const res = await checkFile(browser, NEW, { full: true, pictures: true });
let old = null;
if (OLD && fs.existsSync(OLD)) { console.log('Comparing with ' + path.basename(OLD) + ' ...'); old = await checkFile(browser, OLD, { full: false, pictures: false }); }
await browser.close();

// ---------- report ----------
const L = res.LEVELS, lines = [], probs = [];
if (res.settings.SHARPNESS !== '1.2') probs.push(`SHARPNESS is ${res.settings.SHARPNESS}, James wants 1.2`);
if (res.settings.LEVELS !== '15') probs.push(`LEVELS is ${res.settings.LEVELS}, expected 15`);
probs.push(...res.errors);
if (!res.whole.finished) probs.push(res.whole.skipped ? `Whole-game run got stuck on level ${res.whole.skipped.join(', ')} (skipped to the next level and carried on${res.whole.reachedEnd ? ' to the end' : `, stopped on level ${res.whole.reached}`})` : `Whole-game run did not reach the end (stopped on level ${res.whole.reached})`);
if (res.buffet !== 'OK') probs.push('Buffet: ' + res.buffet);
const rows = [];
for (let l = 1; l <= L; l++) {
  const v = res.levels[l];
  probs.push(...v.problems.map(p => `Level ${l}: ${p}`));
  if (v.realDeaths === 0 && l < L) probs.push(`Level ${l}: in a minute of real play the robot was never caught, so the dangers may not be working`);
  let change = 'not compared';
  const ol = old ? sameLevel(res, old, l) : null;
  if (old && !ol) change = 'NEW';
  if (old && ol) {
    const d = Math.max(compare(res.thumbs[l + 'a'], old.thumbs[ol + 'a']), compare(res.thumbs[l + 'b'], old.thumbs[ol + 'b']));
    v.diff = d; change = d < .002 ? 'looks the same' : 'CHANGED';
  }
  v.change = change;
  const secs = v.godFrames ? Math.round(v.godFrames / 60) + 's' : '-';
  rows.push({ l, ...v, secs });
  lines.push(`Level ${String(l).padStart(2)} ${v.world.padEnd(26)} finished: ${v.godFrames ? 'yes (' + secs + ')' : 'NO'}   real play: caught ${v.realDeaths}x   vs older file: ${change}${v.problems.length ? '   PROBLEM' : ''}`);
}
const changed = rows.filter(r => r.change === 'CHANGED' || r.change === 'NEW').map(r => r.l);
const head = [
  `Piggus Adventure check: ${path.basename(NEW)}${old ? '  compared with ' + path.basename(OLD) : ''}`,
  `Settings: SHARPNESS ${res.settings.SHARPNESS}, LEVELS ${res.settings.LEVELS}, file ${res.settings.sizeMB} MB`,
  `Whole game: ${res.whole.finished ? 'robot played from Level 1 to the end' : 'DID NOT FINISH'} (${res.whole.buffets} Buffet rounds on the way). Buffet on its own: ${res.buffet}`,
  probs.length ? `PROBLEMS (${probs.length}):\n  - ` + probs.join('\n  - ') : 'No problems found.',
  old ? (changed.length ? `Levels that look different from the older file: ${changed.join(', ')}` : 'No level looks different from the older file.') : '',
  ''];
const summary = head.concat(lines).join('\n');
fs.writeFileSync(path.join(OUT, 'summary.txt'), summary + '\n');
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ ...res, thumbs: undefined, problems: probs, changed }, null, 1));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
fs.writeFileSync(path.join(OUT, 'report.html'), `<!doctype html><meta charset="utf-8"><title>Piggus check</title>
<style>body{font:15px system-ui,sans-serif;margin:20px;background:#fff7fb;color:#3a2340}h1{color:#c2307f}table{border-collapse:collapse}td,th{padding:6px 10px;border-bottom:1px solid #ecd;text-align:left;vertical-align:top}
img{width:256px;border-radius:8px;border:1px solid #dcc}.bad{color:#b00;font-weight:bold}.chg{color:#7a5cff;font-weight:bold}pre{white-space:pre-wrap;background:#fff;padding:12px;border-radius:8px}</style>
<h1>Piggus Adventure check</h1><pre>${esc(head.join('\n'))}</pre><table><tr><th>Level</th><th>Finished?</th><th>Real play</th><th>vs older file</th><th>Start</th><th>4 seconds in</th></tr>
${rows.map(r => `<tr><td><b>${r.l}</b> ${esc(r.world)}${r.problems.length ? '<div class=bad>' + r.problems.map(esc).join('<br>') + '</div>' : ''}</td><td>${r.godFrames ? 'yes, ' + r.secs : '<span class=bad>no</span>'}</td><td>caught ${r.realDeaths}x<br><small>${esc((r.deathKinds || []).join(', '))}</small></td><td class="${r.change !== 'looks the same' ? 'chg' : ''}">${r.change}</td><td><img src="${r.picStart}"></td><td><img src="${r.picPlay}"></td></tr>`).join('\n')}
</table>${res.buffetPic ? `<p>Buffet end screen:<br><img src="${res.buffetPic}"></p>` : ''}`);
console.log(summary);
console.log('\nReport: ' + path.join(OUT, 'report.html'));
process.exit(probs.length ? 1 : 0);
