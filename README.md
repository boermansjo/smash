# ULTRA SMASH! — TTC Wielsbeke-Spotit

> *"Jeugdspeler slaat opslag tot in de kantine. Bestuur onderzoekt of dat reglementair is."*

Prototype. Sla de bal zo ver mogelijk: van de sporthal door de kantine, over de parking,
door Wielsbeke tot aan de Leie.

## Spelen

- **Tik** — de speler gooit op. **Tik opnieuw** als de bal door de gele strook valt.
- **Te vroeg** = een lob. **Te laat** = in de grond. **Perfect** = ULTRA SMASH, en de bal brandt.
- **Tafel** — botst en versnelt. **Zwart clubshirt** — je teamgenoot slaat hem verder.
- De **noppenspeler** blokt alles dood. Afschermingen en vangnetten remmen af. Een brandende bal gaat overal door.
- **In de lucht** — één keer tikken om te blazen.

Vijf opslagen, alles telt samen; een foute opslag is nul. Elke dag staat de zaal anders, maar voor iedereen hetzelfde.
Je record blijft op je eigen toestel (`localStorage`).

## Technisch

Geen build, geen dependencies, geen assets. Alle geluid is gesynthetiseerd.

| bestand | inhoud |
|---|---|
| `index.html` | HUD, overlays, ticker |
| `style.css` | de pixel-arcade skin, dezelfde als PIPS OUT! |
| `physics.js` | de natuurkunde: worp, botsingen, obstakels — puur rekenwerk |
| `smash.js` | tekenen, camera, effecten, geluid |
| `board.js` | de erelijst (Supabase, met localStorage als vangnet) |
| `config.js` | de sleutels voor de clubranking |

Alle getallen om aan te draaien staan bovenaan `physics.js` in `P`. Omdat dat bestand
geen DOM gebruikt, kan je het ook in node laden om afstanden te simuleren:

```bash
node -e "const S=require('./physics.js'); const b=S.newBall(S.launch(0)); const w=S.freshWorld(S.buildWorld(S.daySeed())); while(!b.done) S.step(b,1/60,w,[]); console.log(b.x.toFixed(1)+' m')"
```

## Erelijst

Na vijf opslagen zet je je naam bij je totaal. Per naam blijft enkel het beste totaal staan.
De lijst draait op hetzelfde Supabase-project als PIPS OUT!, in een eigen tabel. Zolang die
tabel niet bestaat of de verbinding wegvalt, bewaart het spel de afstanden op het toestel zelf.

Eenmalig in de **SQL Editor** van het Supabase-project:

```sql
create table public.smash_scores (
  id         bigint generated always as identity primary key,
  name       text          not null,
  distance   numeric(6,1)  not null,
  day        integer       not null,
  ts         bigint        not null,
  created_at timestamptz   not null default now()
);

create index smash_scores_distance_idx on public.smash_scores (distance desc);

alter table public.smash_scores enable row level security;

-- iedereen mag de lijst lezen
create policy "erelijst lezen"
  on public.smash_scores for select to anon
  using (true);

-- iedereen mag een afstand toevoegen, maar geen onzin
create policy "afstand toevoegen"
  on public.smash_scores for insert to anon
  with check (
    char_length(btrim(name)) between 1 and 16
    and distance > 0 and distance <= 10000
    and day between 20260101 and 21001231
  );
```

`day` is de zaal van die dag (`20261008`), zodat er later een dagranking bij kan.
Sleutels en tabelnaam staan in `config.js`; de bovengrens van 10000 m (vijf keer 2000) is dezelfde als in `board.js`.

## Lokaal draaien

```bash
python -m http.server 8123
```

Dan naar <http://localhost:8123>.
