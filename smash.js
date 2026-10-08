/* ============================================================
   ULTRA SMASH!  -  TTC Wielsbeke-Spotit
   Sla de bal zo ver mogelijk. Perfect getimed = anime.
   Prototype: alles lokaal, de natuurkunde zit in physics.js.
   ============================================================ */
(() => {
'use strict';

const S = SmashPhysics, P = S.P;

/* ---------- logische canvasmaat ---------- */
const W = 440, H = 520;
const GROUND = 452;            // schermhoogte van de vloer
const ANCHOR = W * 0.36;       // waar de camera op mikt, horizontaal
const SERVES = 5;

const cv  = document.getElementById('game');
const ctx = cv.getContext('2d');

const $ = id => document.getElementById(id);
const el = {
  serves: $('serves'), dist: $('distDigits'), best: $('bestDigits'),
  title: $('screen-title'), how: $('screen-how'), over: $('screen-over'),
  finalDist: $('finalDist'), overQuip: $('overQuip'),
  bestTitle: $('bestTitle'), bestOver: $('bestOver'),
  board: $('screen-board'), boardList: $('boardList'), boardNote: $('boardNote'),
  submitRow: $('submitRow'), submitDone: $('submitDone'), playerName: $('playerName'),
  tickText: $('tickText'), mute: $('mute')
};

/* ============================================================
   TEKST
   ============================================================ */
const HEADLINES = [
  'Kantine meldt bal in de soep. Bestuur spreekt van een incident.',
  'Ballenrobot weigert nog mee te werken na "de opslag van dinsdag".',
  'Jeugdtrainer: "Anime kijken is geen training." Jeugd is het oneens.',
  'Buurtbewoner vindt tafeltennisbal in dakgoot. Onderzoek loopt.',
  'Clubrecord verbroken met een bal die volgens getuigen "brandde".',
  'Tegenstander blokt vlammende bal, draagt nu ovenwanten.',
  'Materiaalcommissie bestelt 400 nieuwe ballen. Weet nu waarom.',
  'Bestuur overweegt vangnet rond de parking.'
];

const pick = a => a[(Math.random() * a.length) | 0];

function quipFor(d){
  if (d <= 0)  return 'De bal raakte zelfs het batje niet. De scheids kijkt weg.';
  if (d < 10)  return 'Dat was eerder een drop shot.';
  if (d < 30)  return 'Netjes binnen de zaal. De trainer is opgelucht.';
  if (d < 65)  return 'Solide. Iemand moet hem straks gaan halen.';
  if (d < 115) return 'Tot in de kantine. Iemand trakteert.';
  if (d < 190) return 'Teruggevonden op de parking, tussen twee bestelwagens.';
  if (d < 330) return 'De bal heeft Wielsbeke gezien. Meer dan sommige leden.';
  return 'Men zegt dat hij nog altijd rolt, richting Kortrijk.';
}

const EVT = {
  table:    ['TAFEL! +SNELHEID', '#7ef0ff'],
  netcord:  ['NETBAL',           '#ffd23f'],
  mate:     ['TEAMGENOOT!',      '#7ef0ff'],
  opp:      ['GEBLOKT',          '#ff6b6b'],
  board:    ['AFSCHERMING',      '#ff6b6b'],
  catchnet: ['VANGNET',          '#ff6b6b'],
  robot:    ['BALLENROBOT!',     '#9bff6e'],
  burn:     ['DOORGEBRAND!',     '#ff9a2e'],
  burnopp:  ['TE HEET OM TE BLOKKEN', '#ff9a2e']
};

/* ============================================================
   ZONES — de zaal, en alles wat erachter ligt
   ============================================================ */
const ZONES = [
  { at: 0,   name: 'SPORTHAL',  sky: ['#1b5aa0', '#0e3a6d'], floor: ['#c7652c', '#a4501d'], line: '#f5e9c8' },
  { at: 65,  name: 'KANTINE',   sky: ['#6a3a22', '#3a1f12'], floor: ['#9a958c', '#77726a'], line: '#c9c4ba' },
  { at: 115, name: 'PARKING',   sky: ['#15254d', '#070e22'], floor: ['#34373e', '#26292f'], line: '#e8d34a' },
  { at: 190, name: 'WIELSBEKE', sky: ['#43306a', '#1b1433'], floor: ['#5f554c', '#4a4239'], line: '#857a6e' },
  { at: 330, name: 'DE LEIE',   sky: ['#1d5563', '#0a262d'], floor: ['#3a6c43', '#28502f'], line: '#4f8a5a' },
  { at: 520, name: 'RICHTING KORTRIJK', sky: ['#5a2a4a', '#1a0d1d'], floor: ['#4a4a3a', '#35352a'], line: '#6a6a55' }
];
function zoneIdx(x){ let i = 0; while (i + 1 < ZONES.length && x >= ZONES[i + 1].at) i++; return i; }

function hex(c){ const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t){
  const A = hex(a), B = hex(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}
/* kleur van de zone rond x, met een zachte overgang van 12 m */
function zoneColor(x, key, k){
  const i = zoneIdx(x), z = ZONES[i], n = ZONES[i + 1];
  if (!n) return z[key][k] || z[key];
  const t = Math.max(0, Math.min(1, (x - (n.at - 12)) / 12));
  const a = Array.isArray(z[key]) ? z[key][k] : z[key];
  const b = Array.isArray(n[key]) ? n[key][k] : n[key];
  return t > 0 ? mix(a, b, t) : a;
}

/* ============================================================
   GELUID  (gesynthetiseerd, zoals in PIPS OUT!)
   ============================================================ */
const Snd = {
  ac: null, on: localStorage.getItem('smash_mute') !== '1', noise: null,
  init(){
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    const len = this.ac.sampleRate * 0.6;
    this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  },
  ok(){ if (!this.on) return false; this.init(); return !!this.ac; },
  env(node, vol, dur, at){
    const t = at || this.ac.currentTime;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(this.ac.destination);
  },
  burst(vol, dur, freq, q, type){
    const s = this.ac.createBufferSource(); s.buffer = this.noise;
    const f = this.ac.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.2;
    s.connect(f); this.env(f, vol, dur); s.start(); s.stop(this.ac.currentTime + dur);
  },
  tone(type, f0, f1, vol, dur, delay){
    const t = this.ac.currentTime + (delay || 0);
    const o = this.ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(o, vol, dur, t); o.start(t); o.stop(t + dur + 0.02);
  },
  pok(pitch){ if (!this.ok()) return; this.tone('triangle', pitch || 1400, 500, 0.18, 0.06); this.burst(0.08, 0.03, 3500, 3); },
  toss(){ if (!this.ok()) return; this.tone('sine', 500, 900, 0.06, 0.12); },
  whiff(){ if (!this.ok()) return; this.burst(0.12, 0.2, 900, 0.7); },
  smash(){
    if (!this.ok()) return;
    this.burst(0.5, 0.5, 180, 0.5, 'lowpass');
    this.tone('sawtooth', 110, 55, 0.2, 0.5);
    this.tone('square', 1760, 440, 0.08, 0.25);
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, 0, 0.06, 0.22, 0.28 + i * 0.05));
    this.burst(0.2, 0.6, 1200, 0.4);
  },
  thud(){ if (!this.ok()) return; this.tone('sine', 160, 60, 0.22, 0.15); this.burst(0.1, 0.08, 400, 1); },
  boost(){ if (!this.ok()) return; this.tone('square', 440, 1320, 0.07, 0.18); this.pok(1600); },
  sizzle(){ if (!this.ok()) return; this.burst(0.18, 0.35, 2600, 0.6); },
  blow(){ if (!this.ok()) return; this.burst(0.2, 0.35, 700, 0.5, 'lowpass'); },
  land(){ if (!this.ok()) return; [392, 523, 659].forEach((f, i) => this.tone('square', f, 0, 0.07, 0.18, i * 0.08)); },
  record(){ if (!this.ok()) return; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('square', f, 0, 0.08, 0.2, i * 0.1)); }
};

