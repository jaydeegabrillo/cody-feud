export type Answer = { text: string; points: number };

export type Question = { id: string; text: string; answers: Answer[] };

/** null = hidden, 0 = Team 1 got it, 1 = Team 2 got it, -1 = revealed with no points */
export type Reveal = null | 0 | 1 | -1;

export type Team = { name: string; score: number };

export type Phase = "lobby" | "playing" | "ended";

export const SOUND_EVENTS = ["question", "reveal", "wrong", "timer", "win"] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export const SOUND_EVENT_LABELS: Record<SoundEvent, string> = {
  question: "Round starts (Next button / question shown)",
  reveal: "Correct answer revealed",
  wrong: "Incorrect answer / time's up",
  timer: "Answer timer (e.g. Intense)",
  win: "Winner screen",
};

export type SoundSettings = {
  map: Record<SoundEvent, string | null>;
  volume: number; // 0..1
};

export type GameState = {
  version: 1;
  teams: [Team, Team];
  questions: Question[];
  questionSource: string;
  current: number;
  showQuestion: boolean;
  reveals: Record<string, Reveal[]>;
  wrong: Record<string, number>;
  phase: Phase;
  sound: SoundSettings;
  /** Length of the answer timer in seconds */
  timerSeconds: number;
  /** When the running answer timer ends (ms timestamp), or null when stopped */
  timerEndsAt: number | null;
  updatedAt: number;
};

export const MAX_ANSWERS = 8;

export type Clip = {
  id: string;
  name: string;
  blob: Blob;
  key: string | null; // keyboard shortcut (single lowercase char)
  createdAt: number;
};
