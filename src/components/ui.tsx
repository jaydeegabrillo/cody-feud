"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return <span className={`logo-text uppercase ${className}`}>Cody Feud</span>;
}

export function TopBar({
  children,
  active,
  wide = false,
}: {
  children?: ReactNode;
  active: "setup" | "host";
  wide?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
      <div className={`mx-auto flex flex-wrap items-center gap-3 px-4 py-3 ${wide ? "max-w-none" : "max-w-7xl"}`}>
        <Link href="/" className="text-3xl leading-none">
          <Logo />
        </Link>
        <nav className="ml-2 flex gap-1 text-sm">
          <Link
            href="/"
            className={`rounded-lg px-3 py-1.5 ${active === "setup" ? "bg-panel-2 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Setup
          </Link>
          <Link
            href="/host"
            className={`rounded-lg px-3 py-1.5 ${active === "host" ? "bg-panel-2 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Host panel
          </Link>
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

export function Section({
  title,
  subtitle,
  step,
  children,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  step?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        {step !== undefined && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold font-bold text-ink">
            {step}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Loading() {
  return (
    <div className="ui-bg grid min-h-screen place-items-center text-slate-400">
      <span className="text-5xl">
        <Logo />
      </span>
    </div>
  );
}

export function openBoardWindow() {
  window.open("/board", "cody-feud-board", "popup=yes,width=1280,height=720");
}

/** Keys used by the host panel; clip shortcuts can't use these. */
export const RESERVED_KEYS = new Set([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "x",
  "arrowleft", "arrowright", "arrowup", "arrowdown", "escape", " ", "enter", "tab",
]);

export function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
