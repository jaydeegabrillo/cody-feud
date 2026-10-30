"use client";

import { useCallback, useEffect, useState } from "react";
import type { Clip, SoundEvent } from "./types";

/** Sound clips are stored in this browser's IndexedDB (they can be several MB each). */

const DB_NAME = "cody-feud";
const STORE = "clips";
const CHANNEL = "cody-feud-clips";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

function notify() {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage("changed");
    bc.close();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANNEL));
}

export async function listClips(): Promise<Clip[]> {
  const all = await tx<Clip[]>("readonly", (s) => s.getAll() as IDBRequest<Clip[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addClips(files: File[]): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const clip: Clip = {
      id: `${now.toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Sound",
      blob: f,
      key: null,
      createdAt: now + i,
    };
    await tx("readwrite", (s) => s.put(clip));
  }
  notify();
}

export async function updateClip(id: string, patch: Partial<Pick<Clip, "name" | "key">>) {
  const all = await listClips();
  const clip = all.find((c) => c.id === id);
  if (!clip) return;
  await tx("readwrite", (s) => s.put({ ...clip, ...patch }));
  notify();
}

export async function deleteClip(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  notify();
}

/** Live list of clips, refreshed when any window changes them. */
export function useClips() {
  const [clips, setClips] = useState<Clip[] | null>(null);

  const refresh = useCallback(() => {
    listClips()
      .then(setClips)
      .catch(() => setClips([]));
  }, []);

  useEffect(() => {
    refresh();
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = refresh;
    } catch {
      /* ignore */
    }
    window.addEventListener(CHANNEL, refresh);
    return () => {
      bc?.close();
      window.removeEventListener(CHANNEL, refresh);
    };
  }, [refresh]);

  return clips;
}

/* ---------- Playback ---------- */

const urls = new Map<string, { blob: Blob; url: string }>();
const playing = new Set<HTMLAudioElement>();

function urlFor(clip: Clip): string {
  const existing = urls.get(clip.id);
  if (existing && existing.blob === clip.blob) return existing.url;
  if (existing) URL.revokeObjectURL(existing.url);
  const url = URL.createObjectURL(clip.blob);
  urls.set(clip.id, { blob: clip.blob, url });
  return url;
}

export function playClip(clip: Clip, volume = 1) {
  const audio = new Audio(urlFor(clip));
  audio.volume = Math.max(0, Math.min(1, volume));
  playing.add(audio);
  const done = () => playing.delete(audio);
  audio.addEventListener("ended", done);
  audio.addEventListener("pause", done);
  audio.play().catch(done);
  return audio;
}

export function stopAllClips() {
  for (const a of [...playing]) {
    a.pause();
    a.currentTime = 0;
  }
  playing.clear();
}

/* ---------- Event → clip ---------- */

/** Name patterns used to pick a clip automatically when no clip is chosen for an event. */
const NAME_HINTS: Record<SoundEvent, (name: string) => boolean> = {
  question: (n) => /intro|theme|opening/i.test(n),
  reveal: (n) => /correct|ding|right answer|survey says/i.test(n) && !/incorrect|wrong/i.test(n),
  wrong: (n) => /incorrect|wrong|buzz|strike/i.test(n),
  timer: (n) => /intense|timer|clock|countdown|tick/i.test(n),
  win: (n) => /win|victory|applause|celebrat/i.test(n),
};

/** The clip chosen for an event in Setup, or else one whose name fits (e.g. "Intense" for the timer). */
export function clipForEvent(
  event: SoundEvent,
  map: Record<SoundEvent, string | null>,
  clips: Clip[] | null | undefined,
): Clip | undefined {
  if (!clips?.length) return undefined;
  const chosen = map[event];
  if (chosen) {
    const c = clips.find((x) => x.id === chosen);
    if (c) return c;
  }
  return clips.find((c) => NAME_HINTS[event](c.name));
}
