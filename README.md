# ULTRA SMASH! — TTC Wielsbeke-Spotit

> *"Jeugdspeler slaat opslag tot in de kantine. Bestuur onderzoekt of dat reglementair is."*

Prototype. Sla de bal zo ver mogelijk: van de sporthal door de kantine, over de parking,
door Wielsbeke tot aan de Leie.

## Spelen

- **Tik** — de speler gooit op. **Tik opnieuw** als de bal door de gele strook valt.
- **Te vroeg** = een lob. **Te laat** = in de grond. **Perfect** = ULTRA SMASH, en de bal brandt.
- **Tafel** — botst en versnelt. **Zwart clubshirt** — je teamgenoot slaat hem verder.
- **Geel shirt**, afschermingen en vangnetten remmen af. Een brandende bal gaat erdoor.
- **In de lucht** — één keer tikken om te blazen.

Vijf opslagen, je verste telt. Elke dag staat de zaal anders, maar voor iedereen hetzelfde.
Je record blijft op je eigen toestel (`localStorage`).

## Technisch

Geen build, geen dependencies, geen assets. Alle geluid is gesynthetiseerd.

| bestand | inhoud |
|---|---|
| `index.html` | HUD, overlays, ticker |
| `style.css` | de pixel-arcade skin, dezelfde als PIPS OUT! |
| `physics.js` | de natuurkunde: worp, botsingen, obstakels — puur rekenwerk |
| `smash.js` | tekenen, camera, effecten, geluid |

Alle getallen om aan te draaien staan bovenaan `physics.js` in `P`. Omdat dat bestand
geen DOM gebruikt, kan je het ook in node laden om afstanden te simuleren:

```bash
node -e "const S=require('./physics.js'); const b=S.newBall(S.launch(0)); const w=S.freshWorld(S.buildWorld(S.daySeed())); while(!b.done) S.step(b,1/60,w,[]); console.log(b.x.toFixed(1)+' m')"
```

## Lokaal draaien

```bash
python -m http.server 8123
```

Dan naar <http://localhost:8123>.
