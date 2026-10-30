"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Loading, RESERVED_KEYS, Section, TopBar, openBoardWindow } from "@/components/ui";
import { addClips, clipForEvent, deleteClip, playClip, stopAllClips, updateClip, useClips } from "@/lib/clips";
import { parseQuestionsCsv, questionsToCsv, type ImportResult } from "@/lib/csv";
import { SAMPLE_QUESTIONS } from "@/lib/sample";
import { actions, useGame } from "@/lib/store";
import { SOUND_EVENTS, SOUND_EVENT_LABELS, type Clip } from "@/lib/types";

export default function SetupPage() {
  const game = useGame();
  const clips = useClips();
  if (!game) return <Loading />;

  return (
    <div className="ui-bg min-h-screen">
      <TopBar active="setup">
        <button className="btn" onClick={openBoardWindow}>
          Open board window
        </button>
        <Link href="/host" className="btn btn-gold">
          Go to host panel →
        </Link>
      </TopBar>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="grid min-w-0 content-start gap-5">
          <TeamsSection />
          <QuestionsSection />
        </div>
        <div className="grid min-w-0 content-start gap-5">
          <SoundsSection clips={clips} />
          <Section step={4} title="Play" subtitle="Everything is saved in this browser automatically.">
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-300">
              <li>Connect the laptop to the projector or TV (extended display).</li>
              <li>
                Click <b>Open board window</b>, drag it to the projector, then click it to go full screen.
              </li>
              <li>Run the game from the host panel on your laptop screen.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={openBoardWindow}>
                Open board window
              </button>
              <Link href="/host" className="btn btn-gold">
                Go to host panel →
              </Link>
              <button
                className="btn btn-danger ml-auto"
                onClick={() => {
                  if (confirm("Start a new game? Scores and revealed answers will be reset.")) actions.newGame();
                }}
              >
                Reset scores
              </button>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}

function TeamsSection() {
  const game = useGame()!;
  return (
    <Section step={1} title="Teams" subtitle="Anyone can shout an answer; the host gives the points to the right team.">
      <div className="grid gap-3 sm:grid-cols-2">
        {([0, 1] as const).map((i) => (
          <label key={i} className="block">
            <span className="mb-1 flex items-center gap-2 text-sm text-slate-400">
              <span className={`h-3 w-3 rounded-full ${i === 0 ? "bg-team1" : "bg-team2"}`} />
              Team {i + 1} name
            </span>
            <input
              className="input"
              value={game.teams[i].name}
              maxLength={24}
              onChange={(e) => actions.setTeamName(i, e.target.value)}
            />
          </label>
        ))}
      </div>
    </Section>
  );
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function QuestionsSection() {
  const game = useGame()!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<(ImportResult & { file: string }) | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const r = parseQuestionsCsv(text);
    setResult({ ...r, file: file.name });
    if (r.questions.length > 0) actions.loadQuestions(r.questions, file.name);
  }

  const isSample = game.questionSource === "sample";

  return (
    <Section
      step={2}
      title="Questions"
      subtitle={
        <>
          Upload a CSV with columns <code className="kbd">question</code> <code className="kbd">answer</code>{" "}
          <code className="kbd">points</code>, one row per answer (up to 8 per question).
        </>
      }
    >
      <div
        className={`mb-3 rounded-xl border-2 border-dashed p-5 text-center transition ${dragging ? "border-gold bg-gold/5" : "border-line"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <p className="mb-3 text-sm text-slate-300">Drop a .csv file here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-gold" onClick={() => fileRef.current?.click()}>
            Choose CSV file
          </button>
          <a className="btn" href="/cody-feud-template.csv" download>
            Download template
          </a>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-slate-500">
          Using Excel or Google Sheets? Use <i>File → Save as / Download → CSV</i>.
        </p>
      </div>

      {result && (
        <div
          className={`mb-3 rounded-lg border p-3 text-sm ${result.questions.length ? "border-emerald-700 bg-emerald-950/40" : "border-red-800 bg-red-950/40"}`}
        >
          {result.questions.length > 0 ? (
            <p className="font-medium text-emerald-300">
              Loaded {result.questions.length} question{result.questions.length === 1 ? "" : "s"} from {result.file}.
            </p>
          ) : (
            <p className="font-medium text-red-300">Couldn&apos;t load {result.file}.</p>
          )}
          {[...result.errors, ...result.warnings].length > 0 && (
            <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5 text-slate-300">
              {[...result.errors, ...result.warnings].map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">
          {game.questions.length} question{game.questions.length === 1 ? "" : "s"} loaded
          {isSample ? " (sample set)" : ` from ${game.questionSource}`}
        </span>
        <span className="ml-auto flex gap-2">
          <button className="btn !px-2.5 !py-1 text-xs" onClick={() => download("cody-feud-questions.csv", questionsToCsv(game.questions))}>
            Export CSV
          </button>
          {!isSample && (
            <button
              className="btn !px-2.5 !py-1 text-xs"
              onClick={() => {
                if (confirm("Replace your questions with the sample set?")) actions.loadQuestions(SAMPLE_QUESTIONS, "sample");
              }}
            >
              Use sample set
            </button>
          )}
        </span>
      </div>

      <ol className="max-h-[420px] space-y-1.5 overflow-auto pr-1">
        {game.questions.map((q, i) => (
          <li key={q.id}>
            <details className="group rounded-lg border border-line bg-ink/40">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm">
                <span className="w-6 shrink-0 text-right text-slate-500">{i + 1}.</span>
                <span className="flex-1">{q.text}</span>
                <span className="shrink-0 text-xs text-slate-500">{q.answers.length} answers</span>
                <span className="text-slate-500 transition group-open:rotate-90">›</span>
              </summary>
              <ul className="grid gap-1 px-3 pb-3 pl-12 text-sm sm:grid-cols-2">
                {q.answers.map((a, j) => (
                  <li key={j} className="flex justify-between gap-2 rounded bg-panel-2/60 px-2 py-1">
                    <span>{a.text}</span>
                    <span className="font-semibold text-gold">{a.points}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function SoundsSection({ clips }: { clips: Clip[] | null }) {
  const game = useGame()!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list].filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(f.name));
    if (!files.length) {
      setError("Those files don't look like audio. Use MP3, WAV, OGG or M4A.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await addClips(files);
    } catch {
      setError("Couldn't save the sound. The browser may be out of storage space.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      step={3}
      title="Soundboard"
      subtitle="Upload your own clips. Give them a key to trigger from the host panel, and pick which clip plays on game events."
      action={
        <button className="btn btn-gold" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Saving…" : "+ Add sounds"}
        </button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="mb-3 rounded-lg border border-red-800 bg-red-950/40 p-2 text-sm text-red-300">{error}</p>}

      {clips === null ? (
        <p className="text-sm text-slate-500">Loading sounds…</p>
      ) : clips.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed border-line p-6 text-center text-sm text-slate-400"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          No sounds yet. Drop MP3/WAV files here or click <b>Add sounds</b>.
        </div>
      ) : (
        <ul
          className="mb-5 space-y-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          {clips.map((c) => (
            <ClipRow key={c.id} clip={c} clips={clips} volume={game.sound.volume} />
          ))}
        </ul>
      )}

      {clips && clips.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-300">Play automatically when…</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {SOUND_EVENTS.map((ev) => (
              <label key={ev} className="block text-sm">
                <span className="mb-1 block text-slate-400">{SOUND_EVENT_LABELS[ev]}</span>
                <select
                  className="input"
                  value={game.sound.map[ev] ?? ""}
                  onChange={(e) => actions.setSoundForEvent(ev, e.target.value || null)}
                >
                  <option value="">
                    {(() => {
                      const auto = clipForEvent(ev, { ...game.sound.map, [ev]: null }, clips);
                      return auto ? `Auto: ${auto.name}` : "— No sound —";
                    })()}
                  </option>
                  {clips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </>
      )}

      <label className="mt-5 flex items-center gap-3 text-sm text-slate-400">
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={game.sound.volume}
          onChange={(e) => actions.setVolume(Number(e.target.value))}
          className="flex-1 accent-[#ffc934]"
        />
        <span className="w-10 text-right">{Math.round(game.sound.volume * 100)}%</span>
      </label>
    </Section>
  );
}

function ClipRow({ clip, clips, volume }: { clip: Clip; clips: Clip[]; volume: number }) {
  const [name, setName] = useState(clip.name);
  const [keyError, setKeyError] = useState<string | null>(null);

  function setKey(k: string | null) {
    if (k === null) {
      setKeyError(null);
      updateClip(clip.id, { key: null });
      return;
    }
    const key = k.toLowerCase();
    if (key.length !== 1 || RESERVED_KEYS.has(key)) {
      setKeyError("Numbers, X and arrows are used by the host panel. Pick a letter.");
      return;
    }
    const other = clips.find((c) => c.id !== clip.id && c.key === key);
    if (other) {
      setKeyError(`"${key.toUpperCase()}" is already used by ${other.name}.`);
      return;
    }
    setKeyError(null);
    updateClip(clip.id, { key });
  }

  return (
    <li className="rounded-lg border border-line bg-ink/40 p-2">
      <div className="flex items-center gap-2">
        <button
          className="btn !h-9 !w-9 !p-0"
          title="Preview"
          aria-label={`Preview ${clip.name}`}
          onClick={() => {
            stopAllClips();
            playClip(clip, volume);
          }}
        >
          ▶
        </button>
        <input
          className="input !py-1.5"
          value={name}
          maxLength={32}
          aria-label="Sound name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== clip.name && updateClip(clip.id, { name: name.trim() })}
        />
        <input
          className="input !w-16 !py-1.5 text-center uppercase"
          value={clip.key ?? ""}
          placeholder="Key"
          aria-label="Keyboard shortcut"
          title="Keyboard shortcut on the host panel"
          readOnly
          onKeyDown={(e) => {
            if (e.key === "Tab") return;
            e.preventDefault();
            if (e.key === "Backspace" || e.key === "Delete") setKey(null);
            else setKey(e.key);
          }}
        />
        <button
          className="btn btn-danger !h-9 !w-9 !p-0"
          title="Delete"
          aria-label={`Delete ${clip.name}`}
          onClick={() => {
            if (confirm(`Delete "${clip.name}"?`)) deleteClip(clip.id);
          }}
        >
          ✕
        </button>
      </div>
      {keyError && <p className="mt-1 pl-11 text-xs text-red-300">{keyError}</p>}
    </li>
  );
}
