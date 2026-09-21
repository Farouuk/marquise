import {
  identity,
  getState,
  putState,
  db,
  fail,
  originCheck,
  AppError,
} from "@/lib/server";
export async function GET() {
  try {
    const u = await identity();
    if (u.demo) return Response.json({ shares: [] });
    const rows = await db()
      .prepare("SELECT id,data FROM shares WHERE recipient=?")
      .bind(u.email)
      .all<{ id: string; data: string }>();
    return Response.json(
      {
        shares: rows.results.map((r) => ({
          id: r.id,
          deck: JSON.parse(r.data),
        })),
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
    const u = await identity();
    if (u.demo)
      throw new AppError("Le partage nécessite un compte invité.", 403);
    const body = (await req.json()) as any;
    const { state, revision } = await getState(u);
    if (body.action === "share") {
      const deck = state.decks.find((d) => d.id === body.deckId);
      if (!deck || deck.sharedBy)
        throw new AppError("Jeu non partageable.", 403);
      const email = String(body.email).trim().toLowerCase();
      const m = await db()
        .prepare("SELECT active FROM members WHERE email=?")
        .bind(email)
        .first<{ active: number }>();
      if (!m?.active)
        throw new AppError("Ce courriel n’est pas celui d’un membre invité.");
      const id = u.id + ":" + deck.id + ":" + email;
      const safe = {
        name: deck.name,
        cards: deck.cards.map((c) => ({
          question: c.question,
          answer: c.answer,
          topic: c.topic,
          source: c.source
            ? { name: c.source.name, page: c.source.page }
            : undefined,
        })),
      };
      await db()
        .prepare(
          "INSERT INTO shares (id,owner_id,recipient,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
        .bind(id, u.id, email, JSON.stringify(safe))
        .run();
      return Response.json({ ok: true });
    }
    if (body.action === "import") {
      const row = await db()
        .prepare("SELECT data FROM shares WHERE id=? AND recipient=?")
        .bind(body.id, u.email)
        .first<{ data: string }>();
      if (!row) throw new AppError("Partage introuvable.", 404);
      if (state.decks.some((d) => d.sharedBy === body.id))
        throw new AppError("Ce jeu est déjà dans tes fiches.");
      const d = JSON.parse(row.data);
      const deck = {
        id: crypto.randomUUID(),
        courseId: "shared",
        name: d.name,
        sharedBy: body.id,
        cards: d.cards.map((c: any) => ({
          ...c,
          id: crypto.randomUUID(),
          source: c.source ? { ...c.source, documentId: "private" } : undefined,
        })),
      };
      await putState(
        u.id,
        { ...state, decks: [...state.decks, deck] },
        revision,
      );
      return Response.json({ ok: true });
    }
    throw new AppError("Action inconnue.");
  } catch (e) {
    return fail(e);
  }
}
