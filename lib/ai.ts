import { questionKey } from "./cards-csv.ts";
import type { State } from "./study";
// PDF line wraps and repeated spaces are layout, not changes to a quotation.
export function quoteMatches(text: string, quote: string) {
  const normalize = (s: string) =>
    s.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const needle = normalize(quote);
  return needle.length > 0 && normalize(text).includes(needle);
}
export const RESERVE_SQL = `INSERT INTO usage (id,user_id,month,created,reserved,actual,status,model,input,output)
 SELECT ?,?,?,?,?,NULL,'pending',?,0,0 FROM settings WHERE id='ai'
 AND data=?
 AND COALESCE((SELECT sum(COALESCE(actual,reserved)) FROM usage WHERE month=?),0)+?<=?
 AND (SELECT count(*) FROM usage WHERE month=? AND user_id=?)<?
 AND (SELECT count(*) FROM usage WHERE status='pending')<2
 AND (SELECT count(*) FROM usage WHERE status='pending' AND user_id=?)=0`;
export function retrieve(
  s: State,
  courseId: string,
  prompt: string,
  documentIds: string[] = [],
  limit = 6,
) {
  const tokens =
    prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z]{4,}/g) || [];
  const chunks = s.documents
    .filter(
      (d) =>
        d.courseId === courseId &&
        (!documentIds.length || documentIds.includes(d.id)),
    )
    .flatMap((d) =>
      d.pages.flatMap((p) => {
        const result = [];
        for (let at = 0; at < p.text.length; at += 2400)
          result.push({
            documentId: d.id,
            offset: at,
            name: d.name,
            page: p.page,
            text: p.text.slice(at, at + 2600),
          });
        return result;
      }),
    );
  return chunks
    .map((p) => ({
      ...p,
      score: tokens.reduce(
        (a, t) =>
          a +
          (p.text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(t)
            ? 1
            : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
export function validateCards(
  raw: any,
  excerpts: ReturnType<typeof retrieve>,
  existing: string[],
) {
  if (!raw || !Array.isArray(raw.cards))
    throw new Error("Le fournisseur n’a pas renvoyé de fiches exploitables.");
  const seen = new Set(existing.map(questionKey));
  const cards = [];
  for (const c of raw.cards.slice(0, 10)) {
    if (
      typeof c.question !== "string" ||
      typeof c.answer !== "string" ||
      typeof c.topic !== "string" ||
      typeof c.quote !== "string" ||
      !c.quote.trim() ||
      c.question.length > 1500 ||
      c.answer.length > 4000
    )
      continue;
    const cited = Number.isInteger(c.sourceIndex)
      ? excerpts[c.sourceIndex]
      : undefined;
    const match =
      excerpts.find(
        (p) =>
          (cited
            ? p === cited
            : p.documentId === c.documentId && p.page === c.page) &&
          quoteMatches(p.text, c.quote),
      ) || (cited ? uniqueQuoteSource(excerpts, c.quote) : undefined);
    const key = questionKey(c.question);
    if (!match || seen.has(key)) continue;
    seen.add(key);
    cards.push({
      id: crypto.randomUUID(),
      question: c.question,
      answer: c.answer,
      topic: c.topic.slice(0, 100),
      source: {
        documentId: match.documentId,
        name: match.name,
        page: match.page,
      },
    });
  }
  return cards;
}
export function responseSchema(
  excerpts: ReturnType<typeof retrieve>,
  cards: boolean,
) {
  const quotes = [
    ...new Set(
      excerpts.flatMap((p) =>
        p.text
          .split(/\n|(?<=[.!?;])\s+/)
          .map((line) => line.normalize("NFC").replace(/\s+/g, " ").trim())
          .filter((line) => line.length >= 25)
          .map((line) => line.slice(0, 220))
          .slice(0, 24),
      ),
    ),
  ];
  const evidence = {
    sourceIndex: {
      type: "integer",
      enum: excerpts.length ? excerpts.map((_, i) => i) : [-1],
    },
    quote: {
      type: "string",
      ...(quotes.length ? { enum: quotes } : {}),
      description:
        "Choisis une citation autorisée qui soutient directement la réponse.",
    },
  };
  const reference = {
    type: "object",
    properties: evidence,
    required: Object.keys(evidence),
    additionalProperties: false,
  };
  const card = {
    type: "object",
    properties: {
      question: { type: "string" },
      answer: { type: "string" },
      topic: { type: "string" },
      ...evidence,
    },
    required: ["question", "answer", "topic", "sourceIndex", "quote"],
    additionalProperties: false,
  };
  const properties = cards
    ? { cards: { type: "array", items: card } }
    : {
        answer: { type: "string" },
        needsExternal: { type: "boolean" },
        references: { type: "array", items: reference },
      };
  return {
    type: "json_schema",
    name: cards ? "flashcards" : "tutor",
    strict: true,
    schema: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}
// A copied quote determines its page even if the model misnumbers the excerpt.
// Repeated passages on different pages remain ambiguous and are rejected.
export function uniqueQuoteSource(
  excerpts: ReturnType<typeof retrieve>,
  quote: string,
) {
  const matches = excerpts.filter((p) => quoteMatches(p.text, quote));
  return matches.length &&
    matches.every(
      (p) =>
        p.documentId === matches[0].documentId && p.page === matches[0].page,
    )
    ? matches[0]
    : undefined;
}
export function estimateReservation(
  input: string,
  inputRate: number,
  outputRate: number,
  webRate = 0,
  web = false,
) {
  const inputTokens = web
    ? 2_000_000
    : new TextEncoder().encode(input).length + 1000;
  return Math.ceil(
    inputTokens * inputRate + 1800 * outputRate + (web ? webRate * 1e6 : 0),
  );
}
