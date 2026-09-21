import {
  identity,
  getState,
  putState,
  db,
  runtime,
  fail,
  originCheck,
  AppError,
} from "@/lib/server";
import { stateSchema } from "@/lib/validation";
export async function GET(req: Request) {
  try {
    const user = await identity();
    const params = new URL(req.url).searchParams;
    const hash = params.get("hash");
    if (hash) {
      if (!/^[a-f0-9]{64}$/.test(hash))
        throw new AppError("Empreinte invalide.");
      const matches = await db()
        .prepare("SELECT id,data FROM files WHERE user_id=? AND hash=?")
        .bind(user.id, hash)
        .all<{ id: string; data: string }>();
      const { state } = await getState(user);
      const duplicate = matches.results.some((row) =>
        state.documents.some(
          (doc) => doc.id === row.id && doc.courseId === params.get("courseId"),
        ),
      );
      const doc = matches.results[0]
        ? JSON.parse(matches.results[0].data)
        : null;
      return Response.json(
        {
          duplicate,
          extraction: doc ? { pages: doc.pages, warnings: doc.warnings } : null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const id = params.get("id");
    const record = await db()
      .prepare("SELECT data FROM files WHERE id=? AND user_id=?")
      .bind(id, user.id)
      .first<{ data: string }>();
    if (!record) throw new AppError("Document introuvable.", 404);
    const obj = await runtime.BUCKET.get(user.id + "/" + id);
    if (!obj) throw new AppError("Le fichier original est indisponible.", 404);
    const d = JSON.parse(record.data);
    return new Response(obj.body, {
      headers: {
        "Content-Type": d.type,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    originCheck(req);
    const user = await identity();
    if (Number(req.headers.get("content-length")) > 17e6)
      throw new AppError("Fichier trop volumineux.");
    const data = await req.formData();
    const file = data.get("file") as File;
    const courseId = String(data.get("courseId"));
    const { state, revision } = await getState(user);
    if (!state.courses.some((c) => c.id === courseId))
      throw new AppError("Cours introuvable.", 404);
    if (
      !file ||
      file.size > 15 * 1024 * 1024 ||
      !["pdf", "pptx"].includes(file.name.split(".").pop()?.toLowerCase() || "")
    )
      throw new AppError("Utilise un PDF ou un PPTX de 15 Mo ou moins.");
    const bytes = await file.arrayBuffer();
    const magic = new Uint8Array(bytes).slice(0, 5);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    if (
      isPdf
        ? String.fromCharCode(...magic) !== "%PDF-"
        : magic[0] !== 80 || magic[1] !== 75
    )
      throw new AppError("Le contenu ne correspond pas au format annoncé.");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const matches = await db()
      .prepare("SELECT id,data FROM files WHERE user_id=? AND hash=?")
      .bind(user.id, hash)
      .all<{ id: string; data: string }>();
    const duplicate = matches.results.find((row) =>
      state.documents.some(
        (doc) => doc.id === row.id && doc.courseId === courseId,
      ),
    );
    if (duplicate) return Response.json({ id: duplicate.id, duplicate: true });
    if (state.documents.length >= 40)
      throw new AppError("Limite de 40 documents atteinte dans ton espace.");
    const existing = matches.results[0];
    const raw = existing
      ? JSON.parse(existing.data)
      : JSON.parse(String(data.get("extraction")));
    const id = crypto.randomUUID();
    const doc = stateSchema.shape.documents.element.parse({
      id,
      courseId,
      name: file.name,
      pages: raw.pages,
      warnings: raw.warnings,
    });
    if (doc.pages.reduce((a, p) => a + p.text.length, 0) > 600000)
      throw new AppError("Document trop long.");
    await runtime.BUCKET.put(user.id + "/" + id, bytes, {
      httpMetadata: {
        contentType: isPdf
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
    });
    try {
      await db()
        .prepare("INSERT INTO files (id,user_id,hash,data) VALUES (?,?,?,?)")
        .bind(
          id,
          user.id,
          hash,
          JSON.stringify({
            ...doc,
            type: isPdf
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          }),
        )
        .run();
      await putState(
        user.id,
        { ...state, documents: [...state.documents, doc] },
        revision,
      );
    } catch (e) {
      await runtime.BUCKET.delete(user.id + "/" + id);
      await db()
        .prepare("DELETE FROM files WHERE id=? AND user_id=?")
        .bind(id, user.id)
        .run();
      throw e;
    }
    return Response.json({ id });
  } catch (e) {
    return fail(e);
  }
}
