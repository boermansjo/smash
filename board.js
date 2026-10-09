/* ============================================================
   ULTRA SMASH! — erelijst
   Zelfde aanpak als PIPS OUT!: lokaal of via Supabase, en er
   wordt altijd ook lokaal weggeschreven, zodat je afstand niet
   verdwijnt als het net even niet meezit.
   ============================================================ */
window.SmashBoard = (() => {
'use strict';

const CFG   = (window.SMASH && window.SMASH.leaderboard) || {};
const LIMIT = CFG.limit || 25;
const KEY   = 'smash_board';
const KEEP  = 60;

const useRemote = CFG.provider === 'supabase' && !!CFG.url && !!CFG.key;

function cleanName(raw){
  return String(raw || '')
    .split('').filter(c => c >= ' ').join('')   // stuurtekens eruit
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

/* ---------- kan die afstand wel kloppen? ----------
   Het totaal van vijf opslagen. De zaal en alles erachter stopt na
   1500 m; een perfecte slag met veel geluk haalt er zo'n 600. Vijf
   keer 2000 laat ruimte voor het ongelooflijke, maar niet voor 99999. */
const MAX_DIST = 10000;
const plausible = d => Number.isFinite(d) && d > 0 && d <= MAX_DIST;

/* ---------- lokale opslag ---------- */
function readLocal(){
  try {
    const rows = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(rows) ? rows.filter(r => r && plausible(r.distance)) : [];
  } catch (_){ return []; }
}
function writeLocal(rows){
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(0, KEEP))); }
  catch (_){ /* privémodus: dan maar niet */ }
}
function addLocal(e){
  const rows = readLocal();
  rows.push(e);
  rows.sort((a, b) => b.distance - a.distance);
  writeLocal(rows);
}

/* ---------- alleen het beste totaal per naam ---------- */
function bestPerName(rows){
  const seen = new Map();
  for (const r of rows){
    const k = cleanName(r.name).toLowerCase();
    if (!k) continue;
    if (!seen.has(k) || seen.get(k).distance < r.distance) seen.set(k, r);
  }
  return [...seen.values()].sort((a, b) => b.distance - a.distance).slice(0, LIMIT);
}

/* ---------- Supabase, via gewone REST ---------- */
const rest = {
  url(q){
    return String(CFG.url).replace(/\/+$/, '') + '/rest/v1/' + (CFG.table || 'smash_scores') + (q || '');
  },
  head(extra){
    return Object.assign({
      apikey: CFG.key,
      Authorization: 'Bearer ' + CFG.key,
      'Content-Type': 'application/json'
    }, extra || {});
  },
  async top(){
    const r = await fetch(
      this.url('?select=name,distance,day,ts&order=distance.desc&limit=' + (LIMIT * 4)),
      { headers: this.head() }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    // numeric komt soms als tekst terug
    return bestPerName((await r.json()).map(x => Object.assign(x, { distance: Number(x.distance) })));
  },
  async insert(e){
    const r = await fetch(this.url(), {
      method: 'POST',
      headers: this.head({ Prefer: 'return=minimal' }),
      body: JSON.stringify(e)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  }
};

return {
  isRemote: useRemote,
  plausible,

  /* {rows, remote, offline} — offline: de gedeelde lijst was niet
     bereikbaar, dit is wat er op dit toestel staat. */
  async top(){
    if (!useRemote) return { rows: bestPerName(readLocal()), remote: false, offline: false };
    try {
      return { rows: await rest.top(), remote: true, offline: false };
    } catch (_){
      return { rows: bestPerName(readLocal()), remote: true, offline: true };
    }
  },

  /* {entry, rank, offline} of null als de afstand niet kan kloppen. */
  async submit(name, distance, day){
    const e = {
      name: cleanName(name) || 'Anoniem',
      distance: Math.round(distance * 10) / 10,
      day,
      ts: Date.now()
    };
    if (!plausible(e.distance)) return null;

    addLocal(e);                       // altijd, ook als het versturen mislukt

    if (!useRemote){
      const rank = bestPerName(readLocal()).findIndex(r => r.ts === e.ts) + 1;
      return { entry: e, rank, offline: false };
    }
    try {
      await rest.insert(e);
      const rows = await rest.top();
      return { entry: e, rank: rows.findIndex(r => r.ts === e.ts) + 1, offline: false };
    } catch (_){
      return { entry: e, rank: 0, offline: true };
    }
  }
};

})();
