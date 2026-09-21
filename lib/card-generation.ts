import type { State, Deck } from "./study";
import { retrieve } from "./ai.ts";
export type Passage = { documentId: string; page: number; offset: number };
export type Generation = {
  id: string;
  target: number;
  added: number;
  next: number;
  groups: Passage[][];
  totalExcerpts: number;
  prompt: string;
  examId?: string;
  examSignature: string;
  documentIds: string[];
};
export function planGeneration(
  s: State,
  courseId: string,
  prompt: string,
  documentIds: string[],
  target: number,
) {
  if (!Number.isInteger(target) || target < 1 || target > 120)
    throw Error("Choisis un objectif entre 1 et 120 fiches.");
  const all = retrieve(
    s,
    courseId,
    prompt,
    documentIds,
    Number.MAX_SAFE_INTEGER,
  );
  const covered = new Set(
    s.decks
      .filter((d) => d.courseId === courseId)
      .flatMap((d) =>
        d.cards
          .filter((c) => c.source)
          .map((c) => c.source!.documentId + ":" + c.source!.page),
      ),
  );
  // Prefer pages without cards; retain relevance ordering within each group.
  all.sort(
    (a, b) =>
      Number(covered.has(a.documentId + ":" + a.page)) -
      Number(covered.has(b.documentId + ":" + b.page)),
  );
  const batches = Math.ceil(target / 6);
  const groups: Passage[][] = [];
  for (let i = 0; i < batches && all.length; i++) {
    const start = Math.floor((i * all.length) / batches);
    const end = Math.min(
      all.length,
      start + 6,
      Math.max(start + 1, Math.floor(((i + 1) * all.length) / batches)),
    );
    groups.push(
      all
        .slice(start, end)
        .map(({ documentId, page, offset }) => ({ documentId, page, offset })),
    );
  }
  return { groups, totalExcerpts: all.length };
}
export function generationProgress(deck: Deck) {
  const g = deck.generation!;
  return {
    deckId: deck.id,
    jobId: g.id,
    added: g.added,
    target: g.target,
    next: g.next,
    total: g.groups.length,
    done: g.next >= g.groups.length || g.added >= g.target,
  };
}
