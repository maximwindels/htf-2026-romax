# Guardians of the Grid
Jullie bouwen een mission control center om Achrona te beschermen tegen The Desync. 
Dit  fungeert als de ultieme digitale levenslijn door vitale statistieken live in 
kaart te brengen en afwijkingen vroegtijdig te signaleren. Dankzij jullie realtime 
data-inzichten kunnen we op tijd ingrijpen om de glitches te stoppen en de magie 
in Achrona te redden

## Project setup
Deze repository bevat een basis [Tanstack Start](https://tanstack.com/start) op basis van:
- **Language:** [Typescript](https://www.typescriptlang.org)
- **Framework:** [React](https://react.dev)
- **ORM:** [Drizzle](https://orm.drizzle.team)
- **Styling:** [Tailwind](https://tailwindcss.com)
- **Build tool:** [Vite](https://vite.dev)

Om op te starten kan je volgende commando's gebruiken. 

```bash
npm install
npm run db:setup   # maakt local.db aan en vult demo-data in
npm run dev
```

> Gebruik Node 22 of 24 (LTS). Op oneven versies (bv. 23) heeft `better-sqlite3` geen prebuilt binary.

### Demo accounts
Alle accounts hebben wachtwoord `achrona` (zie `src/db/seed.ts`).

| Codename | Role        |
|----------|-------------|
| Nova     | `commander` |
| Ember    | `defender`  |
| Rook     | `defender`  |
## Beoordeling
> Hoe wij beoordelen wordt voor de start van de hackathon met alle studenten gedeeld, zodat dit meteen duidelijk is voor iedereen.

- **Creativity (40%):** Biedt de applicatie nieuwe, innovatieve of creatieve oplossingen? Steekt jullie applicatie er bovenuit t.o.v. de andere deelnemers?
- **Functionality (30%):** Welke functionaliteit hebben jullie kunnen voorzien tijdens de hackathon? Is de UI intuïtief en gebruiksvriendelijk? Zijn de functionaliteiten duidelijk voor de gebruikers zonder uitleg/handleiding?
- **Presentation (30%):** Trekt jullie presentatie onze aandacht? Is de presentatie duidelijk en helder over wat jullie gebouwd hebben? Zien we in jullie presentatie de input van alle deelnemers evenwaardig terugkomen?

## Basisopdracht
> Om alle opdrachten gelijkwaardig te beoordelingen, verwachten dit als minimale setup. 
> Hierna kiezen jullie zelf welke uitbreidingen jullie willen toevoegen.

![datamodel](datamodel.png)

Maak een webapplicatie waarin guardians kunnen inloggen. Eens ingelogd, zien ze een lijst met glitches.
Guardians hebben een role.
- Role `defender` kan echoes melden. Elke echo wordt standaard aanzien als een glitch 
- Role `commander` heeft dezelfde rechten als een defender + admin rechten
- Een echo heeft een `timestamp` en een `description`. 

## Uitbreidingen (Optioneel)
> Jullie kiezen zelf wat jullie willen toevoegen. Hieronder alvast wat inspiratie

### Workflow
- **Glitch status:** Een glitch doorloopt verschillende statussen (`LEAKED` → `ASSESSING` → `CONTAINING` → `FIXED`).
- **Zoek/Filters:** Guardians kunnen zoeken op keywords + data filteren en sorteren.
- **Glitches toewijzen:** Een commander kan glitches handmatig toewijzen aan een defender, die vervolgens via echoes updates geeft over deze glitch.
- **Reporting:** Maak de belangrijkste data exporteerbaar via PDF (voor de Hoge Raad van Achrona).
- **Keyboard shortcuts:** Navigeer door de applicatie met sneltoetsen (bv. <kbd>j</kbd> en <kbd>k</kbd> om de vorige/volgende glitch te bekijken).
- **Dark mode:** Zorg dat guardians kunnen switchen tussen dark en light mode. Voorzie evt. een extra lockdown mode die aanduidt dat er een grote aanval aan de gang is.

### Real-time monitoring
- **Live updates:** Nieuwe glitches worden real-time zichtbaar op het scherm.
- **Gauge chart:** Een visuele meter die de hoeveelheid magie in Achrona toont (100% als alles in orde is).
- **Interactieve kaart:** Een kaart (map) die exact toont wáár in Achrona een glitch plaatsvindt.
- **Sensor data:** Het systeem verwerkt IoT-sensordata en toont deze in grafieken op het dashboard.
- **Responsive design:** De applicatie werkt mobile-first en is volledig geoptimaliseerd voor smartphones.
- **Offline mode:** Data blijft beschikbaar bij netwerkuitval, met een duidelijke "offline"-indicator.

### AI Automation
- **Handle duplicates:** AI groepeert gerelateerde echoes automatisch onder dezelfde glitch; admins kunnen handmatig overriden.
- **Glitch types:** AI categoriseert het type en maakt dit visueel duidelijk (bv. met iconen of kleuren).
- **AI-moderation:** AI weert nutteloze echoes en scant beschrijvingen en afbeeldingen op illegale content.
- **Auto-closable glitches:** Glitches sluiten automatisch op basis van echoes (bv. "alles terug in orde"), maar heropenen ook als er een gelijkaardig nieuw probleem binnenkomt.
- **Predictive analysis:** AI maakt zelf glitches aan op basis van data-afwijkingen (bv. data-voorraad die in 5 minuten met 40% zakt).
- **Automatische toewijzing:** AI kiest zelfstandig welke defender het best past bij de glitch.
- **Create Runbook:** AI genereert een stappenplan (runbook) om het specifieke probleem op te lossen.
- **Chatbot:** Een ingebouwde assistent die vragen van operators over actieve incidenten en alerts beantwoordt.

### User engagement
- **Image uploads:** Users kunnen foto's uploaden bij een echo om de situatie te verduidelijken.
- **Speech-to-text:** Defenders op de vlucht kunnen echoes via hun microfoon inspreken i.p.v. te typen.
- **Verstuur notificaties:** Push-notificaties, e-mails of sms-berichten bij kritieke problemen (met instelbare voorkeuren per user).
- **Leaderboard:** Een klassement met badges voor de defenders die de meeste incidenten fixen.


---

## Mission control (our additions)

Everything above is the starter from the organisers and still works: the glitch list, Drizzle + SQLite, TanStack Start, Tailwind.
On top of it we added a live mission control dashboard.

### Run it

Needs **Node 22.12 or newer** (TanStack Start requirement). With nvm: `nvm use 24.1.0`.

```bash
npm install
npm run db:setup   # creates all tables (drizzle-kit push) and seeds the glitches
npm run dev        # http://localhost:3000
```

The simulator starts with the first request and writes one reading per node per metric every second.

### Login and roles

Every page except `/login` needs a logged-in guardian (Maxim's session login, `src/lib/auth.*.ts`). The `/api` routes check the same session.

| | defender | commander |
|---|---|---|
| Mission control, anomalies, node pages, live stream | yes | yes |
| Acknowledge an anomaly | yes | yes |
| Report an echo (new glitch or update) | yes | yes |
| Demo controls (overheating, glitch, Desync wave) | no (hidden, API returns 403) | yes |
| Move a glitch one status forward | only when it is assigned to them | yes (any status, also back) |
| Assign a glitch to a defender | no | yes |
| Delete a glitch, Guardians page | no | yes |

### Glitch workflow

- **Status lifecycle:** every glitch goes `LEAKED` > `ASSESSING` > `CONTAINING` > `FIXED`. The glitch page shows it as a stepper.
- **Assignment:** a commander assigns a glitch to a defender (Commander controls on the glitch page). The defender sees it under **Assigned to me** on the overview, sends updates as echoes, and moves it forward with **Move to ...**.
- **History:** every status change and (re)assignment is stored in `glitch_events` (who, when, from, to) and shown between the echoes.
- **Live:** changes reach every open dashboard through the SSE `glitch` event.
- Code: `src/lib/glitches.functions.ts` (`setGlitchStatus`, `assignGlitch`, `getDefenders`), `src/routes/_app/glitches.$glitchId.tsx`, `src/components/StatusStepper.tsx`.

### What it adds

- **Overview (`/`):** live KPIs, the pixel-art map of Achrona, early warnings, open alerts, four live charts, node cards, and the starter's glitch list below them.
- **Map of Achrona** (`src/components/grid/NetworkMap.tsx`, `map/`): generated pixel terrain (mountains, forests, swamp, desert, river, sea), a pixel-art town per node, roads with flowing mana. Corruption stains the land around a town and spreads visibly along the roads to its neighbours (magenta pulses run from the corrupted town outward); neighbours are marked threatened, early warnings get a blinking "!". Hover or focus a town for its live values, click to open it.
- **Anomalies (`/anomalies`):** anomaly log with sorting, search, filters, pages and acknowledge (TanStack Table).
- **Node detail (`/nodes/$nodeId`):** the four charts of one node with forecast lines, plus demo buttons.
- **Early warning:** a trend line per node and metric predicts when a hard limit will be crossed, before it happens. When the limit is really crossed, the warning is confirmed and its lead time is stored.
- **Predictive glitches:** critical anomalies open a glitch (status `LEAKED`, marked `[auto]`) in the starter's glitch list. A Desync wave becomes one glitch. New glitches appear live.
- **Live updates:** one Server-Sent Events stream (`/api/stream`) writes every event into the TanStack Query cache.
- **Report for the High Council (PDF):** the **Report PDF** button in the top bar downloads `GET /api/report`. It holds the summary, KPIs, glitches by status, 30-minute trend charts, node status, the glitch register, the most important anomalies and the early-warning log, in the app's theme. Any logged-in guardian may export it. Code: `src/server/report/` (react-pdf, fonts from `@fontsource`).
- **Theme:** HTF 2026 "Curse of Achrona". The starter's Tailwind tokens in `src/styles.css` are mapped to the theme colours; dashboard styles are in `src/grid.css`.
- **Light / dark mode:** dark is the default; toggle with the sun/moon button in the top bar or <kbd>T</kbd>. The choice is stored in `localStorage` and applied before the first paint (`src/lib/theme.ts`). Light tokens are at the bottom of `src/styles.css`; Tailwind's `dark:` variant follows the toggle.
- **Stabilizer mini-game:** a glitch in `CONTAINING` can only be fixed by tuning frequency and phase onto its signal and holding it for 2 seconds. Sliders snap onto the target when close. The server re-checks the values (`src/lib/stabilize.ts`, `src/components/Stabilizer.tsx`).
- **Critical = stabilize, not acknowledge:** medium/high alerts have a normal Acknowledge; critical ones show **Stabilize**, which opens the mini-game for that anomaly. The API refuses a plain ack on a critical (409). Acknowledging or stabilizing clears the whole incident (every open alert of that node + metric). See `src/components/grid/AckButton.tsx`.
- **The Desync corrupts the UI, in levels by the number of open errors:** an error is an open incident (one node + metric, last 5 min); critical ones count double. The top bar shows the Magic meter and the level, and a banner flashes when the level changes (`src/dashboard/desync.ts`, bottom of `src/grid.css`).

  | Level | Open errors | What happens |
  |---|---|---|
  | 0 Stable | 0 | clean |
  | 1 Unstable | 1-2 | RGB split on headings and readouts |
  | 2 Corrupted | 3-5 | + trembling buttons, some KPI values turn into `0x4F_CORRUPT` |
  | 3 Desync | 6+ | + cards slip, scanlines roll over the screen |
- **Sound:** a low hum that sinks and pulses as the magic drops, and a chime when something is stabilized or set to FIXED. Off by default; the **Muted / Sound on** button in the top bar controls all sound (`src/dashboard/sound.ts`).
- **Error modes (commander):** under the demo buttons, *Errors: Calm / Normal / Chaos* sets how much random trouble the simulator makes (none, as before, 4×). Synced live to every dashboard. **Clear all errors** (testing) stops all running trouble and acknowledges every open alert, criticals included.
- **Keyboard shortcuts:** press <kbd>?</kbd> for the list. <kbd>N</kbd> new echo, <kbd>G</kbd> <kbd>O</kbd>/<kbd>A</kbd>/<kbd>G</kbd> go to overview/anomalies/guardians, <kbd>J</kbd>/<kbd>K</kbd> next/previous glitch (in the list and on a glitch page), <kbd>U</kbd> back, <kbd>S</kbd> jump to the stabilizer. Shortcuts are ignored while typing (`src/components/KeyboardShortcuts.tsx`).

### Code map

```
src/db/schema.ts            glitches (starter) + nodes, readings, anomalies, early_warnings
src/lib/grid.ts             grid types, metric labels/units, HARD_LIMITS
src/server/grid/
  runtime.ts                starts the simulator once per server process
  simulator.ts              FAKE data source: swap generateReadings() for the real feed
  ingest.ts                 pipeline per tick: forecast > broadcast > store > warn > detect > glitch > confirm
  detector.ts               rolling z-score + hard limits
  forecaster.ts             early warning: trend line + ETA to the limit
  autoGlitch.ts             critical anomalies -> glitch in the glitch list
  queries.ts                Drizzle queries behind the /api routes
  stream.ts, bus.ts         SSE stream and in-process events
src/routes/api/*            TanStack Start server routes (/api/...)
src/routes/                 pages: index, anomalies, nodes.$nodeId
src/dashboard/              API client, query hooks, live stream, alerts, page components
src/components/grid/        one file per dashboard component
```

### API

| Method | Path | |
|---|---|---|
| GET | `/api/nodes` | node list |
| GET | `/api/latest` | latest value per node and metric |
| GET | `/api/series?metric=load&minutes=5[&nodeId=]` | time series (avg, min, max per tick) |
| GET | `/api/anomalies?limit=500[&status=open]` | anomaly log |
| POST | `/api/anomalies/$id/ack` | acknowledge an anomaly |
| GET | `/api/forecasts` | active forecasts with ETA |
| GET | `/api/warnings?limit=100` | early-warning log with lead time |
| GET | `/api/stats` | numbers for the KPI cards |
| GET | `/api/report` | PDF report for the High Council (download) |
| GET | `/api/stream` | SSE: `tick`, `anomaly`, `ack`, `warning`, `warning-confirmed`, `glitch`, `ping` |
| POST | `/api/sim/glitch` `{nodeId?, metric?}` | demo: sudden glitch |
| POST | `/api/sim/ramp` `{nodeId?, metric?}` | demo: slow build-up (the forecaster sees it coming) |
| POST | `/api/sim/desync` | demo: Desync wave |

### Dev note: react-pdf

`package.json` has an npm `overrides` entry for `@react-pdf/hyphenate` (`0.1.0`). The latest `@react-pdf/textkit` asks for `^0.1.1`, which is not published, so `npm install` fails without it.

### Dev note (Windows)

`vite.config.ts` sets Nitro's dev runner to `node-process`. With the default worker-thread runner, the dev server answered every request with `Vite environment "ssr" is unavailable`.
