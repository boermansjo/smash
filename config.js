/* ============================================================
   ULTRA SMASH! — instellingen
   Dezelfde Supabase als PIPS OUT!, maar een eigen tabel.
   Zolang die tabel niet bestaat, valt het spel gewoon terug op
   een lijst per toestel. De SQL staat in README.md.
   ============================================================ */
window.SMASH = {

  leaderboard: {
    provider: 'supabase',   // 'local' = ieder zijn eigen lijst op zijn eigen toestel

    url: 'https://aqaikstibteqcdgxtuiw.supabase.co',
    key: 'sb_publishable_yt1HRtTr-Z8WCiZv3_uCkQ_on2j5ZJ4',   // publieke sleutel, hoort publiek te zijn
    table: 'smash_scores',

    limit: 25
  }
};