/* ============================================================
   SPELSTAAT
   ============================================================ */
const G = {
  screen: 'title',        // title | how | ready | toss | smash | fly | landed | over
  seed: S.daySeed(),
  base: null, world: null,
  serve: 0, results: [], roundBest: 0,
  record: +(localStorage.getItem('smash_best') || 0),
  tossT: 0, tossV: 3.4, tossAt: 0, ball: null, shot: null,
  hitT: 0,                // tijd sinds de slag, voor de zwaai
  smashT: 0,              // tijd in de anime-pauze
  slow: 1, slowT: 0,      // slow motion na de ULTRA SMASH
  landT: 0,
  parts: [], texts: [], trail: [],
  banner: null,
  shake: 0, flash: 0,
  cam: { x: 0.7, ppm: 95 }
};
G.base = S.buildWorld(G.seed);

/* ---------- helpers ---------- */
const fmt = d => d.toFixed(1).replace('.', ',') + ' m';
const sx = x => ANCHOR + (x - G.cam.x) * G.cam.ppm;
const sy = y => GROUND - y * G.cam.ppm;

function addText(x, y, t, col){ G.texts.push({ x, y, t, col, life: 1.1 }); }
function setBanner(t, sub, col, dur){ G.banner = { t, sub, col, life: dur || 1.4, max: dur || 1.4 }; }

function puff(x, y, n, cols, speed, life, size){
  for (let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.4),
                   max: life, col: pick(cols), size: size * (0.6 + Math.random() * 0.6), g: 0 });
  }
}

/* ============================================================
   VERLOOP
   ============================================================ */
function show(name){
  G.screen = name;
  el.title.classList.toggle('hidden', name !== 'title');
  el.how.classList.toggle('hidden', name !== 'how');
  el.over.classList.toggle('hidden', name !== 'over');
  el.board.classList.toggle('hidden', name !== 'board');
}

function drawServes(){
  el.serves.innerHTML = '';
  for (let i = 0; i < SERVES; i++){
    const d = document.createElement('div');
    d.className = 'serve' + (i < G.serve ? ' gone' : '');
    el.serves.appendChild(d);
  }
}
function drawHud(){
  el.dist.textContent = fmt(G.ball ? Math.max(0, G.ball.x) : 0);
  el.best.textContent = fmt(G.roundBest);
}

function startRound(){
  G.serve = 0; G.results = []; G.roundBest = 0;
  drawServes();
  nextServe();
}

function nextServe(){
  G.world = S.freshWorld(G.base);
  G.ball = null; G.shot = null; G.tossT = 0; G.hitT = 0;
  G.parts = []; G.texts = []; G.trail = []; G.banner = null;
  G.slow = 1;
  show('ready');
  drawHud();
}

function toss(){
  G.screen = 'toss';
  G.tossT = 0;
  G.tossV = S.tossV();
  G.tossAt = performance.now();
  Snd.toss();
}

function hit(){
  // gemeten op de klok, niet op het laatst getekende beeld: een trage gsm
  // mag het venster niet kleiner of groter maken
  G.tossT = (performance.now() - G.tossAt) / 1000 * P.tossSpeed;
  const e = G.tossT - S.ideal(G.tossV);
  const shot = S.launch(e, G.tossV);
  G.shot = shot;
  G.ball = S.newBall(shot);
  G.hitT = 0;
  G.trail = [];

  if (shot.perfect){
    G.screen = 'smash';
    G.smashT = 0;
    G.flash = 1;
    G.shake = 14;
    Snd.smash();
    puff(G.ball.x, G.ball.y, 40, ['#fff6a8', '#ffd23f', '#ff8a1f', '#ff4a1f'], 9, 0.7, 6);
    return;
  }
  G.screen = 'fly';
  Snd.pok(900 + shot.quality * 900);
  G.shake = 3 * shot.quality;
  const txt = shot.quality > 0.75 ? ['MOOIE SLAG', '#9bff6e']
            : e < 0 ? ['TE VROEG — LOB', '#ffd23f']
            : ['TE LAAT', '#ff9a8a'];
  setBanner(txt[0], null, txt[1], 1.1);
}

function miss(){
  G.ball = S.newBall({ vx: 0.4, vy: -1, perfect: false });
  G.ball.y = S.tossY(G.tossT, G.tossV);
  G.screen = 'fly';
  G.missed = true;
  Snd.whiff();
  setBanner('FOUTE OPSLAG', 'Niet getikt — de bal viel op de grond', '#ff6b6b', 1.6);
}

