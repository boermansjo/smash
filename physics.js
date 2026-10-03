/* ============================================================
   ULTRA SMASH!  -  de natuurkunde
   Puur rekenwerk, geen DOM: zo kan node er ook mee tunen.
   Eenheden: meter en seconde. x loopt naar rechts, y naar boven.
   ============================================================ */
const SmashPhysics = (() => {
'use strict';

const P = {
  g: 9.8,
  drag: 0.0042,        // kwadratische luchtweerstand (1/m)
  fireDrag: 0.0012,    // een brandende bal snijdt door de lucht
  r: 0.18,             // tekenfilmstraal van de bal
  floorBounce: 0.56,   // hoeveel verticale snelheid een botsing op de vloer overhoudt
  floorKeep: 0.84,     // en hoeveel horizontale
  rollBelow: 1.5,      // trager dan dit na een botsing: de bal rolt
  rollFriction: 1.4,   // vertraging tijdens het rollen (m/s²)
  rollDrag: 0.03,      // en extra remming bij hoge snelheid
  stopSpeed: 0.25,

  // de opgooi
  tossY: 1.0, tossV: 3.4, hitY: 1.15,
  tossSpeed: 0.75,     // de opgooi loopt in lichte slow motion
  perfect: 0.04,       // venster voor de ULTRA SMASH, in speltijd
  good: 0.14,

  fireTime: 2.4,
  tableTop: 0.76, tableLen: 2.74, netH: 0.1525,
  boardH: 0.7, catchH: 3.4, playerH: 2.1, robotH: 1.5
};

/* moment waarop de dalende bal door de slaghoogte gaat */
const IDEAL = (P.tossV + Math.sqrt(P.tossV * P.tossV - 2 * P.g * (P.hitY - P.tossY))) / P.g;

function tossY(t){ return P.tossY + P.tossV * t - 0.5 * P.g * t * t; }

/* ---------- toeval dat voor iedereen op dezelfde dag hetzelfde is ---------- */
function rng(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daySeed(d){
  d = d || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/* ---------- de zaal, en alles wat erachter ligt ---------- */
const MIX = [
  ['table', 0.34], ['mate', 0.15], ['opp', 0.18],
  ['board', 0.14], ['net', 0.14], ['robot', 0.05]
];

function buildWorld(seed){
  const rnd = rng(seed);
  const obs = [];
  let x = 7;
  while (x < 1500){
    let r = rnd(), type = MIX[MIX.length - 1][0];
    for (const [t, w] of MIX){ if (r < w){ type = t; break; } r -= w; }
    const o = { type, x, len: type === 'table' ? P.tableLen : 0 };
    obs.push(o);
    // verder weg staat alles wat verder uit elkaar
    x += o.len + 2.5 + rnd() * (6 + x / 30);
  }
  return obs;
}

function freshWorld(world){ return world.map(o => ({ type: o.type, x: o.x, len: o.len })); }

/* ---------- de slag ----------
   e = hoe ver je naast het ideale moment tikte (speltijd, negatief = te vroeg).
   Te vroeg: de bal hangt nog hoog, je slaat een lob.
   Te laat: de bal zakt al, je slaat hem plat of in de grond. */
function launch(e){
  const a = Math.abs(e);
  if (a <= P.perfect){
    const ang = 23 * Math.PI / 180, v = 50;
    return { vx: v * Math.cos(ang), vy: v * Math.sin(ang), perfect: true, quality: 1 };
  }
  const q = Math.max(0, 1 - (a - P.perfect) / 0.3);
  const v = 9 + 25 * q * q;
  let deg = 24 + (e < 0 ? -e * 150 : -e * 120);
  deg = Math.max(-18, Math.min(72, deg));
  const ang = deg * Math.PI / 180;
  return { vx: v * Math.cos(ang), vy: v * Math.sin(ang), perfect: false, quality: q };
}

function newBall(shot){
  return {
    x: 0.55, y: P.hitY, vx: shot.vx, vy: shot.vy,
    fire: shot.perfect ? P.fireTime : 0,
    rolling: false, done: false, blown: false, top: P.hitY
  };
}

/* één keer tijdens de vlucht: blazen */
function blow(b){
  if (b.blown || b.done) return false;
  b.blown = true;
  b.rolling = false;
  b.vy = Math.max(b.vy, 0) + 7;
  b.vx += 3;
  return true;
}

/* ---------- beweging ---------- */
function step(b, dt, world, ev){
  if (b.done) return;
  const sp = Math.hypot(b.vx, b.vy);
  const n = Math.max(1, Math.ceil(sp * dt / 0.08));
  const h = dt / n;
  for (let i = 0; i < n && !b.done; i++) sub(b, h, world, ev);
}

function sub(b, h, world, ev){
  const px = b.x, py = b.y;

  if (b.rolling){
    // rollen: vaste wrijving, plus lucht, zodat een snelle bal niet eeuwig doorrolt
    const s = Math.sign(b.vx);
    b.vx -= s * (P.rollFriction + P.rollDrag * b.vx * b.vx) * h;
    if (Math.sign(b.vx) !== s || Math.abs(b.vx) < P.stopSpeed){ b.vx = 0; b.done = true; }
    b.x += b.vx * h;
  } else {
    const sp = Math.hypot(b.vx, b.vy);
    const k = b.fire > 0 ? P.fireDrag : P.drag;
    b.vx -= k * sp * b.vx * h;
    b.vy -= (P.g + k * sp * b.vy) * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
  }
  if (b.fire > 0) b.fire -= h;
  if (b.y > b.top) b.top = b.y;

  for (const o of world){
    if (o.x > b.x + 1) break;
    if (o.x + o.len < px - 1) continue;
    collide(o, b, px, py, ev);
  }

  if (!b.rolling && b.y < P.r){
    b.y = P.r;
    if (b.vy < 0){
      if (-b.vy < P.rollBelow){
        b.rolling = true; b.vy = 0;
      } else {
        b.vy = -b.vy * P.floorBounce;
        b.vx *= P.floorKeep;
        ev.push({ t: 'floor', x: b.x, y: 0, v: -b.vy });
      }
    }
  }
}

/* hoogte van de bal op het moment dat hij x = xw passeert, of null */
function cross(xw, b, px, py){
  if (!(px < xw && b.x >= xw)) return null;
  const f = b.x === px ? 1 : (xw - px) / (b.x - px);
  return py + (b.y - py) * f;
}

function collide(o, b, px, py, ev){
  const r = P.r;
  let yc;
  switch (o.type){

  case 'table': {
    const top = P.tableTop + r;
    if (!b.rolling && py >= top && b.y < top && b.x >= o.x && b.x <= o.x + o.len){
      b.y = top;
      if (!o.used){
        o.used = true;
        b.vy = Math.abs(b.vy) * 0.85 + 3;
        b.vx = b.vx * 1.18 + 2;
        ev.push({ t: 'table', x: b.x, y: P.tableTop });
      } else {
        b.vy = Math.max(1.2, Math.abs(b.vy) * 0.75);
        ev.push({ t: 'tick', x: b.x, y: P.tableTop });
      }
    }
    const nx = o.x + o.len / 2;
    yc = cross(nx, b, px, py);
    if (yc !== null && !o.netUsed && yc > P.tableTop - r && yc < P.tableTop + P.netH + r){
      o.netUsed = true;
      if (b.fire > 0) ev.push({ t: 'burn', x: nx, y: yc });
      else {
        b.vx *= 0.5;
        b.vy = Math.abs(b.vy) * 0.4 + 1.5;
        b.rolling = false;
        ev.push({ t: 'netcord', x: nx, y: yc });
      }
    }
    break;
  }

  case 'mate':
    yc = cross(o.x, b, px, py);
    if (yc !== null && yc < P.playerH && !o.used){
      o.used = true;
      const sp = Math.max(Math.hypot(b.vx, b.vy) * 1.1, 24);
      const a = 21 * Math.PI / 180;
      b.vx = sp * Math.cos(a); b.vy = sp * Math.sin(a);
      b.rolling = false;
      ev.push({ t: 'mate', x: o.x, y: yc });
    }
    break;

  case 'opp':
    yc = cross(o.x, b, px, py);
    if (yc !== null && yc < P.playerH && !o.used){
      o.used = true;
      if (b.fire > 0){ ev.push({ t: 'burnopp', x: o.x, y: yc }); break; }
      b.vx *= 0.35;
      b.vy = Math.max(b.vy, 0) * 0.3 + 2.5;
      b.rolling = false;
      ev.push({ t: 'opp', x: o.x, y: yc });
    }
    break;

  case 'board':
    yc = cross(o.x, b, px, py);
    if (yc !== null && yc < P.boardH + r){
      b.vx *= 0.5;
      b.vy = Math.abs(b.vy) * 0.3 + 3;
      b.rolling = false;
      b.y = Math.max(b.y, P.boardH + r);
      ev.push({ t: 'board', x: o.x, y: yc });
    }
    break;

  case 'net':
    yc = cross(o.x, b, px, py);
    if (yc !== null && yc < P.catchH && !o.used){
      o.used = true;
      if (b.fire > 0){ ev.push({ t: 'burn', x: o.x, y: yc }); break; }
      b.vx *= 0.28;
      b.vy *= 0.3;
      ev.push({ t: 'catchnet', x: o.x, y: yc });
    }
    break;

  case 'robot':
    yc = cross(o.x, b, px, py);
    if (yc !== null && yc < P.robotH && !o.used){
      o.used = true;
      b.vx = Math.max(b.vx, 24);
      b.vy = Math.max(b.vy, 9);
      b.rolling = false;
      ev.push({ t: 'robot', x: o.x, y: yc });
    }
    break;
  }
}

return { P, IDEAL, tossY, rng, daySeed, buildWorld, freshWorld, launch, newBall, blow, step };
})();

if (typeof module !== 'undefined') module.exports = SmashPhysics;
