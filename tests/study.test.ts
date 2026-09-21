import assert from "node:assert/strict";
import {
  sampleState,
  plan,
  dateKey,
  plusDays,
  reviewCard,
  dueCards,
} from "../lib/study.ts";
import {
  retrieve,
  validateCards,
  estimateReservation,
  RESERVE_SQL,
  quoteMatches,
} from "../lib/ai.ts";
import fs from "node:fs";
const s = sampleState(),
  today = dateKey();
assert.equal(dateKey(new Date("2026-09-17T02:00:00Z")), "2026-09-16");
assert.equal(dateKey(new Date("2026-01-01T04:30:00Z")), "2025-12-31");
assert.equal(plusDays("2026-03-07", 2), "2026-03-09");
assert.equal(plusDays("2026-10-31", 2), "2026-11-02");
assert.ok(
  quoteMatches(
    "Le savoir   provient\n de la raison.",
    "Le savoir provient de la raison.",
  ),
);
assert.ok(
  !quoteMatches(
    "Le savoir provient de la raison.",
    "Le savoir provient des émotions.",
  ),
);
assert.ok(!quoteMatches("Le savoir", "   "));
for (const day of new Set(s.sessions.map((x) => x.date))) {
  const min = s.sessions
    .filter((x) => x.date === day)
    .reduce((a, x) => a + x.minutes, 0);
  assert.ok(
    min <=
      (s.overrides[day] ??
        s.availability[new Date(day + "T12:00:00").getDay()]) *
        60,
  );
}
const full = structuredClone(s);
full.availability = [0, 0, 0, 0, 0, 0, 0];
assert.ok(plan(full).shortages.length === 3);
assert.equal(plan(full).sessions.length, 0);
full.sessions = [{ ...s.sessions[0], done: true }];
const completed = full.sessions[0];
full.exams[0].instructions = "Nouvelles exclusions";
assert.deepEqual(plan(full).sessions[0], completed);
const override = structuredClone(s);
override.overrides[today] = 0;
assert.equal(plan(override).sessions.filter((x) => x.date === today).length, 0);
const late = structuredClone(s);
late.exams[0].date = today;
assert.ok(plan(late).shortages.some((x) => x.examId === late.exams[0].id));
const card = s.decks[0].cards[0];
s.reviews.push(reviewCard(s, card.id, 2, today));
assert.ok(!dueCards(s, s.decks[0], today).some((c) => c.id === card.id));
assert.ok(
  dueCards(s, s.decks[0], plusDays(today, 2)).some((c) => c.id === card.id),
);
const isolated = sampleState();
assert.equal(isolated.reviews.length, 0);
const excerpts = retrieve(s, "psy1", "mémoire de travail");
assert.equal(excerpts[0].page, 1);
assert.ok(excerpts.every((x) => x.documentId === "sample-doc"));
const raw = {
  cards: [
    {
      question: "Q",
      answer: "A",
      topic: "T",
      documentId: "sample-doc",
      page: 1,
      quote: "La mémoire de travail",
    },
    {
      question: "inventée",
      answer: "A",
      topic: "T",
      documentId: "no",
      page: 999,
      quote: "fiction",
    },
    {
      question: "Q",
      answer: "A",
      topic: "T",
      documentId: "sample-doc",
      page: 1,
      quote: "La mémoire de travail",
    },
  ],
};
assert.equal(validateCards(raw, excerpts, []).length, 1);
const indexed = {
  cards: [
    { ...raw.cards[0], documentId: undefined, page: undefined, sourceIndex: 0 },
  ],
};
assert.equal(validateCards(indexed, excerpts, []).length, 1);
indexed.cards[0].sourceIndex = 99;
assert.equal(validateCards(indexed, excerpts, []).length, 0);
assert.equal(validateCards(raw, excerpts, ["Q"]).length, 0);
assert.ok(estimateReservation("été", 1, 4) > 7200);
fs.mkdirSync("work", { recursive: true });
fs.writeFileSync("work/reserve.sql", RESERVE_SQL);
console.log(
  "PASS: schedule capacity, no capacity, date overrides, exam deadlines, completed preservation, review timing/isolation, retrieval/source references, duplicate rejection, budget estimate.",
);