function land(){
  const d = G.missed ? 0 : Math.max(0, G.ball.x);
  G.missed = false;
  G.results.push(d);
  G.serve++;
  drawServes();
  const newBest = d > G.roundBest;
  if (newBest) G.roundBest = d;
  const rec = d > G.record;
  if (rec){
    G.record = d;
    localStorage.setItem('smash_best', String(d));
    Snd.record();
  } else if (d > 0) Snd.land();
  setBanner(fmt(d), rec ? 'NIEUW CLUBRECORD!' : quipFor(d), rec ? '#ffd23f' : '#fff', 99);
  G.screen = 'landed';
  G.landT = 0;
  drawHud();
}

function afterLanding(){
  if (G.serve < SERVES) return nextServe();
  el.finalDist.textContent = fmt(G.roundBest);
  el.overQuip.textContent = quipFor(G.roundBest);
  el.bestOver.textContent = G.record ? fmt(G.record) : '—';

  // naam van de vorige keer klaarzetten; vijf foute opslagen noteren we niet
  el.submitRow.classList.toggle('hidden', !SmashBoard.plausible(G.roundBest));
  el.submitDone.classList.add('hidden');
  el.playerName.value = localStorage.getItem('ttcw_name') || '';
  show('over');
}

/* ============================================================
   ERELIJST
   ============================================================ */
let boardFrom = 'title', boardToken = 0;

function boardRow(cls, cells){
  const li = document.createElement('li');
  if (cls) li.className = cls;
  for (const [c, txt] of cells){
    const sp = document.createElement('span');
    sp.className = c;
    sp.textContent = txt;            // nooit innerHTML: namen komen van spelers
    li.appendChild(sp);
  }
  return li;
}

async function renderBoard(mineTs){
  const mine = ++boardToken;
  const list = el.boardList;
  list.textContent = '';
  list.appendChild(boardRow('leeg', [['', 'Laden…']]));
  el.boardNote.textContent = '';

  const res = await SmashBoard.top();
  if (mine !== boardToken) return;    // ondertussen opnieuw geopend

  list.textContent = '';
  if (!res.rows.length){
    list.appendChild(boardRow('leeg', [['', 'Nog niemand. Sla de eerste bal.']]));
  } else {
    res.rows.forEach((r, i) => {
      list.appendChild(boardRow(mineTs && r.ts === mineTs ? 'me' : '', [
        ['rk', (i + 1) + '.'],
        ['nm', r.name],
        ['sc', fmt(r.distance)]
      ]));
    });
  }
  el.boardNote.textContent =
    res.offline ? 'Geen verbinding met de clubranking. Dit is de lijst op dit toestel.'
    : res.remote ? 'De verste slag van elke speler in de club.'
    : res.rows.length ? 'Deze lijst staat op dit toestel.'
    : 'Speel vijf opslagen en zet je naam erbij.';

  const me = list.querySelector('.me');
  if (me) me.scrollIntoView({ block: 'center' });
}

function showBoard(from, mineTs){
  boardFrom = from;
  show('board');
  renderBoard(mineTs);
}

/* ============================================================
   UPDATE
   ============================================================ */
