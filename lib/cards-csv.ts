import type { Card } from "./study";
export const questionKey = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("fr-CA")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function parseCardsCSV(input: string) {
  if (input.length > 2_000_000)
    throw Error("Le CSV dépasse 2 Mo. Divise-le en plusieurs fichiers.");
  input = input
    .replace(/^\uFEFF/, "")
    .replace(/^```[^\n]*\n/, "")
    .replace(/\n```\s*$/, "");
  const first = input.split(/\r?\n/)[0] || "";
  let quoted = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (let i = 0; i < first.length; i++) {
    if (first[i] === '"') quoted = !quoted;
    else if (!quoted && first[i] in counts) counts[first[i]]++;
  }
  const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const rows: string[][] = [];
  let row: string[] = [],
    field = "";
  quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field) quoted = !quoted;
      else field += c;
    } else if (c === sep && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted)
    throw Error(
      "Une cellule entre guillemets n’est pas fermée. Vérifie le CSV.",
    );
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  if (!rows.length)
    throw Error("Colle un CSV avec les colonnes question et réponse.");
  const header = rows[0].map((x) =>
    questionKey(x)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
  const qi = header.findIndex((x) =>
      ["question", "front", "recto"].includes(x),
    ),
    ai = header.findIndex((x) =>
      ["reponse", "answer", "back", "verso"].includes(x),
    );
  const hasHeader = qi >= 0 && ai >= 0;
  const ti = hasHeader
    ? header.findIndex((x) => ["theme", "topic", "notion"].includes(x))
    : -1;
  const si = hasHeader ? header.indexOf("source") : -1,
    pi = hasHeader ? header.indexOf("page") : -1;
  const cards: Card[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const [index, r] of rows.slice(hasHeader ? 1 : 0).entries()) {
    const question = (r[hasHeader ? qi : 0] || "").trim(),
      answer = (r[hasHeader ? ai : 1] || "").trim();
    if (
      !question ||
      !answer ||
      question.length > 1500 ||
      answer.length > 4000
    ) {
      issues.push(
        `Ligne ${index + (hasHeader ? 2 : 1)} : question/réponse vide ou trop longue.`,
      );
      continue;
    }
    const key = questionKey(question);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const name = si >= 0 ? r[si]?.trim() : "";
    const page = pi >= 0 ? Number(r[pi]) : 0;
    cards.push({
      id: crypto.randomUUID(),
      question,
      answer,
      topic: (ti >= 0 ? r[ti] || "" : "").slice(0, 100),
      ...(name && Number.isInteger(page) && page > 0 && page <= 500
        ? {
            source: {
              documentId: "csv-unverified",
              name: ("Source importée (non vérifiée) — " + name).slice(0, 255),
              page,
            },
          }
        : {}),
    });
  }
  if (cards.length > 500)
    throw Error("Limite de 500 fiches par import. Divise le fichier.");
  return { cards, issues, duplicates };
}
export function cardsToCSV(cards: Card[]) {
  const cell = (s: string) =>
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
  return (
    "\uFEFF" +
    [
      ["question", "reponse", "theme", "source", "page"],
      ...cards.map((c) => [
        c.question,
        c.answer,
        c.topic,
        c.source?.name || "",
        c.source ? String(c.source.page) : "",
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
