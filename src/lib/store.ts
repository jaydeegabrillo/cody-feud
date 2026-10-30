"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SAMPLE_QUESTIONS } from "./sample";
import type { GameState, Question, Reveal, SoundEvent } from "./types";

/**
 * Game state lives in localStorage on the host computer and is mirrored between
 * the Setup, Host and Board windows with a BroadcastChannel (same browser only).
 */

const STORAGE_KEY = "cody-feud:game";
const CHANNEL_NAME = "cody-feud";

export type ChannelMessage =
  | { type: "state"; state: GameState }
  | { type: "fx"; fx: "strike"; id: number; label?: string }
  | { type: "board-ping" }
  | { type: "hello" };

export function defaultState(): GameState {
  return {
    version: 1,
    teams: [
      { name: "Team 1", score: 0 },
      { name: "Team 2", score: 0 },
    ],
    questions: SAMPLE_QUESTIONS,
    questionSource: "sample",
    current: 0,
    showQuestion: false,
    reveals: {},
    wrong: {},
    phase: "lobby",
    sound: {
      map: { question: null, reveal: null, wrong: null, timer: null, win: null },
      volume: 0.9,
    },
    timerSeconds: 10,
    timerEndsAt: null,
    updatedAt: Date.now(),
  };
}

let current: GameState | null = null;
let initialized = false;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
const messageListeners = new Set<(m: ChannelMessage) => void>();

function readStorage(): GameState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed?.version !== 1) return null;
    // Merge with defaults in case new fields were added
    const d = defaultState();
    return { ...d, ...parsed, sound: { ...d.sound, ...parsed.sound, map: { ...d.sound.map, ...parsed.sound?.map } } };
  } catch {
    return null;
  }
}

function writeStorage(s: GameState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked; the game still works in memory */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  current = readStorage() ?? defaultState();

  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
      const msg = e.data;
      if (msg?.type === "state") {
        current = msg.state;
        emit();
      } else if (msg?.type === "hello" && current) {
        // A window just opened; send it the latest state
        channel?.postMessage({ type: "state", state: current } satisfies ChannelMessage);
      }
      messageListeners.forEach((l) => l(msg));
    };
  }

  // Fallback sync for browsers without BroadcastChannel
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    const next = readStorage();
    if (next) {
      current = next;
      emit();
    }
  });

  channel?.postMessage({ type: "hello" } satisfies ChannelMessage);
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GameState | null {
  init();
  return current;
}

function getServerSnapshot(): GameState | null {
  return null;
}

/** Returns the game state, or null during server render / first paint. */
export function useGame(): GameState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setGame(update: (s: GameState) => GameState) {
  init();
  const next = { ...update(current ?? defaultState()), updatedAt: Date.now() };
  current = next;
  writeStorage(next);
  channel?.postMessage({ type: "state", state: next } satisfies ChannelMessage);
  emit();
}

export function postMessage(msg: ChannelMessage) {
  init();
  channel?.postMessage(msg);
}

