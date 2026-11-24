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

- **Tabs:** Dashboard (`/`), Map (`/map`), Vitals (`/vitals`), Nodes (`/nodes`), Glitches (`/glitches`), Anomalies, Leaderboard, and Guardians for commanders. Tab bar under the top bar, same items in the sidebar, number keys `1`-`8` switch tabs (list in `src/dashboard/tabs.ts`).
- **Dashboard (`/`):** one-glance view: KPIs, the map with early warnings, open alerts and four mini vitals next to it, the newest open glitches and a node strip. Every block links to its full tab.
- **Themed pages:** Glitches tab (lifecycle cards that filter, search, pages, pixel status chips), glitch page (ribbon header, stepper card, story + side panels), Anomalies (open per severity / metric, most troubled node, z-score bars), Leaderboard (podium on pixel pedestals) and Guardians (roster cards with workload: open assignments, echoes, status moves, stabilized; `src/lib/roster.functions.ts`). Every guardian gets a generated pixel avatar (`PixelAvatar.tsx`).
- **Overview blocks (`src/dashboard/Overview.tsx`):** live KPIs, the pixel-art map of Achrona, early warnings, open alerts, four live charts, node cards, and the starter's glitch list below them.
- **Map of Achrona** (`src/components/grid/NetworkMap.tsx`, `map/`): generated pixel terrain (mountains, forests, swamp, desert, river, sea), a pixel-art town per node, roads with flowing mana. Corruption stains the land around a town and spreads visibly along the roads to its neighbours (magenta pulses run from the corrupted town outward); neighbours are marked threatened, early warnings get a blinking "!". Hover or focus a town for its live values, click to open it.
- **Pixel-art dashboard:** the charts are dark "scrying panels" (pixel grid, stepped line, dithered area, red danger zone above the limit, pixel anomaly markers, low/avg/high/limit chips). Node cards show the town on its own land with a pixel meter per metric (0 to the hard limit). KPIs and section titles have pixel icons (`PixelIcon.tsx`).
- **Anomalies (`/anomalies`):** anomaly log with sorting, search, filters, pages and acknowledge (TanStack Table).
- **Node detail (`/nodes/$nodeId`):** the four charts of one node with forecast lines, plus demo buttons.
- **Early warning:** a trend line per node and metric predicts when a hard limit will be crossed, before it happens. When the limit is really crossed, the warning is confirmed and its lead time is stored.
- **Predictive glitches:** critical anomalies open a glitch (status `LEAKED`, marked `[auto]`) in the starter's glitch list. A Desync wave becomes one glitch. New glitches appear live.
- **Live updates:** one Server-Sent Events stream (`/api/stream`) writes every event into the TanStack Query cache.
- **Report for the High Council (PDF):** the **Report PDF** button in the top bar downloads `GET /api/report`. It holds the summary, KPIs, glitches by status, 30-minute trend charts, node status, the glitch register, the most important anomalies and the early-warning log, in the app's theme. Any logged-in guardian may export it. Code: `src/server/report/` (react-pdf, fonts from `@fontsource`).
- **Theme:** HTF 2026 "Curse of Achrona". The starter's Tailwind tokens in `src/styles.css` are mapped to the theme colours; dashboard styles are in `src/grid.css`.
- **Light / dark mode:** dark is the default; toggle with the sun/moon button in the top bar or <kbd>T</kbd>. The choice is stored in `localStorage` and applied before the first paint (`src/lib/theme.ts`). Light tokens are at the bottom of `src/styles.css`; Tailwind's `dark:` variant follows the toggle.
- **Stabilize mini-games:** a glitch in `CONTAINING` (and a critical anomaly) can only be cleared by winning one of three games. Each incident gets one, fixed by its id; buttons underneath switch to the others (`src/components/StabilizeGame.tsx`).
  - *Frequency tuning:* tune frequency and phase onto the incident's signal and hold it for 2 seconds. Sliders snap onto the target when close (`Stabilizer.tsx`).
  - *Chrono-Pulse Lock:* a skill check on a clock face. A hand sweeps clockwise; press <kbd>Space</kbd> or tap while it is inside the marked zone (the first part is "great"). Two hits in a row lock it; the second turn is faster. Pressing early or letting the hand pass is a miss: combo reset and a small shake (`PulseLock.tsx`).
  - *Rune Sequence:* five runes (each with its own colour and tone) light up in an order of five; repeat it by clicking, tapping or keys <kbd>1</kbd>–<kbd>5</kbd>. A wrong rune buzzes, shakes and replays the sequence (`RuneSequence.tsx`).
  - The server re-checks the proof: a tuned signal, two hits within the time window, or the exact rune sequence (`src/lib/stabilize.ts`). The rune sequence is derived from the incident id on the server too, so that one is checked for real; the other two are reported by the browser, so they stop skipping the game by a click, not a determined cheater.
  - *Timer:* 20 s per attempt (countdown above the game, red in the last 5 s). Time's up is a **fail**, with "Try again".
