"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  currentQuestion,
  onMessage,
  postMessage,
  revealsFor,
  roundPoints,
  teamRoundPoints,
  useCountdown,
  useGame,
} from "@/lib/store";
import type { GameState, Question, Reveal } from "@/lib/types";
import "./board.css";

const TEAM_COLORS = ["#ff3b4a", "#2d8cff"] as const;

export default function BoardPage() {
  const game = useGame();
  const [strike, setStrike] = useState<{ id: number; label?: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  // Let the host know the board is open
  useEffect(() => {
    postMessage({ type: "board-ping" });
    const t = setInterval(() => postMessage({ type: "board-ping" }), 2000);
    return () => clearInterval(t);
  }, []);

  // Big X when the host marks a wrong answer (or time runs out)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onMessage((m) => {
      if (m.type === "fx" && m.fx === "strike") {
        setStrike({ id: m.id, label: m.label });
        clearTimeout(timer);
        timer = setTimeout(() => setStrike(null), m.label ? 2200 : 1650);
      }
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  // Fullscreen: click once, double-click or press F
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.title = "Cody Feud – Board";
  }, []);

  return (
    <div
      className={`bd fixed inset-0 grid place-items-center ${isFullscreen ? "cursor-none" : ""}`}
      onDoubleClick={toggleFullscreen}
      onClick={() => {
        if (!hintDismissed) {
          setHintDismissed(true);
          if (!document.fullscreenElement) toggleFullscreen();
        }
      }}
    >
      <div className="stage">
        <span className="spotlight left" />
        <span className="spotlight right" />
        <span className="floor-glow" />

        {/* Team crests in the background: Legion (left team) and Victorious (right team) */}
        <span className="team-crest left" aria-hidden />
        <span className="team-crest right" aria-hidden />

        {!game ? null : game.phase === "lobby" ? (
          <TitleScreen game={game} />
        ) : game.phase === "ended" ? (
          <WinnerScreen game={game} />
        ) : (
          <GameBoard game={game} />
        )}

        {game && game.phase === "playing" && <Countdown endsAt={game.timerEndsAt} total={game.timerSeconds} />}

        {strike !== null && (
          <div
            key={strike.id}
            className={`strike-overlay pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center ${strike.label ? "long" : ""}`}
          >
            <span className="strike-x text-[58cqh]">X</span>
            {strike.label && <span className="strike-label mt-[1cqh] text-[7cqw]">{strike.label}</span>}
          </div>
        )}

        {!hintDismissed && !isFullscreen && (
          <div className="absolute bottom-[3cqh] left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/60 px-[2cqw] py-[1cqh] text-[1.5cqw] text-white/80">
            Click to go full screen · double-click or press F to toggle
          </div>
        )}
      </div>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

/* ---------------- Marquee bulbs around the gold frame ---------------- */

const BULBS = (() => {
  const along = 26; // top and bottom
  const down = 9; // left and right
  const pts: { left: string; top: string }[] = [];
  for (let i = 0; i < along; i++) {
    const x = `${3 + (i * 94) / (along - 1)}%`;
    pts.push({ left: x, top: "0.85cqw" });
    pts.push({ left: x, top: "calc(100% - 0.85cqw)" });
  }
  for (let i = 0; i < down; i++) {
    const y = `${10 + (i * 80) / (down - 1)}%`;
    pts.push({ left: "0.85cqw", top: y });
    pts.push({ left: "calc(100% - 0.85cqw)", top: y });
  }
  return pts;
})();

function Bulbs() {
  return (
    <>
      {BULBS.map((p, i) => (
        <span key={i} className={`bulb ${i % 4 < 2 ? "" : "odd"}`} style={p} />
      ))}
    </>
  );
}

/* ---------------- Title ---------------- */

function TitleScreen({ game }: { game: GameState }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <div className="rays absolute left-1/2 top-1/2 h-[250cqw] w-[250cqw] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative text-center">
        <div className="pop-in text-[16cqw] leading-none">
          <span className="logo">Cody Feud</span>
        </div>
        <p
          className="display fade-up mt-[2cqh] text-[3cqw] uppercase tracking-[0.3em] text-[#8fd0ff]"
          style={{ animationDelay: "0.4s" }}
        >
          Survey says…
        </p>
        <div className="fade-up mt-[7cqh] flex items-center justify-center gap-[3cqw]" style={{ animationDelay: "0.7s" }}>
          <span
            className="name-plate px-[3cqw] py-[1.4cqh] text-[3.4cqw]"
            style={{ "--team": TEAM_COLORS[0] } as CSSProperties}
          >
            {game.teams[0].name}
          </span>
          <span className="display text-[3cqw] text-white/60">VS</span>
          <span
            className="name-plate px-[3cqw] py-[1.4cqh] text-[3.4cqw]"
            style={{ "--team": TEAM_COLORS[1] } as CSSProperties}
          >
            {game.teams[1].name}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Game board ---------------- */

function GameBoard({ game }: { game: GameState }) {
  const q = currentQuestion(game);
  if (!q) return <TitleScreen game={game} />;
  const reveals = revealsFor(game, q);
  const bank = roundPoints(game, q);
  const allRevealed = reveals.every((r) => r !== null);

  return (
    <div className="absolute inset-0 flex flex-col px-[3.5cqw] pb-[3.5cqh] pt-[2.5cqh]">
      {/* Question banner */}
      <div className="flex h-[17cqh] items-center justify-center text-center">
        {game.showQuestion ? (
          <h1
            key={q.id}
            className="display question-text fade-up uppercase leading-[1.05]"
            style={{
              fontSize: q.text.length > 60 ? "3.2cqw" : q.text.length > 40 ? "3.8cqw" : "4.4cqw",
            }}
          >
            {q.text}
          </h1>
        ) : (
          <span className="text-[6cqw] leading-none">
            <span className="logo">Cody Feud</span>
          </span>
        )}
      </div>

      {/* Round bank */}
      <div className="mb-[2.5cqh] flex flex-col items-center">
        <span className="mini-label mb-[0.6cqh]">
          Round {game.current + 1} of {game.questions.length}
        </span>
        <div
          key={bank}
          className="score-box bump min-w-[13cqw] px-[2cqw] py-[0.6cqh] text-center text-[4.6cqw] leading-none tabular-nums"
        >
          {bank}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-[2.2cqw]">
        <TeamScore
          name={game.teams[0].name}
          overall={game.teams[0].score}
          round={teamRoundPoints(game, q, 0)}
          color={TEAM_COLORS[0]}
        />
        <div className={`board-frame min-w-0 flex-1 ${allRevealed ? "celebrate" : ""}`}>
          <Bulbs />
          <div className="board-inner">
            <Tiles q={q} reveals={reveals} />
          </div>
        </div>
        <TeamScore
          name={game.teams[1].name}
          overall={game.teams[1].score}
          round={teamRoundPoints(game, q, 1)}
          color={TEAM_COLORS[1]}
        />
      </div>
    </div>
  );
}

function Tiles({ q, reveals }: { q: Question; reveals: Reveal[] }) {
  const rows = Math.max(3, Math.ceil(q.answers.length / 2));
  const slots = rows * 2;
  return (
    <div
      className="grid h-full grid-flow-col grid-cols-2 gap-[0.8cqw]"
      style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: slots }, (_, i) => {
        const a = q.answers[i];
        if (!a) return <div key={`${q.id}-${i}`} className="tile-empty" />;
        const r = reveals[i];
        const size = a.text.length > 22 ? "1.7cqw" : a.text.length > 15 ? "2cqw" : undefined;
        return (
          <div key={`${q.id}-${i}`} className={`tile ${r !== null ? "revealed" : ""}`}>
            <div className="tile-inner">
              <div className="tile-face tile-front">
                <span className="tile-number">{i + 1}</span>
              </div>
              <div className="tile-face tile-back">
                <span className="tile-answer" style={size ? { fontSize: size } : undefined}>
                  {a.text}
                </span>
                <span className="tile-points">{a.points}</span>
                <span className={`tile-team ${r === 0 ? "t0" : r === 1 ? "t1" : ""}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamScore({
  name,
  overall,
  round,
  color,
}: {
  name: string;
  overall: number;
  round: number;
  color: string;
}) {
  return (
    <div
      className="flex w-[13.5cqw] shrink-0 flex-col items-center justify-center"
      style={{ "--team": color } as CSSProperties}
    >
      <span className="name-plate w-full truncate px-[0.8cqw] py-[0.8cqh] text-center text-[2.1cqw]">{name}</span>

      {/* Overall (whole game) */}
      <span className="mini-label mt-[2.2cqh]">Overall</span>
      <div
        key={`o${overall}`}
        className="overall-box bump mt-[0.6cqh] w-[85%] py-[0.6cqh] text-center text-[3.4cqw] leading-none tabular-nums"
      >
        {overall}
      </div>

      {/* This round only; resets on every new question */}
      <div
        key={`r${round}`}
        className="score-box team bump mt-[2.8cqh] grid aspect-square w-full place-items-center text-[5.8cqw] tabular-nums"
      >
        {round}
      </div>
      <span className="mini-label mt-[0.9cqh]">This round</span>
    </div>
  );
}

/* ---------------- Countdown (huge, centred) ---------------- */

function Countdown({ endsAt, total }: { endsAt: number | null; total: number }) {
  const left = useCountdown(endsAt, total);
  if (left === null) return null;
  const secs = Math.ceil(left);
  const urgent = secs <= 3;
  const frac = total > 0 ? left / total : 0;
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#040822]/40">
      <div
        key={endsAt}
        className={`countdown relative grid h-[58cqh] w-[58cqh] place-items-center ${urgent ? "urgent" : ""}`}
        role="timer"
        aria-label={`${secs} seconds left`}
      >
        <svg viewBox="0 0 100 100" className="countdown-ring absolute inset-0 h-full w-full -rotate-90">
          <defs>
            <linearGradient id="cd-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff6cf" />
              <stop offset="0.45" stopColor="#ffd34d" />
              <stop offset="1" stopColor="#f0a500" />
            </linearGradient>
            <radialGradient id="cd-disc" cx="50%" cy="35%" r="70%">
              <stop offset="0" stopColor="#2c5bd8" />
              <stop offset="1" stopColor="#0a1a5c" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="49" fill="#3a2200" />
          <circle cx="50" cy="50" r={R} fill="url(#cd-disc)" stroke="rgba(0,0,0,0.45)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={urgent ? "#ff2d3d" : "url(#cd-gold)"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
          <circle cx="50" cy="50" r="38.5" fill="none" stroke="#cfe8ff" strokeOpacity="0.5" strokeWidth="0.8" />
        </svg>
        <div className="relative flex flex-col items-center">
          <span key={secs} className="countdown-num countdown-tick text-[27cqh] tabular-nums">
            {secs}
          </span>
          <span className="mini-label !text-[1.5cqw] !text-white/80">seconds</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Winner ---------------- */

const CONFETTI_COLORS = ["#ffc934", "#4fb3ff", "#ff3b4a", "#2d8cff", "#ffffff"];

function WinnerScreen({ game }: { game: GameState }) {
  const [a, b] = game.teams;
  const tie = a.score === b.score;
  const winner = a.score > b.score ? 0 : 1;

  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <div className="rays absolute left-1/2 top-1/2 h-[250cqw] w-[250cqw] -translate-x-1/2 -translate-y-1/2" />
      {!tie &&
        Array.from({ length: 60 }, (_, i) => (
          <span
            key={i}
            className="confetti"
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDuration: `${3 + ((i * 7) % 30) / 10}s`,
              animationDelay: `${-((i * 13) % 50) / 10}s`,
              transform: `rotate(${i * 29}deg)`,
            }}
          />
        ))}
      <div className="relative text-center">
        <p className="display fade-up text-[3cqw] uppercase tracking-[0.3em] text-[#8fd0ff]">
          {tie ? "Final score" : "And the winner is…"}
        </p>
        <h1
          className="display pop-in mt-[2cqh] text-[10cqw] uppercase leading-none"
          style={{
            animationDelay: "0.3s",
            color: tie ? "#fff" : TEAM_COLORS[winner],
            textShadow: `0 0.5cqw 0 rgba(0,0,0,0.5), 0 0 5cqw ${tie ? "#ffffff55" : TEAM_COLORS[winner] + "88"}`,
          }}
        >
          {tie ? "It's a tie!" : game.teams[winner].name}
        </h1>
        <div className="fade-up mt-[6cqh] flex items-end justify-center gap-[4cqw]" style={{ animationDelay: "0.8s" }}>
          {([0, 1] as const).map((i) => (
            <div key={i} className="flex flex-col items-center" style={{ "--team": TEAM_COLORS[i] } as CSSProperties}>
              <span className="name-plate px-[2cqw] py-[0.8cqh] text-[2.4cqw]">{game.teams[i].name}</span>
              <div className="score-box team mt-[1.5cqh] px-[3cqw] py-[1cqh] text-[6cqw] leading-none tabular-nums">
                {game.teams[i].score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