export function onMessage(listener: (m: ChannelMessage) => void) {
  init();
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

/* ---------- Helpers & actions ---------- */

export function currentQuestion(s: GameState): Question | null {
  return s.questions[s.current] ?? null;
}

export function revealsFor(s: GameState, q: Question): Reveal[] {
  const r = s.reveals[q.id] ?? [];
  return q.answers.map((_, i) => r[i] ?? null);
}

export function roundPoints(s: GameState, q: Question): number {
  return revealsFor(s, q).reduce<number>(
    (sum, r, i) => (r === 0 || r === 1 ? sum + q.answers[i].points : sum),
    0,
  );
}

/** Points a team has earned on this question (the per-round box on the board). */
export function teamRoundPoints(s: GameState, q: Question, team: 0 | 1): number {
  return revealsFor(s, q).reduce<number>((sum, r, i) => (r === team ? sum + q.answers[i].points : sum), 0);
}

const STOP_TIMER = { timerEndsAt: null } as const;

export const actions = {
  setTeamName(i: 0 | 1, name: string) {
    setGame((s) => {
      const teams = [...s.teams] as GameState["teams"];
      teams[i] = { ...teams[i], name };
      return { ...s, teams };
    });
  },

  adjustScore(i: 0 | 1, delta: number) {
    setGame((s) => {
      const teams = [...s.teams] as GameState["teams"];
      teams[i] = { ...teams[i], score: Math.max(0, teams[i].score + delta) };
      return { ...s, teams };
    });
  },

  setScore(i: 0 | 1, score: number) {
    setGame((s) => {
      const teams = [...s.teams] as GameState["teams"];
      teams[i] = { ...teams[i], score: Math.max(0, Math.round(score) || 0) };
      return { ...s, teams };
    });
  },

  loadQuestions(questions: Question[], source: string) {
    setGame((s) => ({
      ...s,
      questions,
      questionSource: source,
      current: 0,
      reveals: {},
      wrong: {},
      showQuestion: false,
      ...STOP_TIMER,
    }));
  },

  goTo(index: number) {
    setGame((s) => ({
      ...s,
      current: Math.max(0, Math.min(index, s.questions.length - 1)),
      showQuestion: false,
      phase: s.phase === "lobby" ? "lobby" : "playing",
      ...STOP_TIMER,
    }));
  },

  setShowQuestion(show: boolean) {
    setGame((s) => ({ ...s, showQuestion: show, phase: show ? "playing" : s.phase }));
  },

  setPhase(phase: GameState["phase"]) {
    setGame((s) => ({ ...s, phase }));
  },

  /** Reveal an answer. team: 0/1 awards points, -1 reveals with no points. */
  reveal(answerIndex: number, team: 0 | 1 | -1) {
    setGame((s) => {
      const q = currentQuestion(s);
      if (!q) return s;
      const r = revealsFor(s, q);
      if (r[answerIndex] !== null) return s;
      r[answerIndex] = team;
      const teams = [...s.teams] as GameState["teams"];
      if (team === 0 || team === 1) {
        teams[team] = { ...teams[team], score: teams[team].score + q.answers[answerIndex].points };
      }
      return { ...s, teams, reveals: { ...s.reveals, [q.id]: r }, phase: "playing", ...STOP_TIMER };
    });
  },

  /** Hide an answer again and take back any points it awarded. */
  unreveal(answerIndex: number) {
    setGame((s) => {
      const q = currentQuestion(s);
      if (!q) return s;
      const r = revealsFor(s, q);
      const was = r[answerIndex];
      if (was === null) return s;
      r[answerIndex] = null;
      const teams = [...s.teams] as GameState["teams"];
      if (was === 0 || was === 1) {
        teams[was] = { ...teams[was], score: Math.max(0, teams[was].score - q.answers[answerIndex].points) };
      }
      return { ...s, teams, reveals: { ...s.reveals, [q.id]: r } };
    });
  },

  revealRemaining() {
    setGame((s) => {
      const q = currentQuestion(s);
      if (!q) return s;
      const r = revealsFor(s, q).map((x) => (x === null ? -1 : x)) as Reveal[];
      return { ...s, reveals: { ...s.reveals, [q.id]: r }, showQuestion: true, ...STOP_TIMER };
    });
  },

  wrong() {
    setGame((s) => {
      const q = currentQuestion(s);
      if (!q) return s;
      return { ...s, wrong: { ...s.wrong, [q.id]: (s.wrong[q.id] ?? 0) + 1 }, ...STOP_TIMER };
    });
    postMessage({ type: "fx", fx: "strike", id: Date.now() });
  },

  startTimer(seconds = 10) {
    setGame((s) => ({ ...s, timerSeconds: seconds, timerEndsAt: Date.now() + seconds * 1000 }));
  },

  stopTimer() {
    setGame((s) => ({ ...s, ...STOP_TIMER }));
  },

  /** Called by the host panel when the countdown hits zero: counts as a wrong answer. */
  timeUp() {
    setGame((s) => {
      const q = currentQuestion(s);
      const wrong = q ? { ...s.wrong, [q.id]: (s.wrong[q.id] ?? 0) + 1 } : s.wrong;
      return { ...s, wrong, timerEndsAt: null };
    });
    postMessage({ type: "fx", fx: "strike", id: Date.now(), label: "Time's up!" });
  },

  setTimerSeconds(seconds: number) {
    setGame((s) => ({ ...s, timerSeconds: Math.max(3, Math.min(120, Math.round(seconds) || 10)) }));
  },

  /** Reset scores and reveals; keeps teams, questions and sound settings. */
  newGame() {
    setGame((s) => ({
      ...s,
      teams: [
        { ...s.teams[0], score: 0 },
        { ...s.teams[1], score: 0 },
      ],
      current: 0,
      reveals: {},
      wrong: {},
      showQuestion: false,
      phase: "lobby",
      ...STOP_TIMER,
    }));
  },

  setSoundForEvent(event: SoundEvent, clipId: string | null) {
    setGame((s) => ({ ...s, sound: { ...s.sound, map: { ...s.sound.map, [event]: clipId } } }));
  },

  setVolume(volume: number) {
    setGame((s) => ({ ...s, sound: { ...s.sound, volume: Math.max(0, Math.min(1, volume)) } }));
  },
};

/** Seconds left on the answer timer (fractional), or null when it isn't running. */
export function useCountdown(endsAt: number | null, totalSeconds: number): number | null {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 100);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.min(totalSeconds, Math.max(0, (endsAt - now) / 1000));
}