- **Desync Immunity** (`src/lib/games.ts`, `games.server.ts`): mini-game results change the world, live on every screen.
  - *Flawless win* (Chrono-Pulse without a miss, Runes without a wrong rune, or tuning within 10 s): the guardian gets an **⚡ Aether Charge** next to their codename (sidebar, echo timeline, leaderboard), and the grid gets 10 % more immune: every open error drains less magic (down to −50 %). Top bar shows *Immune x %*.
  - *Fail*: the Desync strikes back: +15 % corruption at once (fading out over 2 minutes, *Backlash +x %* in the top bar), immunity is gone, the guardian's charges reset, and every screen gets a banner and a heavy glitch stinger (`playStinger` in `src/dashboard/sound.ts`).
  - Aether Charges = flawless wins since the guardian's last fail. Immunity lives in server memory, so it resets when the server restarts.
- **Leaderboard (`/leaderboard`, <kbd>G</kbd> <kbd>L</kbd>):** podium, points (win +100, flawless +50, fail −25), wins, flawless, fails, best time and Aether Charges per guardian, plus the latest runs. Every attempt is stored in `game_runs`; the page updates live.
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

### AI automation

An AI model runs these steps (`src/server/ai/`). Every step also has rules built in: without a key (or without wifi) the app keeps working on those, and every decision shows an **AI** or **Rules** tag.

Choose the engine in `.env` (gitignored, see `.env.example`), then restart `npm run dev`:

| `AI_PROVIDER` | Engine | Key |
|---|---|---|
| `gemini` (default when its key is set) | Google Gemini Flash, free tier: `gemini-2.5-flash`, then `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.1-flash-lite` and `gemini-3.5-flash` when one is busy, out of quota or times out (new accounts get a fast 404 on 2.5 and skip it) (`GEMINI_MODEL` to try another model first) | `GEMINI_API_KEY` |
| `claude` | Anthropic Claude (`claude-opus-5-5`) | `ANTHROPIC_API_KEY` |
| `rules` | No AI, built-in rules only | none |

| From the README list | What happens |
|---|---|
| Handle duplicates | A new echo about an open (or recently fixed) glitch joins that glitch instead of opening a new one. Commanders can undo it: **Split into new glitch** on the echo. |
| Glitch types | Every glitch is sorted into temporal, mana, thermal, desync, portal, signal or other, with its own pixel icon and colour in the lists. |
| AI moderation | Spam, gibberish and abusive echoes are refused with a reason (text only: there are no image uploads). |
| Auto-closable glitches | An update that says the problem is gone closes the glitch. In Containing the AI only suggests it, because there the stabilizer mini-game closes glitches. The same problem reported again reopens a fixed glitch. |
| Predictive analysis | The forecaster and the auto-glitches from critical anomalies (see above); they also get a type and a defender (by the rules; set `AI_SYSTEM_GLITCHES=on` to use the AI, which costs about one call a minute). |
| Automatic assignment | A new glitch goes to the defender with the most experience in its type, preferring fewer open assignments. |
| Create runbook | **Write runbook** on a glitch page: a 4-7 step plan, stored on the glitch. |
| Chatbot | **The Oracle** (top-bar button or the `O` key) answers questions about incidents and alerts, using a live snapshot of the grid. |
| Chatbot voice | **Speak** under an answer: the wizard says it out loud. Gemini text-to-speech (deep `Charon` voice, wizard style; `GEMINI_TTS_VOICE` to change it) played with a lower pitch and a stone-tower echo; without it, the browser voice, low and slow. **Stop** cuts it off, the speaker button in the Oracle header mutes the wizard (remembered), and closing the panel silences him. |

One AI call per echo answers moderation, type, duplicate, resolved and assignment together (JSON output against a schema). With Claude, the server-side refusal fallback is turned on for every call. The Oracle panel shows which engine answers.

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
