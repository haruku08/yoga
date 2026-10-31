# Haruku Yoga

A yoga app with a built-in pose timer, the sister app of [Haruku Fit](https://haruku08.github.io/workouts/). It's a single `index.html` file with no build step and no install. Open it in any browser on your phone or computer.

## What it does

- **Home:** a dashboard with a quick timer (hold, rest, rounds, sets and set-break settings), your current practice, this week's stats and the routines you pinned. New users start with an empty dashboard and pick what goes on it from the Catalog.
- **Poses:** 31 yoga poses in four groups (Standing, Balance & core, Floor & stretch, Restore), including a full Sun Salutation flow. Each one has an animated figure in a hand-drawn doodle (default), cartoon, realistic or stick-figure style, plus steps and a tip.
- **Ready-made routines (Catalog):** Morning Flow, Sun Salutations, Balance & Core, Hip Opener, Gentle Back Care, Strong Flow and Evening Unwind. Tap Add to Home to put one on your dashboard.
- **My routines:** build, edit and save your own routines, or copy a ready-made one and change it. Star up to four to pin them on Home. Share a routine as a link.
- **Music:** pick Deezer, Spotify, Apple Music or YouTube Music (and optionally paste a playlist link) and tap the music button on the timer to open it; the app asks first and never starts music by itself. Beeps and the recorded coach voice mix over your music instead of pausing it (iOS 16.4+, Silent mode off), and come back by themselves when the music app starts or stops. The calm female coach clips in `voice/` were made with the open Kokoro TTS model (voice `af_heart`).
- **History:** every session you finish (or stop after at least a minute) is saved on the device, with weekly totals and a day streak. **Backup** copies everything as a code or file you can restore later.
- **Timer:** a focused screen without the top bar, with the illustration on top.
- **Design:** Material 3 in a warm rose, blush and terracotta palette with Eczar for the brand and titles and Plus Jakarta Sans for text. Icons are inline SVGs from Lucide (ISC license). Light mode and a warm plum dark mode.
- **Updates:** tap the sync button in the top bar to get the latest version. The app also checks when you open it.

Settings are saved in your browser, separately from Haruku Fit.

## Run it

Live app: https://haruku08.github.io/yoga/

Or open `index.html` in any browser.

## Releasing an update

Bump the version in two places, then push to `main`:

1. `APP_VERSION` in `index.html`
2. `version.json`

Open apps then show "Version X is ready" with an **Update** button.
