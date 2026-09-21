import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { cookies } from "next/headers";
import { emptyState, sampleState, State, dateKey } from "./study";
export const runtime = env as unknown as {
  DB: D1Database;
  BUCKET: R2Bucket;
  OWNER_EMAIL?: string;
  OPENAI_API_KEY?: string;
  AI_ENABLED?: string;
  AI_INPUT_USD_PER_M?: string;
  AI_OUTPUT_USD_PER_M?: string;
  AI_WEB_CALL_USD?: string;
  AI_MODEL?: string;
};
export const db = () => {
  if (!runtime.DB)
    throw new Error("La base de données est indisponible. Réessaie plus tard.");
  return runtime.DB;
};
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function fail(e: unknown) {
  console.error(e instanceof Error ? e.message : "Request failed");
  return Response.json(
    { error: e instanceof Error ? e.message : "Une erreur est survenue." },
    {
      status: e instanceof AppError ? e.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function originCheck(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new AppError("Origine non autorisée.", 403);
}
export async function identity() {
  const user = await getChatGPTUser();
  if (user && runtime.OWNER_EMAIL) {
    const owner =
      !!runtime.OWNER_EMAIL &&
      user.email.toLowerCase() === runtime.OWNER_EMAIL.toLowerCase();
    if (!owner) {
      const m = await db()
        .prepare("SELECT active FROM members WHERE email=?")
        .bind(user.email.toLowerCase())
        .first<{ active: number }>();
      if (!m?.active)
        throw new AppError(
          "Cet espace est sur invitation. Le propriétaire doit autoriser ton courriel.",
          403,
        );
    }
    await db()
      .prepare(
        "INSERT INTO members (email,user_id,role,active) VALUES (?,?,?,1) ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id",
      )
      .bind(user.email.toLowerCase(), user.userId, owner ? "owner" : "student")
      .run();
    return {
      id: user.userId,
      email: user.email.toLowerCase(),
      name: user.fullName?.split(" ")[0] || "",
      owner,
      demo: false,
    };
  }
  const jar = await cookies();
  let id = jar.get("marquise_demo")?.value;
  if (!id || !/^demo_[a-f0-9-]{36}$/.test(id)) {
    id = "demo_" + crypto.randomUUID();
    jar.set("marquise_demo", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 86400 * 7,
    });
  }
  return { id, email: "", name: "Camille", owner: false, demo: true };
}
export async function getState(user: Awaited<ReturnType<typeof identity>>) {
  await db()
    .prepare(
      "INSERT OR IGNORE INTO studies (user_id,data,revision) VALUES (?,?,0)",
    )
    .bind(
      user.id,
      JSON.stringify(user.demo ? sampleState() : emptyState(user.name)),
    )
    .run();
  const row = await db()
    .prepare("SELECT data,revision FROM studies WHERE user_id=?")
    .bind(user.id)
    .first<{ data: string; revision: number }>();
  if (!row) throw new Error("Espace indisponible.");
  return { state: JSON.parse(row.data) as State, revision: row.revision };
}
export async function putState(id: string, state: State, revision: number) {
  if (new TextEncoder().encode(JSON.stringify(state)).length > 1500000)
    throw new AppError(
      "Ton espace dépasse 1,5 Mo de texte. Utilise des documents plus courts.",
    );
  const result = await db()
    .prepare(
      "UPDATE studies SET data=?,revision=revision+1 WHERE user_id=? AND revision=?",
    )
    .bind(JSON.stringify(state), id, revision)
    .run();
  if (!result.meta.changes)
    throw new AppError(
      "Ton espace a changé dans un autre onglet. Recharge la page avant de réessayer; ta saisie est conservée ici.",
      409,
    );
  return { state, revision: revision + 1 };
}
export type Config = {
  allowance: number;
  fx: number;
  perUser: number;
  paused: boolean;
  pauseStart: string;
  pauseEnd: string;
  model: string;
  inputRate: number;
  outputRate: number;
  webRate: number;
};
const positiveRate = (n: unknown) => {
  const value = Number(n);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
export function defaultConfig(): Config {
  return {
    allowance: 12,
    fx: 1.4,
    perUser: 60,
    paused: true,
    pauseStart: "",
    pauseEnd: "",
    model: runtime.AI_MODEL || "gpt-4.1-mini",
    inputRate: positiveRate(runtime.AI_INPUT_USD_PER_M),
    outputRate: positiveRate(runtime.AI_OUTPUT_USD_PER_M),
    webRate: positiveRate(runtime.AI_WEB_CALL_USD),
  };
}
export async function config() {
  await db()
    .prepare("INSERT OR IGNORE INTO settings (id,data) VALUES (?,?)")
    .bind("ai", JSON.stringify(defaultConfig()))
    .run();
  const r = await db()
    .prepare("SELECT data FROM settings WHERE id=?")
    .bind("ai")
    .first<{ data: string }>();
  return JSON.parse(r!.data) as Config;
}
export function pauseReason(c: Config, demo = false, t = dateKey()) {
  if (demo)
    return "Mode démonstration : aucun appel IA. Connecte-toi avec une invitation pour utiliser tes propres documents.";
  if (c.paused)
    return "L’IA est en pause à la demande du propriétaire. Les fiches et le planning restent disponibles.";
  if (c.pauseStart && c.pauseEnd && t >= c.pauseStart && t <= c.pauseEnd)
    return `Pause planifiée de l’IA jusqu’au ${c.pauseEnd}. Les révisions restent disponibles.`;
  if (
    runtime.AI_ENABLED !== "true" ||
    !runtime.OPENAI_API_KEY ||
    !c.inputRate ||
    !c.outputRate
  )
    return "L’IA n’est pas activée. Le propriétaire doit configurer le fournisseur et ses tarifs après approbation des coûts.";
  return "";
}