function update(dt){
  const b = G.ball;

  if (G.screen === 'toss'){
    G.tossT = (performance.now() - G.tossAt) / 1000 * P.tossSpeed;
    if (S.tossY(G.tossT, G.tossV) < 0.3) miss();
  }

  if (G.screen === 'smash'){
    // de tijd staat stil, enkel de vlammen bewegen
    G.smashT += dt;
    if (G.smashT > 0.9){
      G.screen = 'fly';
      G.slow = 0.22; G.slowT = 0;
      setBanner('ULTRA SMASH!!', null, '#ffd23f', 1.6);
    }
  }

  if (G.screen === 'fly' && b){
    if (G.slow < 1){ G.slowT += dt; G.slow = Math.min(1, 0.22 + G.slowT * 1.4); }
    const sdt = dt * G.slow;
    const ev = [];
    S.step(b, sdt, G.world, ev);
    G.hitT += sdt;
    for (const e of ev) onEvent(e);

    G.trail.push({ x: b.x, y: b.y, fire: b.fire > 0 });
    if (G.trail.length > 18) G.trail.shift();

    if (b.fire > 0){
      for (let i = 0; i < 3; i++){
        G.parts.push({
          x: b.x, y: b.y,
          vx: -b.vx * 0.15 + (Math.random() - 0.5) * 3, vy: -b.vy * 0.15 + Math.random() * 2.5,
          life: 0.45, max: 0.45, col: pick(['#fff6a8', '#ffd23f', '#ff8a1f', '#ff4a1f']),
          size: 7 + Math.random() * 6, g: -3, fire: true
        });
      }
    }
    if (b.done || G.hitT > 45) land();
    drawHud();
  }

  if (G.screen === 'landed') G.landT += dt;
  if (G.screen === 'ready' || G.screen === 'toss') G.hitT = 0;
  else G.hitT += (G.screen === 'fly' ? 0 : dt);

  // deeltjes en tekst lopen altijd door, ook in de pauze
  for (const p of G.parts){
    p.life -= dt;
    p.vy -= (p.g || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) t.life -= dt;
  G.texts = G.texts.filter(t => t.life > 0);
  if (G.banner && G.banner.max < 90){ G.banner.life -= dt; if (G.banner.life <= 0) G.banner = null; }
  G.shake = Math.max(0, G.shake - dt * 30);
  G.flash = Math.max(0, G.flash - dt * 3);

  updateCam(dt);
}

function onEvent(e){
  if (e.t === 'floor'){
    if (e.v > 3) Snd.pok(700);
    puff(e.x, 0.05, 4, ['#ffffff', '#dfe8f0'], 1.5, 0.3, 3);
    return;
  }
  if (e.t === 'tick'){ Snd.pok(1200); return; }
  const [t, col] = EVT[e.t];
  addText(e.x, e.y + 0.8, t, col);
  switch (e.t){
    case 'table': case 'mate': case 'robot':
      Snd.boost(); G.shake = 5;
      puff(e.x, e.y, 14, ['#7ef0ff', '#ffffff', '#ffd23f'], 5, 0.5, 4);
      break;
    case 'burn': case 'burnopp':
      Snd.sizzle(); G.shake = 6;
      puff(e.x, e.y, 22, ['#ffd23f', '#ff8a1f', '#ff4a1f', '#333'], 6, 0.7, 6);
      break;
    default:
      Snd.thud(); G.shake = 4;
      puff(e.x, e.y, 8, ['#ffffff', '#ff9a8a'], 3, 0.4, 3);
  }
}

function updateCam(dt){
  const c = G.cam, b = G.ball;
  let tx = 0.7, tp = 95;
  if (b && (G.screen === 'fly' || G.screen === 'landed' || G.screen === 'smash')){
    tx = b.x + Math.min(8, Math.max(0, b.vx) * 0.12);
    // hoe hoger en hoe sneller de bal, hoe verder de camera uitzoomt
    const sp = Math.hypot(b.vx, b.vy);
    tp = Math.max(8, Math.min(55 - sp * 0.8, (GROUND - 90) / (b.y + 2.2)));
    if (G.screen === 'smash'){ tx = b.x - 0.2; tp = 110; }     // speler en bal allebei in beeld
  }
  const kz = G.screen === 'smash' ? 10 : 2.6;
  c.ppm += (tp - c.ppm) * Math.min(1, dt * kz);
  c.x += (tx - c.x) * Math.min(1, dt * 7);
}

/* ============================================================
   TEKENEN
   ============================================================ */
function rect(x, y, w, h, col){ ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

function drawBackdrop(){
  const x = G.cam.x;
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, zoneColor(x, 'sky', 1));
  g.addColorStop(1, zoneColor(x, 'sky', 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, GROUND);

  // decor in de verte: schuift trager en is kleiner
  const PAR = 0.5, SC = 0.6, SP = 7;
  const ppm = G.cam.ppm * SC;
  const from = Math.floor((x * PAR - ANCHOR / ppm) / SP) - 1;
  const to   = Math.ceil((x * PAR + (W - ANCHOR) / ppm) / SP) + 1;
  for (let k = from; k <= to; k++){
    const dx = k * SP;
    const px = ANCHOR + (dx - x * PAR) * ppm;
    const zi = zoneIdx(dx / PAR);
    drawDeco(zi, px, ppm, k);
  }
}

function drawDeco(zi, px, m, k){
  const base = GROUND;
  const h = (k * 2654435761 >>> 0) % 100 / 100;       // vast toeval per stuk
  ctx.save();
  switch (zi){
  case 0: { // sporthal: wandrekken en hoge ramen
    rect(px - 1.2 * m, base - 6 * m, 2.4 * m, 1.2 * m, 'rgba(160,210,255,.18)');
    if (h < 0.5){
      ctx.strokeStyle = 'rgba(220,170,100,.45)'; ctx.lineWidth = Math.max(1, 0.06 * m);
      for (let i = 0; i < 2; i++){ const xx = px - 0.5 * m + i * m; ctx.beginPath(); ctx.moveTo(xx, base); ctx.lineTo(xx, base - 3 * m); ctx.stroke(); }
      for (let j = 1; j < 10; j++){ const yy = base - j * 0.3 * m; ctx.beginPath(); ctx.moveTo(px - 0.5 * m, yy); ctx.lineTo(px + 0.5 * m, yy); ctx.stroke(); }
    }
    break;
  }
  case 1: { // kantine: toog en een tv
    rect(px - 1.8 * m, base - 1.1 * m, 3.6 * m, 1.1 * m, 'rgba(40,18,8,.55)');
    for (let i = 0; i < 5; i++) rect(px - 1.5 * m + i * 0.7 * m, base - 2.2 * m, 0.18 * m, 0.5 * m, 'rgba(120,200,120,.35)');
    if (h < 0.4) rect(px - 0.8 * m, base - 3.6 * m, 1.6 * m, 0.9 * m, 'rgba(120,180,255,.35)');
    break;
  }
  case 2: { // parking: auto's en lantaarnpalen
    if (h < 0.6){
      rect(px - 2 * m, base - 0.9 * m, 4 * m, 0.6 * m, 'rgba(90,110,150,.5)');
      rect(px - 1.2 * m, base - 1.4 * m, 2.2 * m, 0.55 * m, 'rgba(90,110,150,.5)');
    } else {
      rect(px - 0.06 * m, base - 5 * m, 0.12 * m, 5 * m, 'rgba(120,130,150,.5)');
      ctx.fillStyle = 'rgba(255,230,140,.6)';
      ctx.beginPath(); ctx.arc(px, base - 5 * m, 0.35 * m, 0, Math.PI * 2); ctx.fill();
    }
    break;
  }
  case 3: { // Wielsbeke: huizen met puntdaken, af en toe de kerk
    const hw = 2.4 * m, hh = (3 + h * 2) * m;
    ctx.fillStyle = 'rgba(20,12,35,.6)';
    ctx.fillRect(px - hw / 2, base - hh, hw, hh);
    ctx.beginPath(); ctx.moveTo(px - hw / 2 - 0.2 * m, base - hh); ctx.lineTo(px, base - hh - 1.6 * m); ctx.lineTo(px + hw / 2 + 0.2 * m, base - hh); ctx.fill();
    if (k % 9 === 0){ ctx.fillRect(px - 0.6 * m, base - hh - 7 * m, 1.2 * m, 7 * m); ctx.beginPath(); ctx.moveTo(px - 0.7 * m, base - hh - 7 * m); ctx.lineTo(px, base - hh - 10 * m); ctx.lineTo(px + 0.7 * m, base - hh - 7 * m); ctx.fill(); }
    rect(px - 0.5 * m, base - hh + 0.7 * m, 0.4 * m, 0.5 * m, 'rgba(255,210,120,.55)');
    break;
  }
  default: { // de Leie en verder: bomen en water
    ctx.fillStyle = 'rgba(10,30,20,.6)';
    rect(px - 0.1 * m, base - 2 * m, 0.2 * m, 2 * m, 'rgba(40,25,15,.6)');
    ctx.beginPath(); ctx.arc(px, base - (2.6 + h) * m, (1 + h * 0.6) * m, 0, Math.PI * 2); ctx.fill();
    rect(px - 3.5 * m, base - 0.4 * m, 7 * m, 0.25 * m, 'rgba(120,200,230,.18)');
  }
  }
  ctx.restore();
}

function drawFloor(){
  const x0 = G.cam.x - ANCHOR / G.cam.ppm, x1 = G.cam.x + (W - ANCHOR) / G.cam.ppm;
  // vloer in stroken, zodat de zones mooi in elkaar overlopen
  const step = Math.max(1, Math.ceil(8 / G.cam.ppm));
  for (let x = Math.floor(x0); x < x1 + step; x += step){
    const a = sx(x), b = sx(x + step);
    ctx.fillStyle = zoneColor(x, 'floor', 0);
    ctx.fillRect(a, GROUND, b - a + 1, 10);
    ctx.fillStyle = zoneColor(x, 'floor', 1);
    ctx.fillRect(a, GROUND + 10, b - a + 1, H - GROUND - 10);
  }
  rect(0, GROUND, W, 2, 'rgba(255,255,255,.18)');

  // afstandsmarkering
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  const every = G.cam.ppm > 30 ? 1 : G.cam.ppm > 12 ? 5 : 10;
  for (let m = Math.max(0, Math.floor(x0 / every) * every); m < x1; m += every){
    const p = sx(m);
    const big = m % 10 === 0;
    rect(p - 1, GROUND + 2, 2, big ? 10 : 5, zoneColor(m, 'line'));
    if (big && m > 0){
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(m + 'm', p, GROUND + 26);
    }
  }

  // bordjes waar een nieuwe zone begint
  for (const z of ZONES){
    if (!z.at || z.at < x0 - 20 || z.at > x1 + 20) continue;
    const p = sx(z.at);
    rect(p - 2, GROUND - 60, 4, 60, '#cfd8e0');
    ctx.font = '9px "Press Start 2P", monospace';
    const w = ctx.measureText(z.name).width + 14;
    rect(p - w / 2, GROUND - 82, w, 24, '#0b3a75');
    ctx.strokeStyle = '#9ed4ff'; ctx.lineWidth = 2; ctx.strokeRect(p - w / 2, GROUND - 82, w, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(z.name, p, GROUND - 66);
  }

  // vlaggetjes: beste van deze ronde en het clubrecord
  flag(G.roundBest, '#ffd23f', 'BEST');
  flag(G.record, '#ff5a4a', 'RECORD');
}

function flag(d, col, label){
  if (!d) return;
  const p = sx(d);
  if (p < -40 || p > W + 40) return;
  rect(p - 1, GROUND - 46, 2, 46, '#fff');
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(p + 1, GROUND - 46); ctx.lineTo(p + 30, GROUND - 39); ctx.lineTo(p + 1, GROUND - 32); ctx.fill();
  ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = col; ctx.fillText(label, p + 4, GROUND - 50);
  ctx.textAlign = 'center';
}

/* ---------- obstakels ---------- */
function drawObstacles(){
  const x0 = G.cam.x - ANCHOR / G.cam.ppm - 4, x1 = G.cam.x + (W - ANCHOR) / G.cam.ppm + 4;
  for (const o of G.world){
    if (o.x + o.len < x0) continue;
    if (o.x > x1) break;
    switch (o.type){
      case 'table': drawTable(o); break;
      case 'mate':  drawPerson(o.x, CLUB,  o.used ? 1 : 0, false); break;
      case 'opp':   drawPerson(o.x, RIVAL, o.used ? 2 : 0, true); break;
      case 'board': drawBoard(o); break;
      case 'net':   drawCatchNet(o); break;
      case 'robot': drawRobot(o); break;
    }
  }
}

function drawTable(o){
  const m = G.cam.ppm, a = sx(o.x), b = sx(o.x + o.len), top = sy(P.tableTop);
  const th = Math.max(3, 0.05 * m);
  rect(a + 0.25 * m, top, Math.max(2, 0.06 * m), GROUND - top, '#2a2f36');
  rect(b - 0.31 * m, top, Math.max(2, 0.06 * m), GROUND - top, '#2a2f36');
  rect(a, top, b - a, th, o.used ? '#3f7ae0' : '#1f4fa3');
  rect(a, top, b - a, Math.max(1, th * 0.3), '#fff');
  const n = sx(o.x + o.len / 2);
  rect(n - 1, sy(P.tableTop + P.netH), 2, P.netH * m, '#10151c');
  rect(n - 2, sy(P.tableTop + P.netH), 4, Math.max(1, 0.02 * m), '#fff');
}

/* ---------- tenues ----------
   Het clubshirt van TTC Wielsbeke: zwart, witte boordjes, en de drie
   strepen over de borst. De tegenstander speelt in het geel. */
const SKIN = '#f0c39a';
const CLUB  = { shirt: '#161616', trim: '#f4f4f4', hem: '#0a0a0a', shorts: '#111111',
                stripes: ['#e4474c', '#c6a743', '#2eb1c2'], crest: true };
const RIVAL = { shirt: '#ffd23f', trim: '#b58a00', hem: '#b58a00', shorts: '#1c2430',
                stripes: null, crest: false };

/* short, benen, witte sokken en schoenen; hw en lw in meter */
function drawLegs(L, hw, lw, kit){
  rect(-L(hw + 0.02), -L(0.9), L(2 * hw + 0.04), L(0.34), kit.shorts);
  for (const x of [-hw, hw - lw]){
    rect(L(x), -L(0.58), L(lw), L(0.5), SKIN);
    rect(L(x), -L(0.2), L(lw), L(0.12), '#f4f4f4');
    rect(L(x - 0.02), -L(0.08), L(lw + 0.06), L(0.08), '#e8e8e8');
  }
}

/* romp van top (hoogte van de schouders) tot top - h */
function drawShirt(L, hw, top, h, kit){
  rect(-L(hw), -L(top), L(2 * hw), L(h), kit.shirt);
  rect(-L(hw * 0.5), -L(top), L(hw), Math.max(1, L(0.04)), kit.trim);          // boord
  if (kit.stripes){
    const th = h * 0.06, gap = h * 0.035;
    kit.stripes.forEach((c, i) =>
      rect(-L(hw), -L(top - h * 0.38 - i * (th + gap)), L(2 * hw), Math.max(1, L(th)), c));
  }
  if (kit.crest){                                                                // het logootje
    ctx.fillStyle = kit.trim;
    ctx.beginPath(); ctx.arc(L(hw * 0.5), -L(top - h * 0.2), Math.max(1, L(hw * 0.16)), 0, Math.PI * 2); ctx.fill();
  }
  rect(-L(hw), -L(top - h + 0.05), L(2 * hw), L(0.05), kit.hem);
}

/* korte mouw met een wit boordje; tekenen na de arm, in het assenstelsel van de arm */
function drawSleeve(L, kit){
  rect(-L(0.03), -L(0.07), L(0.15), L(0.14), kit.shirt);
  rect(L(0.12), -L(0.07), L(0.03), L(0.14), kit.trim);
}

/* pose: 0 = klaar, 1 = net geslagen, 2 = net geblokt */
function drawPerson(x, kit, pose, facingLeft){
  const m = G.cam.ppm, p = sx(x);
  const L = v => v * m;
  ctx.save();
  ctx.translate(p, GROUND);
  if (facingLeft) ctx.scale(-1, 1);
  drawLegs(L, 0.16, 0.12, kit);
  drawShirt(L, 0.22, 1.45, 0.62, kit);
  // hoofd
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(0, -L(1.62), L(0.15), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2618';
  ctx.beginPath(); ctx.arc(0, -L(1.68), L(0.15), Math.PI, 0); ctx.fill();
  // arm met batje
  const ang = pose === 1 ? -1.0 : pose === 2 ? 0 : 0.4;
  ctx.save();
  ctx.translate(L(0.18), -L(1.38));
  ctx.rotate(ang);
  rect(0, -L(0.05), L(0.5), L(0.1), SKIN);
  drawSleeve(L, kit);
  ctx.fillStyle = '#c8242a';
  ctx.beginPath(); ctx.ellipse(L(0.66), 0, L(0.15), L(0.13), 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawBoard(o){
  const m = G.cam.ppm, p = sx(o.x);
  rect(p - 0.14 * m, sy(P.boardH), 0.28 * m, P.boardH * m, '#0b3a75');
  rect(p - 0.14 * m, sy(P.boardH) + 0.12 * m, 0.28 * m, 0.08 * m, '#fff');
  rect(p - 0.3 * m, GROUND - 0.05 * m, 0.6 * m, 0.05 * m, '#06203f');
}

function drawCatchNet(o){
  const m = G.cam.ppm, p = sx(o.x), top = sy(P.catchH), w = 0.5 * m;
  rect(p - w / 2 - 2, top - 3, 3, GROUND - top + 3, '#cfd8e0');
  ctx.strokeStyle = o.used ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cell = Math.max(4, 0.18 * m);
  for (let y = top; y < GROUND; y += cell){ ctx.moveTo(p - w / 2, y); ctx.lineTo(p + w / 2, y + cell * 0.6); }
  for (let y = top; y < GROUND; y += cell){ ctx.moveTo(p + w / 2, y); ctx.lineTo(p - w / 2, y + cell * 0.6); }
  ctx.stroke();
  rect(p - w / 2, top - 2, w, 3, '#cfd8e0');
}

function drawRobot(o){
  const m = G.cam.ppm, p = sx(o.x);
  rect(p - 0.3 * m, sy(0.9), 0.6 * m, 0.9 * m, '#3a3f48');
  rect(p - 0.3 * m, sy(0.9), 0.6 * m, 0.1 * m, '#9bff6e');
  ctx.fillStyle = '#ff8a1f';
  for (let i = 0; i < 4; i++){ ctx.beginPath(); ctx.arc(p - 0.18 * m + i * 0.12 * m, sy(0.98), 0.07 * m, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(p + 0.1 * m, sy(1.0)); ctx.rotate(-0.6);
  rect(0, -0.07 * m, 0.55 * m, 0.14 * m, '#6a717d'); ctx.restore();
}

/* ---------- jijzelf ---------- */
function drawServer(){
  const m = G.cam.ppm, p = sx(0);
  if (p < -2 * m) return;
  const L = v => v * m;
  ctx.save();
  ctx.translate(p, GROUND);

  // de aura: enkel bij de ULTRA SMASH
  if (G.shot && G.shot.perfect && (G.screen === 'smash' || G.hitT < 1.2)){
    const k = G.screen === 'smash' ? 1 : Math.max(0, 1 - G.hitT);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++){
      ctx.fillStyle = 'rgba(255,' + (140 + i * 18) + ',40,' + (0.12 * k) + ')';
      const wob = Math.sin(performance.now() / 60 + i) * L(0.05);
      ctx.beginPath(); ctx.ellipse(0, -L(0.95), L(0.55 + i * 0.07) + wob, L(1.15 + i * 0.07), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawLegs(L, 0.18, 0.14, CLUB);
  drawShirt(L, 0.26, 1.5, 0.66, CLUB);
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(0, -L(1.68), L(0.17), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20150e';
  // stekelhaar, want anime
  ctx.beginPath();
  ctx.moveTo(-L(0.2), -L(1.7));
  for (let i = 0; i <= 5; i++) ctx.lineTo(-L(0.2) + i * L(0.08), -L(1.9 + (i % 2 ? 0.12 : 0)));
  ctx.lineTo(L(0.2), -L(1.7));
  ctx.fill();

  // gooiarm: houdt de bal vast, en wijst omhoog na het opgooien
  const hand = G.screen === 'ready' ? [0.5, 1.05] : [0.38, 1.95];
  const hx = hand[0] - 0.2, hy = hand[1] - 1.42;
  ctx.save();
  ctx.translate(L(0.2), -L(1.42));
  ctx.rotate(Math.atan2(-hy, hx));
  rect(0, -L(0.05), L(Math.hypot(hx, hy)), L(0.1), SKIN);
  drawSleeve(L, CLUB);
  ctx.restore();

  // slagarm: hoek 0 wijst naar voor, PI naar achter, 3PI/2 recht omhoog
  let th;
  if (G.screen === 'ready') th = Math.PI + 0.4;
  else if (G.screen === 'toss') th = Math.PI + 0.4 + Math.min(1, G.tossT / S.ideal(G.tossV)) * 1.2;   // naar achter en omhoog halen
  else if (G.screen === 'smash') th = Math.PI * 2 - 0.3;                                      // bevroren op de bal
  else th = Math.PI + 1.6 + Math.min(1, G.hitT * 9) * 2.35;                                  // doorzwaaien tot voor je
  ctx.save();
  ctx.translate(-L(0.2), -L(1.4));
  ctx.rotate(th);
  rect(0, -L(0.05), L(0.55), L(0.1), SKIN);
  drawSleeve(L, CLUB);
  ctx.fillStyle = '#c8242a';
  ctx.beginPath(); ctx.ellipse(L(0.72), 0, L(0.17), L(0.15), 0, 0, Math.PI * 2); ctx.fill();
  rect(L(0.5), -L(0.035), L(0.1), L(0.07), '#b07b3a');
  ctx.restore();
  ctx.restore();

  // de gele strook: daar moet de bal door als je tikt
  if (G.screen === 'ready' || G.screen === 'toss'){
    const band = P.perfectBand;
    const y0 = sy(P.hitY + band), y1 = sy(P.hitY - band);
    ctx.fillStyle = 'rgba(255,210,63,.28)';
    ctx.fillRect(sx(0.3), y0, 0.5 * m, y1 - y0);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(sx(0.3), sy(P.hitY) - 1, 0.5 * m, 2);
  }
}

/* ---------- de bal ---------- */
function ballPos(){
  if (G.screen === 'ready') return { x: 0.55, y: P.tossY };
  if (G.screen === 'toss')  return { x: 0.55, y: S.tossY(G.tossT, G.tossV) };
  return G.ball;
}

function drawBall(){
  const b = ballPos();
  if (!b) return;
  const m = G.cam.ppm;
  const r = Math.max(3.5, P.r * m * 0.7);

  // spoor
  if (G.trail.length > 1){
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < G.trail.length; i++){
      const a = G.trail[i - 1], c = G.trail[i], k = i / G.trail.length;
      ctx.strokeStyle = c.fire ? 'rgba(255,' + (120 + k * 100 | 0) + ',40,' + k * 0.8 + ')' : 'rgba(255,255,255,' + k * 0.35 + ')';
      ctx.lineWidth = r * 2 * k * (c.fire ? 1.6 : 0.8);
      ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(c.x), sy(c.y)); ctx.stroke();
    }
    ctx.restore();
  }

  const X = sx(b.x), Y = sy(b.y);
  if (b.fire > 0){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 4);
    g.addColorStop(0, 'rgba(255,240,160,.9)'); g.addColorStop(0.4, 'rgba(255,140,30,.5)'); g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // schaduw op de vloer
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(X, GROUND + 1, r * 1.2, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = b.fire > 0 ? '#fff6d0' : '#ffffff';
  ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.beginPath(); ctx.arc(X + r * 0.25, Y + r * 0.25, r * 0.7, 0, Math.PI * 2); ctx.fill();
}

function drawParts(){
  ctx.save();
  for (const p of G.parts){
    const k = Math.max(0, p.life / p.max);
    ctx.globalCompositeOperation = p.fire ? 'lighter' : 'source-over';
    ctx.globalAlpha = k;
    ctx.fillStyle = p.col;
    const s = p.size * (p.fire ? 0.4 + k : 1);
    ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), s / 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawTexts(){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '10px "Press Start 2P", monospace';
  for (const t of G.texts){
    const k = t.life / 1.1;
    ctx.globalAlpha = Math.min(1, k * 2);
    const half = ctx.measureText(t.t).width / 2 + 8;
    const X = Math.max(half, Math.min(W - half, sx(t.x))), Y = Math.max(30, sy(t.y)) - (1 - k) * 40;
    ctx.fillStyle = '#02132b'; ctx.fillText(t.t, X + 2, Y + 2);
    ctx.fillStyle = t.col; ctx.fillText(t.t, X, Y);
  }
  ctx.restore();
}

/* ---------- de anime-pauze bij een ULTRA SMASH ---------- */
function drawSmash(){
  const b = G.ball, t = G.smashT;
  const X = sx(b.x), Y = sy(b.y);

  // concentratielijnen
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,20,' + Math.min(0.72, t * 5) + ')';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++){
    const a = Math.random() * Math.PI * 2;
    const r0 = 60 + Math.random() * 90, r1 = 700;
    const w = 0.012 + Math.random() * 0.02;
    ctx.fillStyle = Math.random() < 0.3 ? 'rgba(255,170,60,.55)' : 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0);
    ctx.lineTo(X + Math.cos(a - w) * r1, Y + Math.sin(a - w) * r1);
    ctx.lineTo(X + Math.cos(a + w) * r1, Y + Math.sin(a + w) * r1);
    ctx.fill();
  }
  ctx.restore();

  // de speler en de bal opnieuw, bovenop het donker
  drawServer();
  drawParts();
  drawBall();

  // de naam van de slag, zoals het hoort
  const pop = Math.min(1, t / 0.12);
  const s = 1 + (1 - pop) * 1.8;
  ctx.save();
  ctx.translate(W / 2 + (Math.random() - 0.5) * 4, 120 + (Math.random() - 0.5) * 4);
  ctx.rotate(-0.12);
  ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.globalAlpha = pop;
  ctx.font = 'bold 44px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif';
  ctx.lineWidth = 8; ctx.strokeStyle = '#8d1519'; ctx.strokeText('必殺', 0, -34);
  ctx.fillStyle = '#fff'; ctx.fillText('必殺', 0, -34);
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.lineWidth = 7; ctx.strokeStyle = '#6b2a00'; ctx.strokeText('ULTRA', 0, 8);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('ULTRA', 0, 8);
  ctx.font = '30px "Press Start 2P", monospace';
  ctx.strokeText('SMASH!!', 0, 48);
  const g = ctx.createLinearGradient(0, 20, 0, 50);
  g.addColorStop(0, '#fff6a8'); g.addColorStop(0.5, '#ff8a1f'); g.addColorStop(1, '#ff3a1f');
  ctx.fillStyle = g; ctx.fillText('SMASH!!', 0, 48);
  ctx.restore();
}

function drawBanner(){
  const bn = G.banner;
  if (!bn) return;
  const k = bn.max > 90 ? 1 : Math.min(1, bn.life / 0.3);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.textAlign = 'center';
  const big = G.screen === 'landed';
  ctx.font = (big ? 26 : 16) + 'px "Press Start 2P", monospace';
  const y = big ? 150 : 96;
  ctx.lineWidth = 6; ctx.strokeStyle = '#02132b'; ctx.strokeText(bn.t, W / 2, y);
  ctx.fillStyle = bn.col; ctx.fillText(bn.t, W / 2, y);
  if (bn.sub){
    ctx.font = '8px "Press Start 2P", monospace';
    wrap(bn.sub, W / 2, y + 30, W - 60, 14);
  }
  if (G.screen === 'landed' && G.landT > 0.7){
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 200) * 0.3;
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#9ed4ff';
    ctx.fillText(G.serve < SERVES ? 'TIK VOOR DE VOLGENDE OPSLAG' : 'TIK VOOR DE UITSLAG', W / 2, y + 80);
  }
  ctx.restore();
}

function wrap(text, x, y, max, lh){
  const words = text.split(' ');
  let line = '';
  ctx.fillStyle = '#e0f0ff';
  for (const w of words){
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > max && line){ ctx.fillText(line, x, y); line = w; y += lh; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

function drawHints(){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillStyle = '#e0f0ff';
  if (G.screen === 'ready'){
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 220) * 0.35;
    ctx.fillText('TIK OM OP TE GOOIEN', W / 2, 70);
    ctx.globalAlpha = 0.8;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('OPSLAG ' + (G.serve + 1) + ' VAN ' + SERVES, W / 2, 46);
  }
  if (G.screen === 'fly' && G.ball && !G.ball.blown && !G.ball.done && !G.missed && G.hitT > 0.3){
    ctx.globalAlpha = 0.55;
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText('TIK = BLAZEN (1x)', W / 2, H - 14);
  }
  ctx.restore();
}

function render(){
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  drawBackdrop();
  drawFloor();
  drawObstacles();
  drawServer();
  drawParts();
  drawBall();
  drawTexts();
  ctx.restore();

  if (G.screen === 'smash') drawSmash();
  else { drawBanner(); drawHints(); }

  if (G.flash > 0){
    ctx.fillStyle = 'rgba(255,255,240,' + G.flash + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ============================================================
   LOOP  (zelfde klok als PIPS OUT!: performance.now)
   ============================================================ */
let lastWall = performance.now();
function frame(){
  const t = performance.now();
  let real = (t - lastWall) / 1000;
  lastWall = t;
  if (real < 0) real = 0;
  if (real > 0.1) real = 0.1;
  update(real);
  render();
  requestAnimationFrame(frame);
}

/* ============================================================
   INVOER — één knop, zoals het hoort
   ============================================================ */
function tap(){
  Snd.init();
  switch (G.screen){
    case 'ready': toss(); break;
    case 'toss':  hit(); break;
    case 'fly':
      if (G.ball && !G.missed && G.hitT > 0.15 && S.blow(G.ball)){
        Snd.blow();
        addText(G.ball.x, G.ball.y + 0.8, 'BLAZEN!', '#e0f0ff');
        puff(G.ball.x - 0.3, G.ball.y - 0.2, 14, ['#ffffff', '#cfe0f0'], 3, 0.6, 7);
      }
      break;
    case 'landed': if (G.landT > 0.7) afterLanding(); break;
  }
}

cv.addEventListener('pointerdown', e => { tap(); e.preventDefault(); });
cv.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  if (G.screen === 'how' || G.screen === 'board') return;
  e.preventDefault();
  if (e.repeat) return;
  if (G.screen === 'title' || G.screen === 'over'){ Snd.init(); startRound(); }
  else tap();
});

$('btnStart').onclick = () => { Snd.init(); startRound(); };
$('btnRetry').onclick = () => startRound();
$('btnHow').onclick   = () => show('how');
$('btnBack').onclick  = () => show('title');
$('btnBoard').onclick     = () => showBoard('title');
$('btnBoardOver').onclick = () => showBoard('over');
$('btnBoardBack').onclick = () => show(boardFrom);

el.submitRow.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('btnSubmit');
  if (btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Bezig…';

  const res = await SmashBoard.submit(el.playerName.value, G.roundBest, G.seed);

  btn.disabled = false;
  btn.textContent = label;
  if (!res) return;

  localStorage.setItem('ttcw_name', res.entry.name);
  el.submitRow.classList.add('hidden');
  el.submitDone.classList.remove('hidden');
  el.submitDone.textContent =
    res.offline ? 'Geen verbinding. Bewaard op dit toestel, de club ziet ze nog niet.'
    : res.rank  ? 'Genoteerd als ' + res.entry.name + ' — plaats ' + res.rank + '.'
                : 'Genoteerd als ' + res.entry.name + '.';
  Snd.land();
  setTimeout(() => showBoard('over', res.entry.ts), 750);
});
$('btnShare').onclick = async () => {
  const txt = 'Ik sloeg de bal ' + fmt(G.roundBest) + ' ver in ULTRA SMASH!, ' +
              'de nieuwe videogame van TTC Wielsbeke-Spotit. ' + location.href;
  try {
    if (navigator.share) await navigator.share({ text: txt });
    else { await navigator.clipboard.writeText(txt); alert('Gekopieerd! Plak maar in de clubgroep.'); }
  } catch (_){ /* gebruiker brak af */ }
};

function paintMute(){ el.mute.classList.toggle('off', !Snd.on); }
el.mute.onclick = () => {
  Snd.on = !Snd.on;
  localStorage.setItem('smash_mute', Snd.on ? '0' : '1');
  paintMute();
};

/* ============================================================
   OPSTART
   ============================================================ */
function resize(){
  const rect = cv.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width  = Math.round(rect.width * dpr);
  cv.height = Math.round(rect.width * dpr * H / W);
  ctx.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
}
addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);

let tickI = 0;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function tick(){
  const t = el.tickText;
  t.textContent = HEADLINES[tickI++ % HEADLINES.length];
  if (REDUCED || !t.animate){ setTimeout(tick, 7000); return; }
  const win = t.parentElement.clientWidth, txt = t.scrollWidth;
  if (!win){ setTimeout(tick, 1200); return; }
  const a = t.animate(
    [{ transform: 'translateX(' + win + 'px)' }, { transform: 'translateX(' + (-txt) + 'px)' }],
    { duration: (win + txt) / 58 * 1000, easing: 'linear' }
  );
  a.onfinish = tick;
}

G.world = S.freshWorld(G.base);
el.bestTitle.textContent = G.record ? fmt(G.record) : '—';
paintMute();
drawServes();
drawHud();
show('title');
resize();
tick();
requestAnimationFrame(frame);

})();
