import Papa from "papaparse";
import { MAX_ANSWERS, type Question } from "./types";

export type ImportResult = {
  questions: Question[];
  warnings: string[];
  errors: string[];
};

const norm = (s: unknown) => String(s ?? "").trim();

/**
 * Parse a CSV with columns: question, answer, points.
 * One row per answer. Rows with the same question text are grouped together.
 * A header row is optional; without one, the first three columns are used in that order.
 */
export function parseQuestionsCsv(text: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  const rows = parsed.data.filter((r) => Array.isArray(r) && r.some((c) => norm(c)));

  if (rows.length === 0) {
    return { questions: [], warnings, errors: ["The file is empty."] };
  }

  // Detect header row
  let qCol = 0;
  let aCol = 1;
  let pCol = 2;
  let start = 0;
  const header = rows[0].map((c) => norm(c).toLowerCase());
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const hq = find("question", "questions", "survey question", "prompt");
  const ha = find("answer", "answers", "response");
  const hp = find("points", "point", "score", "pts", "count");
  if (hq !== -1 || ha !== -1 || hp !== -1) {
    if (hq === -1 || ha === -1 || hp === -1) {
      errors.push(
        'The header row must include "question", "answer" and "points" columns.',
      );
      return { questions: [], warnings, errors };
    }
    qCol = hq;
    aCol = ha;
    pCol = hp;
    start = 1;
  } else if (rows[0].length < 3) {
    errors.push("Expected 3 columns: question, answer, points. Download the template to see the format.");
    return { questions: [], warnings, errors };
  }

  const order: string[] = [];
  const groups = new Map<string, { text: string; answers: { text: string; points: number }[] }>();
  let lastQuestion = "";

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    // A blank question cell continues the previous question (handy in spreadsheets)
    const q = norm(row[qCol]) || lastQuestion;
    const a = norm(row[aCol]);
    const pRaw = norm(row[pCol]);

    if (!q) {
      errors.push(`Row ${line}: missing question.`);
      continue;
    }
    lastQuestion = q;
    if (!a) {
      warnings.push(`Row ${line}: no answer, skipped.`);
      continue;
    }
    const cleaned = pRaw.replace(/[,\s%]/g, "");
    const points = Number(cleaned);
    if (cleaned === "" || !Number.isFinite(points) || points < 0) {
      errors.push(`Row ${line}: "${pRaw}" is not a valid number of points for "${a}".`);
      continue;
    }

    const key = q.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { text: q, answers: [] });
      order.push(key);
    }
    groups.get(key)!.answers.push({ text: a, points: Math.round(points) });
  }

  const questions: Question[] = order.map((key, idx) => {
    const g = groups.get(key)!;
    const sorted = [...g.answers].sort((x, y) => y.points - x.points);
    if (sorted.length > MAX_ANSWERS) {
      warnings.push(
        `"${g.text}" has ${sorted.length} answers; only the top ${MAX_ANSWERS} were kept.`,
      );
    }
    return { id: `q${idx + 1}-${Date.now().toString(36)}`, text: g.text, answers: sorted.slice(0, MAX_ANSWERS) };
  });

  if (questions.length === 0 && errors.length === 0) {
    errors.push("No questions were found in the file.");
  }

  return { questions, warnings, errors };
}

export function questionsToCsv(questions: Question[]): string {
  const rows: (string | number)[][] = [["question", "answer", "points"]];
  for (const q of questions) for (const a of q.answers) rows.push([q.text, a.text, a.points]);
  return Papa.unparse(rows);
}
