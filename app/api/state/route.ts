import {
  identity,
  getState,
  putState,
  fail,
  originCheck,
  config,
  pauseReason,
  AppError,
} from "@/lib/server";
import { stateSchema } from "@/lib/validation";
import { plan } from "@/lib/study";
export async function GET() {
  try {
    const user = await identity();
    const value = await getState(user);
    return Response.json(
      {
        ...value,
        demo: user.demo,
        owner: user.owner,
        aiReason: pauseReason(await config(), user.demo),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    originCheck(req);
    const user = await identity();
    const text = await req.text();
    if (text.length > 4e6)
      throw new AppError("Ton espace dépasse la limite de sauvegarde.");
    const body = JSON.parse(text);
    const parsed = stateSchema.safeParse(body.state);
    if (!parsed.success)
      throw new AppError(
        "Certaines données sont invalides : " +
          parsed.error.issues[0].path.join("."),
      );
    if (!Number.isInteger(body.revision))
      throw new AppError("Version manquante.");
    const current = await getState(user);
    const next = parsed.data;
    // Documents and tutor transcripts are changed only by their dedicated routes.
    next.documents = current.state.documents;
    next.chats = current.state.chats;
    // Generation checkpoints are server-owned; clients cannot rewind a paid job.
    next.decks = next.decks.map((d) => ({
      ...d,
      generation: current.state.decks.find((old) => old.id === d.id)
        ?.generation,
    }));
    for (const completed of current.state.sessions.filter((x) => x.done)) {
      const other = next.sessions.find((x) => x.id === completed.id);
      if (
        !other ||
        Object.keys(completed).some(
          (key) =>
            other[key as keyof typeof other] !==
            completed[key as keyof typeof completed],
        )
      )
        throw new AppError("Le travail terminé est conservé.");
    }
    if (
      JSON.stringify(current.state.exams) !== JSON.stringify(next.exams) ||
      JSON.stringify(current.state.availability) !== JSON.stringify(next.availability) ||
      JSON.stringify(current.state.overrides) !== JSON.stringify(next.overrides)
    ) next.sessions = plan(next).sessions;
    const caps: Record<string, number> = {};
    for (const x of next.sessions) {
      caps[x.date] = (caps[x.date] || 0) + x.minutes;
    }
    for (const x of next.sessions) {
      if (
        !x.done &&
        caps[x.date] >
          (next.overrides[x.date] ??
            next.availability[new Date(x.date + "T12:00:00").getDay()]) *
            60 +
            0.001
      )
        throw new AppError(
          "Le planning dépasse les disponibilités. Redistribue le travail.",
        );
    }
    return Response.json(await putState(user.id, next, body.revision));
  } catch (e) {
    return fail(e);
  }
}
