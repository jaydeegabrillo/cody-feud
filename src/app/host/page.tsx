"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loading, TopBar, isTypingTarget, openBoardWindow } from "@/components/ui";
import { clipForEvent, playClip, stopAllClips, useClips } from "@/lib/clips";
import {
  actions,
  currentQuestion,
  onMessage,
  revealsFor,
  roundPoints,
  teamRoundPoints,
  useCountdown,
  useGame,
} from "@/lib/store";
import type { Clip, GameState, Phase, SoundEvent } from "@/lib/types";

const ANSWER_TIMER_SECONDS = 10;

function useBoardConnected() {
  const [lastPing, setLastPing] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const off = onMessage((m) => {
      if (m.type === "board-ping") setLastPing(Date.now());
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);
  return lastPing > 0 && now - lastPing < 5000;
}

export default function HostPage() {
  const game = useGame();
  const clips = useClips();
  const [armed, setArmed] = useState<number | null>(null);
  const boardConnected = useBoardConnected();

  // Keep the latest values available to keyboard handlers without re-binding them
  const latest = useRef<{ game: GameState | null; clips: Clip[] | null; armed: number | null }>({
    game: null,
    clips: null,
    armed: null,
  });
  useEffect(() => {
    latest.current = { game, clips, armed };
  });

  const timerAudio = useRef<HTMLAudioElement | undefined>(undefined);

  const h = useMemo(() => {
    const play = (ev: SoundEvent) => {
      const { game, clips } = latest.current;
      if (!game) return undefined;
      const clip = clipForEvent(ev, game.sound.map, clips);
      return clip ? playClip(clip, game.sound.volume) : undefined;
    };
    // Questions whose intro has already played (so "Show question" doesn't replay it after Next)
    const introPlayedFor = new Set<string>();
    const playIntro = (questionId: string | undefined) => {
      if (!questionId || introPlayedFor.has(questionId)) return;
      introPlayedFor.add(questionId);
      play("question");
    };
    const stopTimerAudio = () => {
      timerAudio.current?.pause();
      timerAudio.current = undefined;
    };
    return {
      play,
      stopTimerAudio,
      reveal(i: number, team: 0 | 1 | -1) {
        actions.reveal(i, team);
        play("reveal");
        setArmed(null);
      },
      wrong() {
        actions.wrong();
        play("wrong");
      },
      toggleQuestion() {
        const g = latest.current.game;
        if (!g) return;
        const show = !g.showQuestion;
        actions.setShowQuestion(show);
        if (show) playIntro(g.questions[g.current]?.id);
      },
      goTo(i: number) {
        actions.goTo(i);
        setArmed(null);
      },
      /** Next question = new round: plays the intro sound. */
      next() {
        const g = latest.current.game;
        if (!g || g.current >= g.questions.length - 1) return;
        actions.goTo(g.current + 1);
        setArmed(null);
        stopAllClips();
        introPlayedFor.delete(g.questions[g.current + 1].id);
        playIntro(g.questions[g.current + 1].id);
      },
      toggleTimer() {
        const g = latest.current.game;
        if (!g) return;
        stopTimerAudio();
        if (g.timerEndsAt) {
          actions.stopTimer();
        } else {
          actions.startTimer(ANSWER_TIMER_SECONDS);
          timerAudio.current = play("timer"); // e.g. your "Intense" clip
        }
      },
      setPhase(p: Phase) {
        const g = latest.current.game;
        actions.setPhase(p);
        if (p === "ended" && g?.phase !== "ended") play("win");
      },
    };
  }, []);

  // Answer timer: play the timer sound while it runs, and buzz when time is up.
  // Any reveal, wrong answer or question change stops the timer (and its sound).
  const timerEndsAt = game?.timerEndsAt ?? null;
  useEffect(() => {
    if (!timerEndsAt) return;
    const msLeft = timerEndsAt - Date.now();
    if (msLeft < -2000) {
      actions.stopTimer(); // stale timer from an earlier session
      return;
    }
    const t = setTimeout(() => {
      if (latest.current.game?.timerEndsAt !== timerEndsAt) return;
      h.stopTimerAudio();
      actions.timeUp();
      h.play("wrong");
    }, Math.max(0, msLeft));
    return () => {
      clearTimeout(t);
      h.stopTimerAudio(); // timer stopped, answer revealed/wrong, or question changed
    };
  }, [timerEndsAt, h]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const { game, clips, armed } = latest.current;
      if (!game) return;
      const q = currentQuestion(game);
      const key = e.key.toLowerCase();

      if (/^[1-8]$/.test(key) && q) {
        const i = Number(key) - 1;
        if (i < q.answers.length && revealsFor(game, q)[i] === null) setArmed(i);
        e.preventDefault();
        return;
      }
      if (armed !== null) {
        if (key === "arrowleft") return void (e.preventDefault(), h.reveal(armed, 0));
        if (key === "arrowright") return void (e.preventDefault(), h.reveal(armed, 1));
        if (key === "arrowdown" || key === "0") return void (e.preventDefault(), h.reveal(armed, -1));
      }
      if (key === "escape") return setArmed(null);
      if (key === "x") return void (e.preventDefault(), h.wrong());
      if (key === "arrowup") return void (e.preventDefault(), h.toggleQuestion());
      if (key === " ") return void (e.preventDefault(), h.toggleTimer());

      const clip = clips?.find((c) => c.key === key);
      if (clip) {
        e.preventDefault();
        playClip(clip, game.sound.volume);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);

  if (!game) return <Loading />;
  const q = currentQuestion(game);

  const teamRound: [number, number] = q ? [teamRoundPoints(game, q, 0), teamRoundPoints(game, q, 1)] : [0, 0];

  return (
    <div className="ui-bg flex min-h-screen flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <TopBar active="host" wide>
        <span
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${boardConnected ? "border-emerald-700 text-emerald-300" : "border-line text-slate-400"}`}
        >
          <span className={`h-2 w-2 rounded-full ${boardConnected ? "bg-emerald-400" : "bg-slate-500"}`} />
          {boardConnected ? "Board connected" : "Board not open"}
        </span>
        <button className="btn" onClick={openBoardWindow}>
          Open board window
        </button>
      </TopBar>

      {/* Fills the whole screen: questions | current round | scores & sounds */}
      <main className="grid flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[270px_minmax(0,1fr)_360px] 2xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <aside className="hidden min-h-0 flex-col gap-4 xl:flex">
          <PhaseBar phase={game.phase} onChange={h.setPhase} vertical />
          <QuestionList game={game} onPick={h.goTo} />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="xl:hidden">
            <PhaseBar phase={game.phase} onChange={h.setPhase} />
          </div>
          {q ? (
            <QuestionPanel game={game} armed={armed} setArmed={setArmed} h={h} />
          ) : (
            <div className="card p-8 text-center text-slate-400">
              No questions loaded. <Link href="/" className="text-gold underline">Import a CSV in Setup</Link>.
            </div>
          )}
        </section>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4 lg:overflow-y-auto">
          <Scores game={game} roundTotal={q ? roundPoints(game, q) : 0} teamRound={teamRound} />
          <Soundboard clips={clips} volume={game.sound.volume} />
          <Shortcuts />
        </aside>
      </main>
    </div>
  );
}

function QuestionList({ game, onPick }: { game: GameState; onPick: (i: number) => void }) {
  return (
    <section className="card flex min-h-0 flex-1 flex-col p-3">
      <h2 className="px-2 pb-2 pt-1 text-sm font-semibold text-slate-300">
        Questions <span className="font-normal text-slate-500">({game.questions.length})</span>
      </h2>
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {game.questions.map((qq, i) => {
          const played = (game.reveals[qq.id] ?? []).some((r) => r !== null);
          const active = i === game.current;
          return (
            <li key={qq.id}>
              <button
                onClick={() => onPick(i)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  active ? "bg-sky/15 text-white ring-1 ring-sky/60" : "text-slate-300 hover:bg-panel-2"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    active ? "bg-sky text-ink" : played ? "bg-emerald-500/20 text-emerald-300" : "bg-panel-2 text-slate-400"
                  }`}
                >
                  {played && !active ? "✓" : i + 1}
                </span>
                <span className="line-clamp-2">{qq.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PhaseBar({
  phase,
  onChange,
  vertical = false,
}: {
  phase: Phase;
  onChange: (p: Phase) => void;
  vertical?: boolean;
}) {
  const opts: { p: Phase; label: string }[] = [
    { p: "lobby", label: "Title screen" },
    { p: "playing", label: "Game board" },
    { p: "ended", label: "End game & show winner" },
  ];
  return (
    <div className={`card flex gap-3 p-3 ${vertical ? "flex-col" : "flex-wrap items-center"}`}>
      <span className="pl-1 text-sm text-slate-400">Board is showing:</span>
      <div className={`flex gap-1 rounded-xl bg-ink/60 p-1 ${vertical ? "flex-col" : "flex-wrap"}`}>
        {opts.map((o) => (
          <button
            key={o.p}
            onClick={() => onChange(o.p)}
            className={`rounded-lg px-3 py-1.5 text-left text-sm font-semibold transition ${
              phase === o.p
                ? o.p === "ended"
                  ? "bg-gold text-ink"
                  : "bg-sky text-ink"
                : "text-slate-300 hover:bg-panel-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Handlers = {
  reveal: (i: number, team: 0 | 1 | -1) => void;
  wrong: () => void;
  toggleTimer: () => void;
  toggleQuestion: () => void;
  goTo: (i: number) => void;
  next: () => void;
};

function QuestionPanel({
  game,
  armed,
  setArmed,
  h,
}: {
  game: GameState;
  armed: number | null;
  setArmed: (i: number | null) => void;
  h: Handlers;
}) {
  const q = currentQuestion(game)!;
  const reveals = revealsFor(game, q);
  const allRevealed = reveals.every((r) => r !== null);
  const wrongCount = game.wrong[q.id] ?? 0;

  return (
    <section className="card flex min-h-0 flex-1 flex-col p-4 2xl:p-5">
      {/* On wide screens the question list sidebar replaces this row */}
      <div className="mb-4 flex flex-wrap items-center gap-2 xl:hidden">
        <button className="btn" disabled={game.current === 0} onClick={() => h.goTo(game.current - 1)}>
          ← Prev
        </button>
        <select
          className="input min-w-0 flex-1 basis-0"
          value={game.current}
          onChange={(e) => h.goTo(Number(e.target.value))}
          aria-label="Choose question"
        >
          {game.questions.map((qq, i) => {
            const played = (game.reveals[qq.id] ?? []).some((r) => r !== null);
            return (
              <option key={qq.id} value={i}>
                {i + 1}. {qq.text} {played ? "✓" : ""}
              </option>
            );
          })}
        </select>
        <button
          className="btn"
          disabled={game.current >= game.questions.length - 1}
          onClick={h.next}
          title="Next question (plays the intro)"
        >
          Next →
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-start gap-3 rounded-xl bg-ink/50 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Question {game.current + 1} of {game.questions.length}
          </p>
          <p className="mt-1 text-xl font-semibold 2xl:text-2xl">{q.text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn hidden xl:inline-flex"
            disabled={game.current === 0}
            onClick={() => h.goTo(game.current - 1)}
          >
            ← Prev
          </button>
          <button
            className="btn hidden xl:inline-flex"
            disabled={game.current >= game.questions.length - 1}
            onClick={h.next}
            title="Next question (plays the intro)"
          >
            Next →
          </button>
          <button className={`btn ${game.showQuestion ? "" : "btn-gold"}`} onClick={h.toggleQuestion}>
            {game.showQuestion ? "Hide question" : "Show question on board"}
          </button>
        </div>
      </div>

      <ul
        className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1"
        style={{ gridAutoRows: "minmax(52px, 1fr)" }}
      >
        {q.answers.map((a, i) => {
          const r = reveals[i];
          const isArmed = armed === i && r === null;
          return (
            <li
              key={i}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-2 pl-3 transition ${
                r !== null
                  ? "border-line bg-ink/30 opacity-80"
                  : isArmed
                    ? "border-gold bg-gold/10"
                    : "border-line bg-panel-2/50"
              }`}
            >
              <button
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173a9e] font-bold xl:h-10 xl:w-10 xl:text-lg"
                onClick={() => r === null && setArmed(isArmed ? null : i)}
                title="Select (keyboard)"
              >
                {i + 1}
              </button>
              <span className="min-w-0 flex-1 text-base font-semibold xl:text-lg">{a.text}</span>
              <span className="w-12 text-right text-lg font-bold tabular-nums text-gold xl:text-xl">{a.points}</span>
              {r === null ? (
                <span className="flex flex-wrap gap-1.5">
                  <button
                    className="btn !border-team1/60 !bg-team1/15 !py-1.5 hover:!bg-team1/30"
                    onClick={() => h.reveal(i, 0)}
                  >
                    {game.teams[0].name || "Team 1"}
                  </button>
                  <button
                    className="btn !border-team2/60 !bg-team2/15 !py-1.5 hover:!bg-team2/30"
                    onClick={() => h.reveal(i, 1)}
                  >
                    {game.teams[1].name || "Team 2"}
                  </button>
                  <button className="btn !py-1.5" onClick={() => h.reveal(i, -1)} title="Reveal without giving points">
                    Reveal only
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      r === 0 ? "bg-team1/20 text-team1" : r === 1 ? "bg-team2/20 text-team2" : "bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    {r === -1 ? "Revealed" : `${game.teams[r].name || `Team ${r + 1}`} +${a.points}`}
                  </span>
                  <button className="btn !px-2.5 !py-1 text-xs" onClick={() => actions.unreveal(i)}>
                    Undo
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          className="btn !border-strike !bg-strike !px-6 !py-3 !text-lg !text-white hover:!brightness-110"
          onClick={h.wrong}
        >
          ✕ Wrong
          {wrongCount > 0 && (
            <span className="rounded-full bg-white/20 px-2 text-sm tabular-nums" title="Wrong answers this round">
              {wrongCount}
            </span>
          )}
        </button>
        <TimerButton game={game} onToggle={h.toggleTimer} />
        <button
          className="btn ml-auto"
          disabled={allRevealed}
          onClick={() => actions.revealRemaining()}
          title="Show the answers nobody guessed (no points)"
        >
          Reveal the rest
        </button>
      </div>
    </section>
  );
}

function TimerButton({ game, onToggle }: { game: GameState; onToggle: () => void }) {
  const left = useCountdown(game.timerEndsAt, game.timerSeconds);
  const running = left !== null;
  return (
    <button
      className={`btn !px-5 !py-3 !text-lg tabular-nums ${
        running ? (left <= 3 ? "!border-strike !text-strike" : "!border-gold !text-gold") : "btn-gold"
      }`}
      onClick={onToggle}
      title="Space"
    >
      {running ? `⏱ ${Math.ceil(left)}s · Stop` : `⏱ Start timer (${ANSWER_TIMER_SECONDS}s)`}
    </button>
  );
}

function Scores({
  game,
  roundTotal,
  teamRound,
}: {
  game: GameState;
  roundTotal: number;
  teamRound: [number, number];
}) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Scores</h2>
        <span className="text-sm text-slate-400">
          This round: <b className="text-gold">{roundTotal}</b>
        </span>
      </div>
      <div className="space-y-3">
        {([0, 1] as const).map((i) => (
          <div key={i} className="rounded-xl bg-ink/50 p-3">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${i === 0 ? "bg-team1" : "bg-team2"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{game.teams[i].name || `Team ${i + 1}`}</span>
                <span className="text-xs text-slate-400">
                  This round: <b className="text-white">{teamRound[i]}</b>
                </span>
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-500">Overall</span>
              <button
                className="font-display text-4xl tabular-nums text-white hover:text-gold"
                title="Click to set overall score"
                onClick={() => {
                  const v = prompt(`Set score for ${game.teams[i].name}`, String(game.teams[i].score));
                  if (v !== null && v.trim() !== "" && !Number.isNaN(Number(v))) actions.setScore(i, Number(v));
                }}
              >
                {game.teams[i].score}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[-10, -5, 5, 10].map((d) => (
                <button key={d} className="btn !py-1 text-xs" onClick={() => actions.adjustScore(i, d)}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        className="btn btn-danger mt-3 w-full"
        onClick={() => {
          if (confirm("Start a new game? Scores and revealed answers will be reset.")) actions.newGame();
        }}
      >
        New game (reset scores)
      </button>
    </section>
  );
}

function Soundboard({ clips, volume }: { clips: Clip[] | null; volume: number }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Soundboard</h2>
        <button className="btn !py-1 text-xs" onClick={stopAllClips}>
          ■ Stop all
        </button>
      </div>
      {clips && clips.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {clips.map((c) => (
            <button
              key={c.id}
              className="btn relative !min-h-14 !justify-start !text-left"
              onClick={() => playClip(c, volume)}
            >
              <span className="line-clamp-2 flex-1">{c.name}</span>
              {c.key && <span className="kbd uppercase">{c.key}</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No sounds yet. <Link href="/" className="text-gold underline">Add clips in Setup</Link>.
        </p>
      )}
      <label className="mt-4 flex items-center gap-3 text-sm text-slate-400">
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => actions.setVolume(Number(e.target.value))}
          className="flex-1 accent-[#ffc934]"
        />
      </label>
    </section>
  );
}

function Shortcuts() {
  const items: [string, string][] = [
    ["1–8", "select answer"],
    ["←", "give to Team 1"],
    ["→", "give to Team 2"],
    ["↓ / 0", "reveal, no points"],
    ["X", "wrong answer"],
    ["↑", "show/hide question"],
    ["Space", "start/stop timer"],
    ["Esc", "cancel"],
    ["A–Z", "sound shortcuts"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-slate-400">
      {items.map(([k, v]) => (
        <span key={k}>
          <span className="kbd">{k}</span> {v}
        </span>
      ))}
    </div>
  );
}
