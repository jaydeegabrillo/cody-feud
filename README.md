# Cody Feud

A survey-says game show for the Cody team. A **host panel** on your laptop controls a **big-screen board** on the projector/TV, with a **soundboard** of your own clips.

- Two teams, anyone can shout an answer. The host reveals it and taps which team gets the points.
- Wrong answers flash a big red **X** on the board (no strike limit).
- Each team has a **this round** box (resets every question) with their **overall** score above it.
- A **10-second answer timer** the host starts by hand. If it runs out, the board shows **X · TIME'S UP!**
- Questions come from a **CSV** file (Excel / Google Sheets export).
- Upload your own **sound clips**, give them keyboard shortcuts, and have them play automatically on reveals, wrong answers, etc.
- No accounts, no database. Everything is saved in the host laptop's browser and works offline once loaded.

---

## 1. Run it on your computer

**You need:** [Node.js](https://nodejs.org) 20.9 or newer (the LTS installer is fine). Check with:

```bash
node -v
```

Then, in a terminal:

```bash
cd ~/Documents/Projects/cody-feud
npm install        # first time only
npm run dev
```

Open **http://localhost:3000** in Chrome, Edge or Firefox.

To try the production build locally (what Vercel will run):

```bash
npm run build
npm start
```

---

## 2. Set up a game (Setup page `/`)

1. **Teams** – type the two team names.
2. **Questions** – click **Choose CSV file** (or drag one in). Click **Download template** for a ready-made example. A sample set of 5 questions is loaded until you import your own.
3. **Soundboard** – click **+ Add sounds** and pick MP3/WAV/OGG/M4A files.
   - Rename a clip by editing its name.
   - Click the **Key** box and press a letter to give it a shortcut (Backspace clears it). Numbers, X and arrow keys are reserved for the host panel.
   - Under **Play automatically when…**, choose a clip for each game event (see the table below).
4. Set the **volume**.

### Game sounds

The app doesn't ship with any audio. Download the MP3s you want (for example from myinstants.com), upload them in **Setup → Soundboard**, then pick them under **Play automatically when…**:

| Event | When it plays |
|---|---|
| **Round starts** | You click **Next →** (new round). For the first question it plays when you click **Show question on board**. Use your intro clip here. |
| **Correct answer revealed** | You give an answer to a team or reveal it. |
| **Incorrect answer / time's up** | You press **✕ Wrong** (<kbd>X</kbd>) or the timer runs out. |
| **Answer timer** | You click **⏱ Start timer (10s)**. Use your "Intense" clip here. It stops automatically when the timer is stopped, an answer is revealed or marked wrong, or you change questions. |
| **Winner screen** | You switch the board to **End game & show winner**. |

**Auto-matching:** if you leave an event on *Auto*, the app picks a clip by its name: *intro* → round start, *correct* → correct answer, *incorrect / buzzer / wrong* → incorrect, *intense / timer* → timer, *win / applause* → winner. The dropdown shows which clip it found.

### CSV format

One row per answer. Rows with the same question are grouped together. Max 8 answers per question (extra ones are dropped, keeping the highest points). Answers are sorted by points automatically.

| question | answer | points |
|---|---|---|
| Name something people do during a boring meeting | Check their phone | 32 |
| Name something people do during a boring meeting | Doodle | 22 |
| Name a food you'd see at a Filipino party | Lechon | 34 |

- The header row is optional (without one, columns are read in the order question, answer, points).
- You can leave the question cell blank on following rows; it reuses the question above.
- In Excel: **File → Save As → CSV UTF-8**. In Google Sheets: **File → Download → Comma-separated values**.
- Any rows with problems are listed after import, so you can fix and re-upload.

---

## 3. Game day

1. Connect the laptop to the projector/TV as an **extended display** (not mirrored).
   - Mac: System Settings → Displays → set the TV to *Extended display*.
   - Windows: press <kbd>Win</kbd> + <kbd>P</kbd> → *Extend*.
2. Open the app and click **Open board window**. Drag that window onto the projector and click it once to go **full screen** (or press <kbd>F</kbd>; double-click toggles).
3. On your laptop, go to the **Host panel**. The pill in the top bar turns green ("Board connected") when the board is open.
4. Sound plays from the laptop's audio output, so connect speakers or send audio over HDMI.

> Both windows must be in the **same browser on the same computer**. They sync instantly through the browser, no internet needed.

### Running a round

| Do this | Click | Keyboard |
|---|---|---|
| Show / hide the question on the board | **Show question on board** | <kbd>↑</kbd> |
| Give an answer to a team | the team's button on that answer | <kbd>1</kbd>–<kbd>8</kbd>, then <kbd>←</kbd> Team 1 / <kbd>→</kbd> Team 2 |
| Reveal an answer with no points | **Reveal only** | <kbd>1</kbd>–<kbd>8</kbd>, then <kbd>↓</kbd> or <kbd>0</kbd> |
| Wrong answer (big X + sound) | **✕ Wrong** | <kbd>X</kbd> |
| Start / stop the 10-second answer timer | **⏱ Start timer (10s)** | <kbd>Space</kbd> |
| Fix a mistake | **Undo** on a revealed answer (takes the points back) | |
| Show what nobody guessed | **Reveal the rest** | |
| Play a sound | soundboard button | the clip's letter |
| Cancel a selected answer | | <kbd>Esc</kbd> |

- The host panel fills the whole screen. On wide screens the question list sits on the left (click any question to jump to it, played ones get a ✓); use **← Prev / Next →** to move between questions. On smaller screens there's a dropdown instead.
- While the timer runs, the board shows a big countdown in the middle of the screen (it turns red for the last 3 seconds).
- **Scores:** the board shows each team's points for *this round* in the big box (it resets to 0 on every new question) and their **overall** game total above it. On the host panel, **−10 / −5 / +5 / +10** adjust the overall score; click it to type an exact number.
- **Timer:** start it when a player is about to answer. Revealing an answer or pressing Wrong stops it. If it reaches 0, it counts as a wrong answer (X + buzzer + "Time's up!").
- **Board is showing:** switch between *Title screen*, *Game board* and *End game & show winner*.
- **New game (reset scores)** clears scores and reveals but keeps teams, questions and sounds.

---

## 4. Deploy to Vercel

Option A – GitHub (recommended):

1. Create an empty repo on GitHub, then from the project folder:
   ```bash
   git init
   git add -A
   git commit -m "Cody Feud"
   git branch -M main
   git remote add origin https://github.com/<your-account>/cody-feud.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new), import the repo, and click **Deploy**. No settings or environment variables are needed (Vercel detects Next.js).
3. Every push to `main` redeploys automatically.

Option B – Vercel CLI:

```bash
npm i -g vercel
vercel        # preview deploy (log in on first run)
vercel --prod # production deploy
```

### Good to know

- **Questions, scores and sounds are saved per browser, per address.** `localhost:3000` and your `*.vercel.app` URL have separate storage, so re-import your CSV and sounds on the address you'll use on game day (and on the laptop you'll use).
- Clearing browser data for the site removes the saved sounds. Keep your CSV and audio files somewhere safe; use **Export CSV** to back up the current question set.
- Safari private windows may not keep uploaded sounds. Use a normal window.

---

## Project structure

```
src/
  app/
    page.tsx          Setup page (teams, CSV import, soundboard library)
    host/page.tsx     Host control panel
    board/page.tsx    Big-screen board (title, game board, strike X, winner)
    globals.css       Board styling and UI theme
  components/ui.tsx   Shared UI bits (top bar, sections, logo)
  lib/
    store.ts          Game state + sync between windows (localStorage + BroadcastChannel)
    clips.ts          Sound clip storage (IndexedDB) and playback
    csv.ts            CSV import/export
    sample.ts         Sample questions
    types.ts          Shared types
public/
  cody-feud-template.csv
  teams/legion.png       Faded crest behind the left (red) team
  teams/victorious.png   Faded crest behind the right (blue) team
```

Built with Next.js, React and Tailwind CSS. Fonts (Anton, Geist) are bundled locally.

## Troubleshooting

- **Board says nothing / doesn't update:** make sure the board was opened from the app in the same browser (not a different browser or an incognito window). Refresh the board window; it picks up the latest state.
- **No sound:** click anywhere on the host page once (browsers block audio until you interact), check the volume slider and the laptop's output device.
- **Pop-up blocked when opening the board:** allow pop-ups for the site, or open `/board` in a new window manually.
- **`npm install` errors:** update Node.js to the current LTS and try again.
