# Gap Trainer

A local-first web app with one job: **convert words you already understand into words you can SAY.**

You log "gaps" — moments during the day where you stalled on or avoided a word while speaking. Claude turns each gap into 2–3 cards with expressions a native professional would actually use, broken down by syllables, stress, and schwa reduction. Then you drill them **out loud**: listen to TTS, record yourself, A/B compare, and grade each rep as smooth or stumbled.

## The Voice Gate

A card cannot become "learned" unless you have **recorded yourself saying it at least 3 times, with the last 2 marked smooth**. The Smooth/Stumbled buttons don't work until a recording exists for the current rep — silent review is physically impossible. Cards with a lifetime stumble ratio above 30% never graduate, no matter how old they are.

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:5173. Allow microphone access when prompted — the app is useless without it (by design).

Notes:

- The API key is read by the Vite dev server only (`vite.config.ts`) and injected into proxied requests server-side. It is never bundled into browser code and never committed (`.env` is gitignored). Restart `npm run dev` after editing `.env`.
- All data (gaps, cards, audio recordings) is stored locally in your browser's IndexedDB. No accounts, no cloud. Clearing site data deletes your deck — use the Anki CSV export as a backup.
- Card generation uses `claude-sonnet-5` with structured outputs, so responses are guaranteed-valid JSON.

## Using it on iPhone (recommended setup)

iOS requires HTTPS for microphone access, so the phone needs a deployed URL — the free Vercel tier works. One-time setup, ~5 minutes:

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import `spoken-english-improver` (pick this branch or merge it to `main` first).
2. Before deploying, add two Environment Variables in the project settings:
   - `ANTHROPIC_API_KEY` — your Anthropic key
   - `APP_TOKEN` — any passcode you invent (e.g. `hufeng-2026`). The deployed URL is public; this stops strangers from spending your API credits. The app asks for it once on your phone and remembers it.
3. Deploy. Vercel auto-detects Vite; the file `api/anthropic/v1/messages.ts` becomes a serverless proxy that injects your API key server-side (same design as local dev — the key never reaches the browser).
4. On your iPhone: open the deployed URL in **Safari** → tap **Share → Add to Home Screen**. It installs as a full-screen app with its own icon.
5. First recording will ask for microphone permission — allow it.

iPhone notes:

- The app is a PWA: Practice works offline (TTS, recording, scheduling are all on-device); only Capture needs the network.
- Your deck lives in the on-device browser storage of the installed app. Installing to the Home Screen gives it durable storage (Safari may evict data from rarely-visited *tabs*, but not from installed apps). Still: export the Anki CSV occasionally as a backup.
- The phone and your computer each have their own local deck — there is no sync (by design, local-first). Pick one as primary; the phone is the natural choice since gaps happen away from your desk.

## Daily loop

1. **Capture** — dump a gap in the input box (Chinese, English, or mixed — messy is fine). Claude generates cards.
2. **Practice** — for each due card: listen (0.75× slow toggle available), record yourself, play both back, tap Smooth or Stumbled.
3. **Requeue** — scheduling is stumble-driven:
   - New cards go through learning steps (10 min → 1 h → 1 day) before entering review — this forces 3+ spoken reps early.
   - A stumble resets the card to the first step (due again in 10 minutes) and lowers its ease.
   - Review intervals grow SM-2 style on smooth reps; cards over the 30% stumble ratio are capped at 3-day intervals and never reach "learned".
4. **Export** — Cards tab → "Export Anki CSV" dumps all cards (expression / example + pronunciation breakdown) in Anki-importable format (`#separator:Comma`, `#html:true` headers included).

## Stack

- Vite + React + TypeScript, Tailwind CSS v4
- Dexie (IndexedDB) for persistence — audio blobs persist across restarts
- Browser `SpeechSynthesis` for TTS, `MediaRecorder` + `getUserMedia` for recording
- Anthropic Messages API via a dev-server proxy (no backend to run)

## Deliberate non-features

No pronunciation scoring/ASR, no accounts, no gamification, no pre-loaded decks, no mobile app, no chat. Every card originates from a real gap you logged.
