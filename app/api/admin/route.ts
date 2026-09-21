import {
  identity,
  db,
  config,
  defaultConfig,
  fail,
  originCheck,
  AppError,
} from "@/lib/server";
import { dateKey } from "@/lib/study";
export async function GET() {
  try {
    const u = await identity();
    if (!u.owner) throw new AppError("Accès réservé au propriétaire.", 403);
    const c = await config();
    const month = dateKey().slice(0, 7);
    const rows = await db()
      .prepare(
        "SELECT usage.user_id,MAX(members.email) AS email,count(*) AS requests,sum(COALESCE(actual,reserved)) AS cost FROM usage LEFT JOIN members ON members.user_id=usage.user_id WHERE month=? GROUP BY usage.user_id",
      )
      .bind(month)
      .all();
    const totals = await db()
      .prepare(
        "SELECT COALESCE(sum(actual),0) AS used,COALESCE(sum(CASE WHEN actual IS NULL THEN reserved ELSE 0 END),0) AS reserved FROM usage WHERE month=?",
      )
      .bind(month)
      .first();
    const members = await db()
      .prepare("SELECT email,role,active FROM members")
      .all();
    return Response.json(
      { config: c, users: rows.results, members: members.results, ...totals },
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
    if (!u.owner) throw new AppError("Accès réservé au propriétaire.", 403);
    const body = (await req.json()) as any;
    if (body.action === "invite" || body.action === "revoke") {
      const email = String(body.email).trim().toLowerCase();
      if (body.action === "revoke" && email === u.email)
        throw new AppError("Le propriétaire conserve son accès.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        throw new AppError("Courriel invalide.");
      await db()
        .prepare(
          "INSERT INTO members (email,role,active) VALUES (?,'student',?) ON CONFLICT(email) DO UPDATE SET active=excluded.active",
        )
        .bind(email, body.action === "invite" ? 1 : 0)
        .run();
      return Response.json({ ok: true });
    }
    if (body.action === "config") {
      const c = await config(),
        rates = defaultConfig();
      const n = {
        ...c,
        fx: body.fx === undefined ? c.fx : Number(body.fx),
        allowance: Number(body.allowance),
        perUser: Number(body.perUser),
        paused: String(body.paused) !== "false",
        pauseStart: String(body.pauseStart || ""),
        pauseEnd: String(body.pauseEnd || ""),
        model: String(body.model),
        inputRate: body.model === rates.model ? rates.inputRate : 0,
        outputRate: body.model === rates.model ? rates.outputRate : 0,
        webRate: body.model === rates.model ? rates.webRate : 0,
      };
      if (
        !Number.isFinite(n.fx) ||
        n.fx < 1 ||
        n.fx > 3 ||
        !Number.isFinite(n.allowance) ||
        n.allowance < 0 ||
        n.allowance > 100 ||
        !Number.isInteger(n.perUser) ||
        n.perUser < 1 ||
        n.perUser > 1000 ||
        !/^[a-zA-Z0-9_.-]{1,80}$/.test(n.model)
      )
        throw new AppError("Paramètres invalides.");
      if (
        (n.pauseStart && !/^\d{4}-\d{2}-\d{2}$/.test(n.pauseStart)) ||
        (n.pauseEnd && !/^\d{4}-\d{2}-\d{2}$/.test(n.pauseEnd)) ||
        Boolean(n.pauseStart) !== Boolean(n.pauseEnd) ||
        n.pauseEnd < n.pauseStart
      )
        throw new AppError("Vérifie les dates de la pause.");
      if (n.model !== c.model) {
        n.paused = true;
        n.inputRate = 0;
        n.outputRate = 0;
        n.webRate = 0;
      }
      await db()
        .prepare("UPDATE settings SET data=? WHERE id='ai'")
        .bind(JSON.stringify(n))
        .run();
      return Response.json({ ok: true });
    }
    throw new AppError("Action inconnue.");
  } catch (e) {
    return fail(e);
  }
}
