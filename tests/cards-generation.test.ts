import assert from "node:assert/strict";
import { parseCardsCSV, cardsToCSV, questionKey } from "../lib/cards-csv.ts";
import { planGeneration, generationProgress } from "../lib/card-generation.ts";
import { sampleState } from "../lib/study.ts";
const csv =
  'question,reponse,theme\r\n"Pourquoi, ici ?","Une réponse\navec deux lignes et ""guillemets"".",Notion\r\n"Pourquoi ici!",Doublon,N';
const parsed = parseCardsCSV(csv);
assert.equal(parsed.cards.length, 1);
assert.equal(parsed.duplicates, 1);
assert.match(parsed.cards[0].answer, /\n/);
assert.match(parsed.cards[0].answer, /"guillemets"/);
const roundtrip = parseCardsCSV(cardsToCSV(parsed.cards));
assert.equal(roundtrip.cards[0].answer, parsed.cards[0].answer);
assert.equal(parseCardsCSV("Recto;Verso\nQ;R").cards[0].answer, "R");
assert.equal(parseCardsCSV("Q\tR\nQ2\tR2").cards.length, 2);
assert.equal(parseCardsCSV("question,reponse\nQ,").issues.length, 1);
assert.throws(() => parseCardsCSV('"unclosed,a'));
assert.equal(questionKey("Qu’est-ce ?"), questionKey("Qu'est ce!"));
assert.match(
  cardsToCSV([{ ...parsed.cards[0], question: "=DANGEROUS()" }]),
  /'=DANGEROUS/,
);
const s = sampleState();
s.documents = [
  {
    id: "one",
    courseId: "psy1",
    name: "One",
    warnings: [],
    pages: Array.from({ length: 60 }, (_, i) => ({
      page: i + 1,
      text:
        "Concept spécifique " +
        i +
        " : une explication documentée qui mérite une question.",
    })),
  },
  {
    id: "private",
    courseId: "psy2",
    name: "Private",
    warnings: [],
    pages: [{ page: 1, text: "PRIVATE CONTENT" }],
  },
];
const plan = planGeneration(s, "psy1", "", [], 24);
assert.equal(plan.groups.length, 4);
assert.equal(plan.totalExcerpts, 60);
assert.ok(plan.groups.flat().every((p) => p.documentId === "one"));
assert.ok(plan.groups[3][0].page > 40);
assert.ok(plan.groups.every((g) => g.length <= 6));
const checkpoint = {
  id: "d",
  courseId: "psy1",
  name: "D",
  cards: [],
  generation: {
    id: "job",
    target: 24,
    added: 6,
    next: 1,
    ...plan,
    prompt: "",
    documentIds: [],
    examSignature: "null",
  },
};
assert.equal(generationProgress(checkpoint).next, 1);
assert.equal(generationProgress(checkpoint).done, false);
checkpoint.generation.next = 4;
assert.equal(generationProgress(checkpoint).done, true);
assert.throws(() => planGeneration(s, "psy1", "", [], 121));
assert.throws(() => planGeneration(s, "psy1", "", [], 0));
assert.equal(planGeneration(s, "psy2", "", ["one"], 24).groups.length, 0);
console.log(
  "PASS: CSV quoting/multiline/delimiters/duplicates/invalid rows/export safety; distributed generation, course isolation, bounded batches and saved checkpoints.",
);
