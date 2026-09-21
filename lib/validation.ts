import { z } from "zod";
const id = z.string().min(1).max(100),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const d = new Date(s + "T12:00:00Z");
      return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
    }, "Date invalide");
const source = z.object({
  documentId: id,
  name: z.string().max(255),
  page: z.number().int().min(1).max(500),
});
const card = z.object({
  id,
  question: z.string().min(1).max(1500),
  answer: z.string().min(1).max(4000),
  topic: z.string().max(100),
  source: source.optional(),
});
export const stateSchema = z.object({
  name: z.string().max(80),
  courses: z
    .array(
      z.object({
        id,
        name: z.string().min(1).max(100),
        code: z.string().max(30),
        color: z.enum(["sage", "rose", "sand", "blue"]),
      }),
    )
    .max(30),
  exams: z
    .array(
      z.object({
        id,
        courseId: id,
        title: z.string().min(1).max(120),
        date,
        format: z.string().max(100),
        scope: z.string().max(3000),
        instructions: z.string().max(3000),
        hours: z.number().min(0.5).max(200),
      }),
    )
    .max(100),
  decks: z
    .array(
      z.object({
        id,
        courseId: id,
        name: z.string().max(120),
        cards: z.array(card).max(500),
        sharedBy: z.string().max(500).optional(),
      }),
    )
    .max(100),
  documents: z
    .array(
      z.object({
        id,
        courseId: id,
        name: z.string().max(255),
        pages: z
          .array(
            z.object({
              page: z.number().int().min(1).max(500),
              text: z.string().max(20000),
              diagrams: z.array(z.string().max(500)).optional(),
            }),
          )
          .max(150),
        warnings: z.array(z.string().max(500)).max(160),
      }),
    )
    .max(100),
  reviews: z
    .array(
      z.object({
        cardId: id,
        at: z.string().datetime(),
        rating: z.number().int().min(0).max(3),
        interval: z.number().int().min(0).max(100000),
        due: date,
      }),
    )
    .max(30000),
  sessions: z
    .array(
      z.object({
        id,
        examId: id,
        courseId: id,
        date,
        minutes: z.number().int().positive().max(720),
        kind: z.enum(["Comprendre", "Pratiquer", "Réviser"]),
        done: z.boolean(),
      }),
    )
    .max(10000),
  availability: z.array(z.number().min(0).max(12)).length(7),
  overrides: z.record(date, z.number().min(0).max(12)),
  chats: z
    .array(
      z.object({
        courseId: id,
        question: z.string().max(2000),
        answer: z.string().max(20000),
        contextHash: z.string().max(64).optional(),
      }),
    )
    .max(200),
});
