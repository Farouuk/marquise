import type { Generation } from "./card-generation";
export type Course = { id: string; name: string; code: string; color: string };
export type Exam = {
  id: string;
  courseId: string;
  title: string;
  date: string;
  format: string;
  scope: string;
  instructions: string;
  hours: number;
};
export type Source = { documentId: string; name: string; page: number };
export type Card = {
  id: string;
  question: string;
  answer: string;
  source?: Source;
  topic: string;
};
export type Deck = {
  id: string;
  courseId: string;
  name: string;
  cards: Card[];
  sharedBy?: string;
  generation?: Generation;
};
export type DocumentInfo = {
  id: string;
  courseId: string;
  name: string;
  pages: { page: number; text: string; diagrams?: string[] }[];
  warnings: string[];
};
export type Review = {
  cardId: string;
  at: string;
  rating: number;
  interval: number;
  due: string;
};
export type Session = {
  id: string;
  examId: string;
  courseId: string;
  date: string;
  minutes: number;
  kind: "Comprendre" | "Pratiquer" | "Réviser";
  done: boolean;
};
export type State = {
  courses: Course[];
  exams: Exam[];
  decks: Deck[];
  documents: DocumentInfo[];
  reviews: Review[];
  sessions: Session[];
  availability: number[];
  overrides: Record<string, number>;
  name: string;
  chats: {
    courseId: string;
    question: string;
    answer: string;
    contextHash?: string;
  }[];
};
export function dateKey(d = new Date()) {
  // Sherbrooke's calendar day must agree between the server and the browser.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export function plusDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const uid = () => crypto.randomUUID();
export function emptyState(name = "") {
  return {
    courses: [],
    exams: [],
    decks: [],
    documents: [],
    reviews: [],
    sessions: [],
    availability: [0, 2, 2, 2, 2, 1, 3],
    overrides: {},
    name,
    chats: [],
  } as State;
}
export function sampleState() {
  const t = dateKey();
  const s = emptyState("Camille");
  s.courses = [
    {
      id: "psy1",
      name: "Psychologie cognitive",
      code: "PSY 303",
      color: "sage",
    },
    { id: "psy2", name: "Psychopathologie", code: "PSY 402", color: "rose" },
    {
      id: "psy3",
      name: "Méthodes de recherche",
      code: "PSY 306",
      color: "sand",
    },
  ];
  s.exams = [
    {
      id: "e1",
      courseId: "psy1",
      title: "Examen de mi-session",
      date: plusDays(t, 12),
      format: "Choix multiples et réponses courtes",
      scope: "Mémoire, attention et fonctions exécutives",
      instructions:
        "Distinguer les systèmes de mémoire. Appliquer les concepts à une situation.",
      hours: 8,
    },
    {
      id: "e2",
      courseId: "psy2",
      title: "Analyse de cas",
      date: plusDays(t, 17),
      format: "Analyse de cas",
      scope: "Chapitres 1 à 4",
      instructions: "Justifier les hypothèses avec les concepts du cours.",
      hours: 10,
    },
    {
      id: "e3",
      courseId: "psy3",
      title: "Examen de mi-session",
      date: plusDays(t, 22),
      format: "Réponses courtes",
      scope: "Plans de recherche et validité",
      instructions: "",
      hours: 6,
    },
  ];
  s.documents = [
    {
      id: "sample-doc",
      courseId: "psy1",
      name: "Exemple — Les systèmes de mémoire.pdf",
      warnings: [
        "Document pédagogique fictif : il ne provient pas d’un cours de l’Université.",
      ],
      pages: [
        {
          page: 1,
          text: "La mémoire de travail permet de maintenir et de manipuler temporairement des informations. La mémoire à long terme permet de conserver des informations sur une durée prolongée.",
        },
        {
          page: 2,
          text: "La mémoire épisodique concerne les événements personnellement vécus dans leur contexte. La mémoire sémantique concerne les connaissances générales.",
        },
      ],
    },
  ];
  s.decks = [
    {
      id: "d1",
      courseId: "psy1",
      name: "Les systèmes de mémoire",
      cards: [
        {
          id: "c1",
          question:
            "Qu’est-ce qui distingue la mémoire de travail de la mémoire à long terme ?",
          answer:
            "La mémoire de travail maintient et manipule temporairement l’information; la mémoire à long terme conserve l’information sur une durée prolongée.",
          topic: "Mémoire",
          source: {
            documentId: "sample-doc",
            name: s.documents[0].name,
            page: 1,
          },
        },
        {
          id: "c2",
          question:
            "Un souvenir de ton premier jour à l’université fait appel à quel système de mémoire ?",
          answer:
            "À la mémoire épisodique : il s’agit d’un événement personnel situé dans un contexte.",
          topic: "Application",
          source: {
            documentId: "sample-doc",
            name: s.documents[0].name,
            page: 2,
          },
        },
        {
          id: "c3",
          question:
            "Quel type de mémoire concerne les connaissances générales ?",
          answer: "La mémoire sémantique.",
          topic: "Mémoire",
          source: {
            documentId: "sample-doc",
            name: s.documents[0].name,
            page: 2,
          },
        },
      ],
    },
    { id: "d2", courseId: "psy2", name: "Concepts et distinctions", cards: [] },
    { id: "d3", courseId: "psy3", name: "La validité en recherche", cards: [] },
  ];
  s.sessions = plan(s, t).sessions;
  return s;
}
export function latestReview(s: State, id: string) {
  return s.reviews.filter((r) => r.cardId === id).at(-1);
}
export function dueCards(s: State, deck: Deck, t = dateKey()) {
  return deck.cards.filter(
    (c) => !latestReview(s, c.id) || latestReview(s, c.id)!.due <= t,
  );
}
export function reviewCard(
  s: State,
  cardId: string,
  rating: number,
  t = dateKey(),
): Review {
  const prev = latestReview(s, cardId)?.interval || 0;
  const interval =
    rating === 0
      ? 0
      : rating === 1
        ? Math.max(1, Math.round(prev * 1.2))
        : rating === 2
          ? Math.max(2, Math.round(prev * 2))
          : Math.max(4, Math.round(prev * 2.7));
  return {
    cardId,
    at: new Date().toISOString(),
    rating,
    interval,
    due: plusDays(t, interval),
  };
}
// Calendar-day capacity is shared by all courses. Completed work is immutable.
export function plan(s: State, t = dateKey()) {
  const completed = s.sessions.filter((x) => x.done);
  const sessions = [...completed];
  const shortages: { examId: string; minutes: number }[] = [];
  const used: Record<string, number> = {};
  for (const x of completed) used[x.date] = (used[x.date] || 0) + x.minutes;
  const exams = [...s.exams]
    .filter((e) => e.date >= t)
    .sort((a, b) => a.date.localeCompare(b.date));
  const jobs = exams.map((e) => {
    const done = completed
      .filter((x) => x.examId === e.id)
      .reduce((a, x) => a + x.minutes, 0);
    const total = Math.max(0, Math.round(e.hours * 60) - done);
    const cards = s.decks
      .filter((d) => d.courseId === e.courseId)
      .flatMap((d) => d.cards);
    const weak = cards.filter(
      (c) => (latestReview(s, c.id)?.rating ?? 2) < 2,
    ).length;
    return { e, left: total, total, weak, allocated: 0, lastReview: "" };
  });
  for (let day = t, i = 0; i < 366; i++, day = plusDays(day, 1)) {
    const weekday = new Date(day + "T12:00:00").getDay();
    let free = Math.max(
      0,
      Math.round((s.overrides[day] ?? s.availability[weekday] ?? 0) * 60) -
        (used[day] || 0),
    );
    while (free > 0) {
      const available = jobs.filter(
        (j) =>
          j.left > 0 &&
          j.e.date > day &&
          (j.allocated / j.total < 0.8 ||
            j.lastReview !== day ||
            j.e.date <= plusDays(day, 1)),
      );
      if (!available.length) break;
      available.sort((a, b) => {
        const daysA = Math.max(
            1,
            (Date.parse(a.e.date) - Date.parse(day)) / 864e5,
          ),
          daysB = Math.max(1, (Date.parse(b.e.date) - Date.parse(day)) / 864e5);
        return (
          (b.left / daysB) * (1 + b.weak * 0.05) -
          (a.left / daysA) * (1 + a.weak * 0.05)
        );
      });
      const j = available[0];
      const minutes = Math.min(30, free, j.left);
      const progress = j.total ? j.allocated / j.total : 0;
      const kind =
        progress < 0.45
          ? "Comprendre"
          : progress < 0.8
            ? "Pratiquer"
            : "Réviser";
      sessions.push({
        id: `${j.e.id}-${day}-${sessions.length}`,
        examId: j.e.id,
        courseId: j.e.courseId,
        date: day,
        minutes,
        kind,
        done: false,
      });
      j.left -= minutes;
      j.allocated += minutes;
      if (kind === "Réviser") j.lastReview = day;
      free -= minutes;
    }
    if (jobs.every((j) => j.left === 0 || j.e.date <= day)) break;
  }
  for (const j of jobs)
    if (j.left > 0) shortages.push({ examId: j.e.id, minutes: j.left });
  return {
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
    shortages,
  };
}
