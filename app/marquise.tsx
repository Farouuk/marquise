"use client";
import { useState, useEffect, useRef } from "react";
import {
  Home,
  CalendarDays,
  Layers,
  BookOpen,
  MessageCircle,
  Settings,
  Plus,
  ArrowRight,
  ChevronRight,
  Clock,
  Check,
  Leaf,
  Upload,
  FileText,
  Sparkles,
  Search,
  LogOut,
  Shield,
  Share2,
  Trash2,
  Pencil,
  RotateCcw,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  State,
  Deck,
  Card,
  Exam,
  emptyState,
  dateKey,
  plusDays,
  plan,
  dueCards,
  reviewCard,
  uid,
  latestReview,
} from "@/lib/study";
import { runUploadBatch, type UploadItem } from "@/lib/upload-batch";
import { CSVImport } from "@/components/csv-import";
import { cardsToCSV } from "@/lib/cards-csv";
import { Walkthrough } from "@/components/walkthrough";
const nav = [
  ["home", "Mon espace", Home],
  ["plan", "Mon planning", CalendarDays],
  ["cards", "Mes fiches", Layers],
  ["courses", "Mes cours", BookOpen],
  ["tutor", "Mon tuteur", MessageCircle],
] as const;
const fmt = (
  date: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) => new Date(date + "T12:00:00").toLocaleDateString("fr-CA", opts);
const duration = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) : ""}`
    : `${m} min`;
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || "Impossible de terminer cette action.");
  return d;
}
function Answer({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="answer-link"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function Marquise() {
  const [s, setS] = useState<State>(() => emptyState("")),
    [view, setView] = useState("home"),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(true),
    [owner, setOwner] = useState(false),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState(""),
    [deckId, setDeckId] = useState("d1"),
    [edit, setEdit] = useState<any>({}),
    [pink, setPink] = useState(false),
    [mobile, setMobile] = useState(false),
    [reveal, setReveal] = useState(false),
    [reviewId, setReviewId] = useState(""),
    [week, setWeek] = useState(0),
    [filter, setFilter] = useState(""),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [shared, setShared] = useState<any[]>([]),
    [admin, setAdmin] = useState<any>(null),
    [aiReason, setAiReason] = useState(
      "L’IA est désactivée. Tes fiches et ton planning restent disponibles.",
    );
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const uploadLock = useRef(false);
  const generationStop = useRef(false);
  const generationLock = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const uploading = uploads.some(
    (item) => item.status === "uploading" || item.status === "waiting",
  );
  useEffect(() => {
    if (!uploading && !generating) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading, generating]);
  useEffect(() => {
    api("state")
      .then((d) => {
        setS(d.state);
        setDeckId(d.state.decks[0]?.id || "");
        setDemo(d.demo);
        setOwner(d.owner);
        setRevision(d.revision);
        setAiReason(d.aiReason);
        setReady(true);
      })
      .catch((e) => setError(e.message));
    setPink(localStorage.getItem("marquise-theme") === "pink");
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = pink ? "pink" : "sage";
    localStorage.setItem("marquise-theme", pink ? "pink" : "sage");
  }, [pink]);
  useEffect(() => {
    const c = (document as any).modelContext;
    if (!ready || !c?.registerTool) return;
    const controller = new AbortController();
    c.registerTool(
      {
        name: "marquise_read_plan",
        description: "Lire les séances du planning actuellement affiché.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: (input: any) => {
          if (Object.keys(input || {}).length)
            throw new Error("Aucun paramètre attendu.");
          return { sessions: s.sessions, courses: s.courses };
        },
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [s, ready]);
  async function save(next: State, message = "Enregistré.") {
    setBusy(true);
    setError("");
    try {
      const d = await api("state", { state: next, revision });
      setS(d.state);
      setRevision(d.revision);
      setNotice(message);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function go(v: string) {
    setView(v);
    setMobile(false);
    setNotice("");
    setError("");
  }
  const today = dateKey(),
    course = (id: string) => s.courses.find((c) => c.id === id),
    deck = s.decks.find((d) => d.id === deckId),
    due = s.decks.reduce((a, d) => a + dueCards(s, d).length, 0),
    todaySessions = s.sessions.filter((x) => x.date === today),
    total = todaySessions.reduce((a, x) => a + x.minutes, 0),
    done = todaySessions
      .filter((x) => x.done)
      .reduce((a, x) => a + x.minutes, 0),
    short = plan(s).shortages;
  if (!ready)
    return (
      <main className="loading-shell" aria-busy={!error}>
        <div className="loading-mark" aria-hidden="true">
          <Leaf size={28} />
        </div>
        <span className="loading-wordmark">marquise<span>.</span></span>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
          </>
        ) : <p role="status">Chargement de ton espace…</p>}
      </main>
    );
  function open(kind: string, data: any = {}) {
    setEdit(data);
    setModal(kind);
    setError("");
  }
  function startReview(d: Deck) {
    const cards = dueCards(s, d);
    setDeckId(d.id);
    setReviewId(cards[0]?.id || "");
    setReveal(false);
    setModal("review");
  }
  async function rate(rating: number) {
    if (!deck || !reviewId) return;
    const next = {
      ...s,
      reviews: [...s.reviews, reviewCard(s, reviewId, rating)],
    };
    if (await save(next, "Révision enregistrée.")) {
      setReviewId(
        dueCards(next, deck).find((c) => c.id !== reviewId)?.id || "",
      );
      setReveal(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    let next = { ...s };
    if (modal === "course") {
      const c = {
        id: edit.id || uid(),
        name: String(f.name),
        code: String(f.code),
        color: String(f.color),
      };
      next.courses = edit.id
        ? s.courses.map((x) => (x.id === edit.id ? c : x))
        : [...s.courses, c];
    }
    if (modal === "exam") {
      const x = {
        id: edit.id || uid(),
        courseId: String(f.courseId),
        title: String(f.title),
        date: String(f.date),
        format: String(f.format),
        scope: String(f.scope),
        instructions: String(f.instructions),
        hours: Number(f.hours),
      };
      next.exams = edit.id
        ? s.exams.map((e) => (e.id === x.id ? x : e))
        : [...s.exams, x];
      next.sessions = plan(next).sessions;
    }
    if (modal === "deck") {
      const d = {
        id: uid(),
        name: String(f.name),
        courseId: String(f.courseId),
        cards: [],
      };
      next.decks = [...s.decks, d];
      setDeckId(d.id);
    }
    if (modal === "card" && deck) {
      const c: Card = {
        id: edit.id || uid(),
        question: String(f.question),
        answer: String(f.answer),
        topic: String(f.topic),
        ...(edit.source ? { source: edit.source } : {}),
      };
      next.decks = s.decks.map((d) =>
        d.id === deck.id
          ? {
              ...d,
              cards: edit.id
                ? d.cards.map((x) => (x.id === c.id ? c : x))
                : [...d.cards, c],
            }
          : d,
      );
    }
    if (modal === "availability") {
      next.availability = Array.from({ length: 7 }, (_, i) =>
        Number(f["day" + i]),
      );
      if (f.overrideDate)
        next.overrides = {
          ...s.overrides,
          [String(f.overrideDate)]: Number(f.overrideHours),
        };
      next.sessions = plan(next).sessions;
    }
    if (modal === "share") {
      setBusy(true);
      try {
        await api("share", {
          action: "share",
          deckId: deck?.id,
          email: f.email,
        });
        setNotice(
          "Jeu partagé. Les documents et conversations demeurent privés.",
        );
        setModal("");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (await save(next)) setModal("");
  }
  async function generate(resume?: Deck) {
    if (generationLock.current) return;
    generationLock.current = true;
    generationStop.current = false;
    setGenerating(true);
    setBusy(true);
    setError("");
    const courseId = resume?.courseId || selected || s.courses[0]?.id;
    let progress: any;
    try {
      progress = resume?.generation
        ? {
            deckId: resume.id,
            jobId: resume.generation.id,
            next: resume.generation.next,
            total: resume.generation.groups.length,
            added: resume.generation.added,
            target: resume.generation.target,
            done: false,
          }
        : await api("ai", {
            kind: "cards",
            action: "start",
            courseId,
            deckId: edit.targetDeckId,
            examId: edit.examId || undefined,
            documentIds: edit.documentIds || [],
            prompt: edit.focus || "",
            target: Number(edit.count || 24),
          });
      setDeckId(progress.deckId);
      while (!progress.done && !generationStop.current) {
        setGenerationStatus(
          `${progress.added} / ${progress.target} fiches enregistrées · lot ${progress.next + 1} / ${progress.total}`,
        );
        progress = await api("ai", {
          kind: "cards",
          courseId,
          deckId: progress.deckId,
          jobId: progress.jobId,
          batch: progress.next,
          prompt: "",
        });
      }
      setNotice(
        `${progress.added} fiches enregistrées sur un objectif de ${progress.target}. ${progress.done ? "Vérifie le brouillon; le nombre dépend de la matière et des références valides." : "Génération en pause. Tu peux la reprendre dans ce jeu."}`,
      );
      setModal("");
      setView("cards");
    } catch (e: any) {
      setError(
        e.message +
          " Les lots déjà enregistrés sont conservés. Reprends depuis ce jeu.",
      );
    } finally {
      try {
        const fresh = await api("state");
        setS(fresh.state);
        setRevision(fresh.revision);
        setAiReason(fresh.aiReason);
      } catch {
        setError(
          "Impossible d’actualiser ton espace. Recharge avant de reprendre; les lots enregistrés restent sauvegardés.",
        );
      }
      generationLock.current = false;
      setGenerating(false);
      setBusy(false);
      setGenerationStatus("");
    }
  }
  async function uploadOne(item: UploadItem) {
    const file = item.file;
    if (!/\.(pdf|pptx)$/i.test(file.name))
      throw new Error(
        "Format non pris en charge. Utilise un PDF ou un PowerPoint .pptx.",
      );
    if (file.size > 15 * 1024 * 1024)
      throw new Error("Ce fichier dépasse 15 Mo.");
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const cached = await api(
      "documents?hash=" +
        hash +
        "&courseId=" +
        encodeURIComponent(item.courseId),
    );
    if (cached.duplicate) return { duplicate: true };
    const { extract } = await import("@/lib/extract");
    const result = cached.extraction || (await extract(file));
    const data = new FormData();
    data.set("file", file);
    data.set("courseId", item.courseId);
    data.set("extraction", JSON.stringify(result));
    const response = await fetch("/api/documents", {
      method: "POST",
      body: data,
    });
    const saved: any = await response.json();
    if (!response.ok)
      throw new Error(saved.error || "L’envoi a échoué. Réessaie.");
    return saved;
  }
  async function uploadFiles(files: File[]) {
    if (uploadLock.current || busy || !files.length) return;
    if (files.length > 40) {
      setError(
        "Choisis au maximum 40 documents à la fois (15 Mo par fichier).",
      );
      return;
    }
    const destination = course(selected || s.courses[0]?.id);
    if (!destination) {
      setError("Choisis d’abord un cours.");
      return;
    }
    await processUploads(
      files.map((file) => ({
        id: uid(),
        file,
        courseId: destination.id,
        courseName: destination.name,
        status: "waiting",
      })),
    );
  }
  async function processUploads(items: UploadItem[]) {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setUploads(items);
    try {
      const results = await runUploadBatch(items, uploadOne, setUploads);
      const saved = results.filter((x) => x.status === "saved").length;
      const duplicate = results.filter((x) => x.status === "duplicate").length;
      const failed = results.filter((x) => x.status === "error").length;
      setNotice(
        `${saved} document(s) enregistré(s), ${duplicate} déjà présent(s), ${failed} à réessayer. Consulte les résultats ci-dessous.`,
      );
      // A refresh failure must not mark already-persisted documents as failed.
      const fresh = await api("state");
      setS(fresh.state);
      setRevision(fresh.revision);
    } catch (error: any) {
      setError(
        "Les résultats d’envoi sont conservés ci-dessous. Impossible d’actualiser la liste : " +
          error.message +
          " Recharge la page avant de modifier ton espace.",
      );
    } finally {
      uploadLock.current = false;
      setBusy(false);
    }
  }
  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    setError("");
    try {
      const d = await api("ai", {
        kind: "tutor",
        courseId: selected || s.courses[0]?.id,
        examId: edit.examId || undefined,
        prompt: question,
      });
      setAnswer(d.answer);
      const fresh = await api("state");
      setS(fresh.state);
      setRevision(fresh.revision);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    nav.find((n) => n[0] === view)?.[1] ||
    (
      {
        settings: "Mes préférences",
        admin: "Administration",
        sharing: "Fiches partagées",
      } as any
    )[view];
  return (
    <div className="shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brandmark">
            <Leaf size={26} />
          </span>
          <span>
            marquise<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="semester">MON COMPAGNON D’ÉTUDES</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={20} />
              {label}
              {id === "cards" && due > 0 && (
                <span className="nav-count">{due}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-courses">
          <div className="eyebrow">
            MES COURS{" "}
            <button
              aria-label="Ajouter un cours"
              onClick={() => open("course")}
            >
              <Plus size={17} />
            </button>
          </div>
          {s.courses.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelected(c.id);
                go("courses");
              }}
            >
              <span className={"dot " + c.color} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <Leaf size={19} />
            <p>
              Un peu chaque jour.
              <br />
              <strong>À ton rythme.</strong>
            </p>
          </div>
          <button className="settings-link" onClick={() => go("settings")}>
            <Settings size={19} />
            Mes préférences
          </button>
          {owner && (
            <button
              className="settings-link"
              onClick={() => {
                go("admin");
                api("admin")
                  .then(setAdmin)
                  .catch((e) => setError(e.message));
              }}
            >
              <Shield size={19} />
              Administration
            </button>
          )}
          <div className="profile">
            <span className="avatar">{s.name?.[0] || "M"}</span>
            <span>
              <strong>{s.name || "Mon compte"}</strong>
              <small>{demo ? "Espace de démonstration" : "Espace privé"}</small>
            </span>
            <ChevronRight size={17} />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="menu-button"
              aria-label="Ouvrir le menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>{title}</span>
          </div>
          <div className="top-right">
            <Walkthrough ready={ready} navigate={go} />
            <span className="private-label">
              <Shield size={14} />
              {demo ? "Données d’exemple" : "Mon espace privé"}
            </span>
            <button
              className="round-theme"
              aria-label="Changer le thème"
              onClick={() => setPink(!pink)}
            >
              <span className={pink ? "rose" : "sage"} />
            </button>
          </div>
        </header>
        <main>
          {generating && modal !== "generate" && (
            <div className="alert" role="status">
              <p>{generationStatus}</p>
              <Button
                variant="outline"
                onClick={() => {
                  generationStop.current = true;
                  setGenerationStatus("Pause après le lot en cours…");
                }}
              >
                Mettre en pause après ce lot
              </Button>
            </div>
          )}
          <div aria-live="polite">
            {error && (
              <div className="alert error">
                {error}
                <button onClick={() => setError("")} aria-label="Fermer">
                  <X size={18} />
                </button>
              </div>
            )}
            {notice && <div className="alert success">{notice}</div>}
          </div>
          {view === "home" && (
            <>
              <div className="greeting">
                <div>
                  <p className="eyebrow">
                    {fmt(today, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <h1>
                    Bonjour{s.name ? `, ${s.name}` : ""}
                    <span className="greeting-dot">.</span>
                  </h1>
                  <p>On fait un petit pas ensemble ?</p>
                </div>
                <Button variant="outline" onClick={() => open("exam")}>
                  <Plus />
                  Ajouter un examen
                </Button>
              </div>
              <div className="dashboard-grid">
                <div className="main-column">
                  <section className="focus-card">
                    <div className="focus-top">
                      <span className="pill">
                        <Leaf size={14} />À TON RYTHME
                      </span>
                      <span className="muted">
                        {duration(total)} prévues aujourd’hui
                      </span>
                    </div>
                    <h2>Une chose à la fois.</h2>
                    <p>
                      Quelques fiches, un concept qui s’éclaire.
                      <br />
                      Chaque petit moment compte.
                    </p>
                    <Button
                      disabled={!due || busy || !ready}
                      onClick={() => {
                        const d = s.decks.find((d) => dueCards(s, d).length);
                        if (d) startReview(d);
                      }}
                    >
                      Réviser mes fiches <ArrowRight />
                    </Button>
                    <div className="focus-footer">
                      <span>
                        <Layers size={16} />
                        {due} fiches à revoir
                      </span>
                      <span>Sans pression, sans chrono.</span>
                    </div>
                  </section>
                  <section>
                    <div className="section-title">
                      <h2>Mon programme du jour</h2>
                      <button onClick={() => go("plan")}>
                        Voir le planning <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="schedule-list">
                      {todaySessions.length ? (
                        todaySessions.map((x, i) => (
                          <div
                            key={x.id}
                            className={"session " + (x.done ? "done" : "")}
                          >
                            <button
                              className="completion"
                              aria-label={
                                x.done
                                  ? "Séance terminée"
                                  : "Terminer la séance"
                              }
                              disabled={x.done || busy || !ready}
                              onClick={() =>
                                save(
                                  {
                                    ...s,
                                    sessions: s.sessions.map((a) =>
                                      a.id === x.id ? { ...a, done: true } : a,
                                    ),
                                  },
                                  "Un petit pas de plus. Séance terminée !",
                                )
                              }
                            >
                              {x.done ? (
                                <Check size={16} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </button>
                            <div className="session-info">
                              <span
                                className={
                                  "course-label " + course(x.courseId)?.color
                                }
                              >
                                {course(x.courseId)?.name}
                              </span>
                              <strong>
                                {x.kind} ·{" "}
                                {s.exams.find((e) => e.id === x.examId)
                                  ?.scope || "Préparer mon examen"}
                              </strong>
                              <small>
                                {x.kind === "Réviser"
                                  ? "Fiches et rappel actif"
                                  : x.kind === "Pratiquer"
                                    ? "Questions et mise en application"
                                    : "Concepts et notes de cours"}
                              </small>
                            </div>
                            <span className="time">
                              <Clock size={14} />
                              {duration(x.minutes)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="empty">
                          Un peu d’espace pour souffler. Aucune séance
                          aujourd’hui.
                          <Button
                            variant="outline"
                            onClick={() => open("exam")}
                          >
                            Planifier un examen
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="daily-progress">
                      <span>
                        {duration(done)} complétées sur {duration(total)}
                      </span>
                      <div>
                        <i
                          style={{
                            width: `${total ? (done / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </section>
                  <section>
                    <div className="section-title">
                      <h2>Mes jeux de fiches</h2>
                      <button onClick={() => go("cards")}>
                        Tous mes jeux <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="deck-grid">
                      {s.decks.slice(0, 2).map((d) => (
                        <button
                          key={d.id}
                          className="deck-tile"
                          onClick={() => {
                            setDeckId(d.id);
                            go("cards");
                          }}
                        >
                          <span
                            className={"deck-icon " + course(d.courseId)?.color}
                          >
                            <Layers />
                          </span>
                          <small>{course(d.courseId)?.name}</small>
                          <h3>{d.name}</h3>
                          <div>
                            <span>{d.cards.length} fiches</span>
                            <span className="due-badge">
                              {dueCards(s, d).length} à revoir
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
                <aside className="right-column">
                  <section className="exam-panel">
                    <div className="section-title">
                      <h2>À l’horizon</h2>
                      <CalendarDays size={19} />
                    </div>
                    <p className="muted">Tes prochains examens</p>
                    {s.exams
                      .filter((e) => e.date >= today)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 3)
                      .map((e) => (
                        <button
                          className="exam-row"
                          key={e.id}
                          onClick={() => open("exam", e)}
                        >
                          <span
                            className={"date-tile " + course(e.courseId)?.color}
                          >
                            <b>{fmt(e.date, { day: "numeric" })}</b>
                            <small>{fmt(e.date, { month: "short" })}</small>
                          </span>
                          <span>
                            <strong>{course(e.courseId)?.name}</strong>
                            <small>{e.title}</small>
                            <em>
                              Dans{" "}
                              {Math.ceil(
                                (Date.parse(e.date) - Date.parse(today)) /
                                  864e5,
                              )}{" "}
                              jours
                            </em>
                          </span>
                        </button>
                      ))}
                    <button className="text-link" onClick={() => go("plan")}>
                      Préparer la suite <ArrowRight size={16} />
                    </button>
                  </section>
                  <section className="tutor-panel">
                    <span className="tutor-icon">
                      <Sparkles size={23} />
                    </span>
                    <h2>On démêle ça ?</h2>
                    <p>
                      Une notion qui résiste ? Ton tuteur t’aide à y voir plus
                      clair, à partir de tes cours.
                    </p>
                    <Button variant="outline" onClick={() => go("tutor")}>
                      Discuter avec mon tuteur <ArrowRight />
                    </Button>
                  </section>
                  <p className="gentle-footer">
                    <Leaf size={16} />
                    Apprendre prend du temps.
                    <br />
                    Tu as le droit de prendre le tien.
                  </p>
                </aside>
              </div>
            </>
          )}
          {view === "plan" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">UNE SEMAINE À LA FOIS</p>
                  <h1>Mon planning</h1>
                  <p>Un plan qui s’adapte à la vraie vie.</p>
                </div>
                <div className="actions">
                  <Button
                    variant="outline"
                    onClick={() => open("availability")}
                  >
                    Mes disponibilités
                  </Button>
                  <Button onClick={() => open("exam")}>
                    <Plus />
                    Un examen
                  </Button>
                </div>
              </div>
              {short.length > 0 && (
                <div className="alert warning">
                  Il manque {duration(short.reduce((a, x) => a + x.minutes, 0))}{" "}
                  avant tes examens. Réduis la portée ou les estimations, ou
                  ajuste tes disponibilités. Aucune heure supplémentaire n’a été
                  ajoutée.
                </div>
              )}
              <div className="plan-toolbar">
                <div className="actions">
                  <Button
                    variant="ghost"
                    disabled={week === 0}
                    onClick={() => setWeek(week - 1)}
                    aria-label="Semaine précédente"
                  >
                    ←
                  </Button>
                  <span>
                    {fmt(plusDays(today, week * 7))} —{" "}
                    {fmt(plusDays(today, week * 7 + 6))}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={week >= 51}
                    onClick={() => setWeek(week + 1)}
                    aria-label="Semaine suivante"
                  >
                    →
                  </Button>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    save(
                      { ...s, sessions: plan(s).sessions },
                      "Séances futures redistribuées; travail terminé conservé.",
                    )
                  }
                >
                  <RotateCcw />
                  Redistribuer le travail
                </Button>
              </div>
              <div className="week-grid">
                {Array.from({ length: 7 }, (_, i) =>
                  plusDays(today, week * 7 + i),
                ).map((day) => {
                  const sessions = s.sessions.filter((x) => x.date === day);
                  return (
                    <section
                      className={"day-column " + (day === today ? "today" : "")}
                      key={day}
                    >
                      <h3>
                        {fmt(day, { weekday: "short" })}
                        <b>{fmt(day, { day: "numeric" })}</b>
                      </h3>
                      <small>
                        {duration(sessions.reduce((a, x) => a + x.minutes, 0))}{" "}
                        /{" "}
                        {duration(
                          (s.overrides[day] ??
                            s.availability[
                              new Date(day + "T12:00:00").getDay()
                            ]) * 60,
                        )}
                      </small>
                      {sessions.map((x) => (
                        <button
                          key={x.id}
                          className={
                            "plan-session " + course(x.courseId)?.color
                          }
                          disabled={busy || x.done || day > today}
                          onClick={() =>
                            save({
                              ...s,
                              sessions: s.sessions.map((a) =>
                                a.id === x.id ? { ...a, done: true } : a,
                              ),
                            })
                          }
                        >
                          <strong>
                            {x.done ? "✓ " : ""}
                            {x.kind}
                          </strong>
                          <span>{course(x.courseId)?.name}</span>
                          <small>{duration(x.minutes)}</small>
                        </button>
                      ))}
                      {!sessions.length && (
                        <p className="rest-day">Du temps pour toi.</p>
                      )}
                    </section>
                  );
                })}
              </div>
              <div className="section-title">
                <h2>Mes examens</h2>
              </div>
              <div className="exam-table">
                {s.exams.map((e) => (
                  <button key={e.id} onClick={() => open("exam", e)}>
                    <span className={"dot " + course(e.courseId)?.color} />
                    <strong>{course(e.courseId)?.name}</strong>
                    <span>{e.title}</span>
                    <span>{fmt(e.date)}</span>
                    <span>{e.hours} h estimées</span>
                    <Pencil size={16} />
                  </button>
                ))}
              </div>
            </>
          )}
          {view === "cards" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">COMPRENDRE. SE RAPPELER.</p>
                  <h1>Mes fiches</h1>
                  <p>Un concept à la fois, pour longtemps.</p>
                </div>
                <div className="actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      go("sharing");
                      api("share")
                        .then((d) => setShared(d.shares))
                        .catch((e) => setError(e.message));
                    }}
                  >
                    <Share2 />
                    Partagés avec moi
                  </Button>
                  <Button variant="outline" onClick={() => open("csv")}>
                    Importer un CSV
                  </Button>
                  <Button onClick={() => open("deck")}>
                    <Plus />
                    Créer un jeu
                  </Button>
                </div>
              </div>
              <div className="cards-layout">
                <aside className="deck-list">
                  {s.decks.map((d) => (
                    <button
                      key={d.id}
                      className={deckId === d.id ? "selected" : ""}
                      onClick={() => {
                        setDeckId(d.id);
                        setFilter("");
                      }}
                    >
                      <Layers size={19} />
                      <span>
                        <strong>{d.name}</strong>
                        <small>
                          {d.cards.length} fiches ·{" "}
                          {course(d.courseId)?.code || "Partagé"}
                        </small>
                      </span>
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelected(s.courses[0]?.id || "");
                      open("generate");
                    }}
                  >
                    <Sparkles />
                    Générer des fiches
                  </Button>
                </aside>
                <section className="card-editor">
                  {deck ? (
                    <>
                      <div className="section-title">
                        <div>
                          <span className="eyebrow">
                            {course(deck.courseId)?.name || "Jeu partagé"}
                          </span>
                          <h2>{deck.name}</h2>
                        </div>
                        <Button
                          disabled={!dueCards(s, deck).length || busy}
                          onClick={() => startReview(deck)}
                        >
                          Réviser ({dueCards(s, deck).length}) <ArrowRight />
                        </Button>
                      </div>
                      <div className="actions">
                        <Button variant="outline" onClick={() => open("card")}>
                          <Plus />
                          Ajouter une fiche
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!!deck.sharedBy}
                          onClick={() => open("share")}
                        >
                          <Share2 />
                          Partager
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelected(deck.courseId);
                            open("generate", {
                              targetDeckId: deck.id,
                              focus:
                                "Renforcer les notions faibles et couvrir les sujets encore absents.",
                            });
                          }}
                        >
                          Compléter ce jeu
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const url = URL.createObjectURL(
                            new Blob([cardsToCSV(deck.cards)], {
                              type: "text/csv;charset=utf-8",
                            }),
                          );
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = deck.name + ".csv";
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        Exporter en CSV
                      </Button>
                      {deck.generation && (
                        <div className="alert" role="status">
                          <p>
                            {deck.generation.added} / {deck.generation.target}{" "}
                            fiches générées · {deck.generation.next} /{" "}
                            {deck.generation.groups.length} lots traités ·{" "}
                            {
                              new Set(
                                deck.generation.groups
                                  .slice(0, deck.generation.next)
                                  .flat()
                                  .map(
                                    (p) =>
                                      `${p.documentId}:${p.page}:${p.offset}`,
                                  ),
                              ).size
                            }{" "}
                            / {deck.generation.totalExcerpts} extraits
                            parcourus. Un extrait traité ne garantit pas que
                            toutes ses notions sont couvertes.
                          </p>
                          {deck.generation.next <
                            deck.generation.groups.length &&
                            deck.generation.added < deck.generation.target && (
                              <div className="actions">
                                <Button
                                  disabled={busy}
                                  onClick={() => generate(deck)}
                                >
                                  Reprendre la génération
                                </Button>
                                <Button
                                  variant="outline"
                                  disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    try {
                                      await api("ai", {
                                        kind: "cards",
                                        action: "finish",
                                        courseId: deck.courseId,
                                        deckId: deck.id,
                                        jobId: deck.generation!.id,
                                        prompt: "",
                                      });
                                      const fresh = await api("state");
                                      setS(fresh.state);
                                      setRevision(fresh.revision);
                                      setNotice(
                                        "Génération terminée. Les fiches créées sont conservées.",
                                      );
                                    } catch (e: any) {
                                      setError(e.message);
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                >
                                  Terminer avec ces fiches
                                </Button>
                              </div>
                            )}
                        </div>
                      )}
                      <div className="search-field">
                        <Search size={18} />
                        <Input
                          placeholder="Rechercher dans ce jeu…"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        />
                      </div>
                      {deck.cards
                        .filter((c) =>
                          (c.question + c.answer)
                            .toLowerCase()
                            .includes(filter.toLowerCase()),
                        )
                        .map((c, i) => (
                          <article key={c.id} className="qa-card">
                            <div className="qa-heading">
                              <span>
                                FICHE {String(i + 1).padStart(2, "0")} ·{" "}
                                {c.topic || "Concept"}
                              </span>
                              <div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Modifier la fiche"
                                  onClick={() => open("card", c)}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Supprimer la fiche"
                                  onClick={() => open("delete-card", c)}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </div>
                            <h3>{c.question}</h3>
                            <p>{c.answer}</p>
                            {c.source && (
                              <button
                                className="source"
                                onClick={() => open("source", c.source)}
                              >
                                <FileText size={14} />
                                {c.source.name} · p. / diapo {c.source.page}
                              </button>
                            )}
                            <small className="muted">
                              {latestReview(s, c.id)
                                ? `Prochaine révision : ${fmt(latestReview(s, c.id)!.due)}`
                                : "Nouvelle fiche"}
                            </small>
                          </article>
                        ))}
                      {!deck.cards.length && (
                        <div className="empty">
                          Ce jeu attend tes premières idées. Ajoute une fiche ou
                          génère un brouillon à partir de tes documents.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty">
                      Crée ton premier jeu pour commencer.
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "courses" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">TES REPÈRES</p>
                  <h1>Mes cours</h1>
                  <p>Tes documents, tes notions, tes propres mots.</p>
                </div>
                <Button onClick={() => open("course")}>
                  <Plus />
                  Ajouter un cours
                </Button>
              </div>
              <div className="course-tabs">
                {s.courses.map((c) => (
                  <button
                    key={c.id}
                    className={
                      (selected || s.courses[0]?.id) === c.id ? "selected" : ""
                    }
                    onClick={() => setSelected(c.id)}
                  >
                    <span className={"dot " + c.color} />
                    {c.name}
                  </button>
                ))}
              </div>
              {s.courses.length > 0 && (
                <>
                  <div className="section-title">
                    <h2>Documents du cours</h2>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        open("course", course(selected || s.courses[0]?.id))
                      }
                    >
                      <Pencil />
                      Modifier le cours
                    </Button>
                  </div>
                  <label className={"upload-zone " + (busy ? "disabled" : "")}>
                    <Upload />
                    <strong>
                      {busy ? "Traitement en cours…" : "Ajouter des documents"}
                    </strong>
                    <span>
                      Sélectionne plusieurs PDF ou PowerPoint (.pptx) · 15 Mo
                      par fichier
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.pptx"
                      disabled={busy}
                      onChange={(e) => {
                        void uploadFiles(Array.from(e.target.files || []));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {uploads.length > 0 && (
                    <section
                      className="upload-results"
                      aria-label="Résultats des envois"
                      aria-busy={uploading}
                    >
                      <div className="section-title">
                        <h3>Envoi vers {uploads[0].courseName}</h3>
                        <span role="status" aria-live="polite">
                          {
                            uploads.filter(
                              (x) =>
                                !["waiting", "uploading"].includes(x.status),
                            ).length
                          }{" "}
                          / {uploads.length} traités
                        </span>
                      </div>
                      {uploading && (
                        <p className="muted">
                          Garde cet onglet ouvert. Les documents sont traités un
                          à un.
                        </p>
                      )}
                      <ul>
                        {uploads.map((item) => (
                          <li
                            key={item.id}
                            className={
                              item.status === "error" ? "upload-failed" : ""
                            }
                          >
                            <FileText size={18} />
                            <div>
                              <strong>{item.file.name}</strong>
                              <span>
                                {
                                  (
                                    {
                                      waiting: "En attente",
                                      uploading: "Extraction et envoi…",
                                      saved: "Enregistré",
                                      duplicate: "Déjà présent dans ce cours",
                                      error: "Échec de l’envoi",
                                    } as const
                                  )[item.status]
                                }
                              </span>
                              {item.message && <p>{item.message}</p>}
                            </div>
                            {item.status === "saved" && <Check size={18} />}
                          </li>
                        ))}
                      </ul>
                      {!uploading &&
                        uploads.some((x) => x.status === "error") && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => processUploads(uploads)}
                          >
                            <RotateCcw />
                            Réessayer les envois échoués
                          </Button>
                        )}
                    </section>
                  )}
                  <p className="muted">
                    Les pages et diapositives sont conservées. Les images et
                    schémas nécessitent une vérification humaine; aucun contenu
                    visuel n’est deviné.
                  </p>
                  {s.documents
                    .filter(
                      (d) => d.courseId === (selected || s.courses[0]?.id),
                    )
                    .map((d) => (
                      <article className="document-row" key={d.id}>
                        <FileText />
                        <div>
                          <h3>{d.name}</h3>
                          <p>
                            {d.pages.length} pages / diapositives · texte
                            enregistré
                          </p>
                          {d.warnings.map((w, i) => (
                            <small key={i} className="warning-text">
                              {w}
                            </small>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => open("document", d)}
                        >
                          Consulter
                        </Button>
                      </article>
                    ))}
                  <Button onClick={() => open("generate")}>
                    <Sparkles />
                    Créer des fiches à partir de ce cours
                  </Button>
                </>
              )}
            </>
          )}
          {view === "tutor" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">UN ESPACE POUR COMPRENDRE</p>
                  <h1>Mon tuteur</h1>
                  <p>Pose tes questions, sans hésiter.</p>
                </div>
              </div>
              <div className="tutor-workspace">
                <div className="tutor-controls">
                  <Field label="Cours">
                    <NativeSelect
                      value={selected || s.courses[0]?.id || ""}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {s.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Examen (facultatif)">
                    <NativeSelect
                      value={edit.examId || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, examId: e.target.value })
                      }
                    >
                      <option value="">Tout le cours</option>
                      {s.exams
                        .filter(
                          (e) => e.courseId === (selected || s.courses[0]?.id),
                        )
                        .map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.title}
                          </option>
                        ))}
                    </NativeSelect>
                  </Field>
                </div>
                <div className="tutor-welcome">
                  <Sparkles size={30} />
                  <h2>Faisons de la place aux déclics.</h2>
                  <p>
                    Les documents de ton cours passent en premier.
                    <br />
                    Les explications complémentaires sont identifiées.
                  </p>
                  <div className="prompt-chips">
                    {[
                      "Explique-moi cette notion simplement.",
                      "Compare deux concepts du cours.",
                      "Propose une question d’analyse de cas.",
                    ].map((q) => (
                      <button key={q} onClick={() => setQuestion(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                {aiReason && <div className="alert warning">{aiReason}</div>}
                {s.chats
                  .filter((c) => c.courseId === (selected || s.courses[0]?.id))
                  .slice(-6)
                  .map((c, i) => (
                    <div className="chat-pair" key={i}>
                      <strong>{c.question}</strong>
                      <p>
                        <Answer text={c.answer} />
                      </p>
                    </div>
                  ))}
                <div className="composer">
                  <Textarea
                    aria-label="Ta question"
                    placeholder="Qu’aimerais-tu mieux comprendre ?"
                    maxLength={2000}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <Button disabled={busy || !question.trim()} onClick={ask}>
                    {busy ? "Un instant…" : "Envoyer"}
                    <ArrowRight />
                  </Button>
                </div>
                <small className="muted">
                  Contexte limité aux extraits pertinents. La psychologie est
                  abordée à des fins éducatives.
                </small>
              </div>
            </>
          )}
          {view === "sharing" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Fiches partagées</h1>
                  <p>Les idées circulent. Tes progrès restent à toi.</p>
                </div>
              </div>
              {shared.length ? (
                shared.map((x) => (
                  <article className="document-row" key={x.id}>
                    <Layers />
                    <div>
                      <h3>{x.deck.name}</h3>
                      <p>{x.deck.cards.length} fiches · aucun document joint</p>
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          await api("share", { action: "import", id: x.id });
                          const d = await api("state");
                          setS(d.state);
                          setRevision(d.revision);
                          setNotice(
                            "Copie ajoutée. Tes révisions seront privées.",
                          );
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      Ajouter à mes fiches
                    </Button>
                  </article>
                ))
              ) : (
                <div className="empty">
                  Aucun jeu partagé avec toi pour l’instant.
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>À ta façon</h1>
                  <p>Un espace où tu te sens bien.</p>
                </div>
              </div>
              <section className="settings-panel">
                <Field label="Ton prénom">
                  <Input
                    value={edit.name ?? s.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </Field>
                <Button
                  disabled={busy}
                  onClick={() => save({ ...s, name: edit.name ?? s.name })}
                >
                  Enregistrer
                </Button>
                <h2>Ambiance</h2>
                <div className="actions">
                  <Button
                    variant={!pink ? "default" : "outline"}
                    onClick={() => setPink(false)}
                  >
                    Jardin calme
                  </Button>
                  <Button
                    variant={pink ? "default" : "outline"}
                    onClick={() => setPink(true)}
                  >
                    Rose doux
                  </Button>
                </div>
                <h2>Du temps pour apprendre</h2>
                <Button variant="outline" onClick={() => open("availability")}>
                  Modifier mes disponibilités
                </Button>
                <h2>Mon compte</h2>
                <p>
                  {demo
                    ? "Démonstration : les exemples sont enregistrés dans une session séparée. Ce ne sont pas tes données de cours."
                    : "Compte sur invitation. Tes documents et conversations ne sont jamais inclus dans un partage de fiches."}
                </p>
                <a
                  className="text-link"
                  href={
                    demo
                      ? "/signin-with-chatgpt?return_to=/"
                      : "/signout-with-chatgpt?return_to=/"
                  }
                >
                  {demo ? "Me connecter avec mon invitation" : "Me déconnecter"}
                  <LogOut size={16} />
                </a>
              </section>
            </>
          )}
          {view === "admin" && owner && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Administration</h1>
                  <p>Un budget mesuré, des limites prudentes.</p>
                </div>
              </div>
              {admin ? (
                <AdminPanel
                  data={admin}
                  refresh={() => api("admin").then(setAdmin)}
                  onError={setError}
                />
              ) : (
                <p>Chargement…</p>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>marquise.</span>
            <span>
              {demo
                ? "Démonstration · Données fictives · Aucune IA simulée"
                : "Ton espace, à ton rythme."}
            </span>
            <Leaf size={14} />
          </footer>
        </main>
      </div>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) {
            generationStop.current = true;
            setModal("");
          }
        }}
      >
        <DialogContent
          className={
            "marquise-dialog " + (modal === "review" ? "review-dialog" : "")
          }
        >
          <DialogTitle>
            {
              (
                {
                  course: edit.id ? "Modifier le cours" : "Un nouveau cours",
                  exam: edit.id ? "Modifier l’examen" : "Un examen à préparer",
                  deck: "Un nouveau jeu",
                  card: edit.id ? "Modifier la fiche" : "Une nouvelle fiche",
                  availability: "Du temps pour étudier",
                  share: "Partager ce jeu",
                  generate: "Créer un brouillon de fiches",
                  csv: "Importer des fiches",
                  review: deck?.name || "Réviser",
                  source: "Référence du cours",
                  document: edit.name,
                  "delete-card": "Supprimer cette fiche ?",
                } as any
              )[modal]
            }
          </DialogTitle>
          <DialogDescription>
            {modal === "review"
              ? "Prends le temps de retrouver la réponse."
              : modal === "generate"
                ? "Les fiches générées doivent être vérifiées avant utilisation."
                : modal === "availability"
                  ? "Des heures par jour, sans imposer d’horaire."
                  : "À ton rythme. Tu pourras revenir sur tes choix."}
          </DialogDescription>
          {error && <div className="alert error">{error}</div>}
          {["course", "exam", "deck", "card", "availability", "share"].includes(
            modal,
          ) && (
            <form onSubmit={submit} className="modal-form">
              {modal === "course" && (
                <>
                  <Field label="Nom du cours">
                    <Input
                      name="name"
                      defaultValue={edit.name}
                      required
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Sigle">
                    <Input
                      name="code"
                      defaultValue={edit.code}
                      maxLength={30}
                      placeholder="PSY 303"
                    />
                  </Field>
                  <Field label="Couleur">
                    <NativeSelect
                      name="color"
                      defaultValue={edit.color || "sage"}
                    >
                      <option value="sage">Sauge</option>
                      <option value="rose">Rose</option>
                      <option value="sand">Miel</option>
                      <option value="blue">Bleu</option>
                    </NativeSelect>
                  </Field>
                </>
              )}
              {(modal === "exam" || modal === "deck") && (
                <>
                  <Field label="Cours">
                    <NativeSelect
                      name="courseId"
                      defaultValue={
                        edit.courseId || selected || s.courses[0]?.id
                      }
                      required
                    >
                      {s.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field
                    label={modal === "exam" ? "Nom de l’examen" : "Nom du jeu"}
                  >
                    <Input
                      name={modal === "exam" ? "title" : "name"}
                      defaultValue={edit.title || edit.name}
                      required
                      maxLength={120}
                    />
                  </Field>
                </>
              )}
              {modal === "exam" && (
                <>
                  <div className="form-row">
                    <Field label="Date">
                      <Input
                        name="date"
                        type="date"
                        defaultValue={edit.date || plusDays(today, 14)}
                        min={today}
                        required
                      />
                    </Field>
                    <Field label="Effort estimé (heures)">
                      <Input
                        name="hours"
                        type="number"
                        min="0.5"
                        max="200"
                        step="0.5"
                        defaultValue={edit.hours || 8}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Format">
                    <NativeSelect
                      name="format"
                      defaultValue={edit.format || "Choix multiples"}
                    >
                      {[
                        "Choix multiples",
                        "Réponses courtes",
                        "Analyse de cas",
                        "Choix multiples et réponses courtes",
                        "Combinaison de formats",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Chapitres, documents ou sujets couverts">
                    <Textarea
                      name="scope"
                      defaultValue={edit.scope}
                      maxLength={3000}
                    />
                  </Field>
                  <Field label="Consignes, priorités et exclusions du professeur">
                    <Textarea
                      name="instructions"
                      defaultValue={edit.instructions}
                      maxLength={3000}
                    />
                  </Field>
                  <p className="muted">
                    Modifier l’examen recalcule les séances futures, en
                    conservant le travail terminé. L’effort est une estimation
                    ajustable.
                  </p>
                </>
              )}
              {modal === "card" && (
                <>
                  <Field label="Question">
                    <Textarea
                      name="question"
                      defaultValue={edit.question}
                      required
                      maxLength={1500}
                    />
                  </Field>
                  <Field label="Réponse">
                    <Textarea
                      name="answer"
                      defaultValue={edit.answer}
                      required
                      maxLength={4000}
                    />
                  </Field>
                  <Field label="Notion">
                    <Input
                      name="topic"
                      defaultValue={edit.topic}
                      maxLength={100}
                    />
                  </Field>
                  {edit.source && (
                    <small>
                      Référence conservée : {edit.source.name}, p. / diapo{" "}
                      {edit.source.page}
                    </small>
                  )}
                </>
              )}
              {modal === "availability" && (
                <>
                  <div className="availability-grid">
                    {[
                      "Dimanche",
                      "Lundi",
                      "Mardi",
                      "Mercredi",
                      "Jeudi",
                      "Vendredi",
                      "Samedi",
                    ].map((d, i) => (
                      <Field label={d} key={d}>
                        <Input
                          name={"day" + i}
                          type="number"
                          min="0"
                          max="12"
                          step="0.25"
                          defaultValue={s.availability[i]}
                          required
                        />
                      </Field>
                    ))}
                  </div>
                  <h3>Une journée différente ?</h3>
                  <div className="form-row">
                    <Field label="Date">
                      <Input type="date" name="overrideDate" />
                    </Field>
                    <Field label="Heures disponibles">
                      <Input
                        type="number"
                        name="overrideHours"
                        min="0"
                        max="12"
                        step="0.25"
                        defaultValue={0}
                      />
                    </Field>
                  </div>
                  {Object.entries(s.overrides).map(([d, h]) => (
                    <small key={d}>
                      {fmt(d)} : {h} h{" "}
                      <button
                        type="button"
                        onClick={() => {
                          const o = { ...s.overrides };
                          delete o[d];
                          save({
                            ...s,
                            overrides: o,
                            sessions: plan({ ...s, overrides: o }).sessions,
                          });
                        }}
                      >
                        Retirer
                      </button>
                    </small>
                  ))}
                </>
              )}
              {modal === "share" && (
                <>
                  <p>
                    Seules les questions, réponses et références écrites sont
                    partagées. Ni les documents, ni les conversations, ni tes
                    progrès.
                  </p>
                  <Field label="Courriel d’un membre invité">
                    <Input type="email" name="email" required />
                  </Field>
                </>
              )}
              <Button type="submit" disabled={busy || !ready}>
                {busy
                  ? "Enregistrement…"
                  : modal === "share"
                    ? "Partager"
                    : "Enregistrer"}
              </Button>
            </form>
          )}
          {modal === "review" &&
            (() => {
              const c = deck?.cards.find((c) => c.id === reviewId);
              return c ? (
                <div className="review-surface">
                  <span className="eyebrow">RAPPEL ACTIF · {c.topic}</span>
                  <h2>{c.question}</h2>
                  {reveal ? (
                    <>
                      <p>{c.answer}</p>
                      {c.source && (
                        <small>
                          {c.source.name} · p. / diapo {c.source.page}
                        </small>
                      )}
                      <div className="recall-buttons">
                        {["À revoir", "Difficile", "Bien", "Facile"].map(
                          (x, i) => (
                            <Button
                              key={x}
                              variant="outline"
                              disabled={busy}
                              onClick={() => rate(i)}
                            >
                              {x}
                            </Button>
                          ),
                        )}
                      </div>
                    </>
                  ) : (
                    <Button onClick={() => setReveal(true)}>
                      Voir la réponse
                    </Button>
                  )}
                </div>
              ) : (
                <div className="review-surface">
                  <Leaf size={38} />
                  <h2>Un beau petit pas.</h2>
                  <p>
                    Cette séance est terminée. Tes prochaines révisions sont
                    enregistrées.
                  </p>
                  <Button onClick={() => setModal("")}>
                    Revenir à mon espace
                  </Button>
                </div>
              );
            })()}
          {modal === "delete-card" && (
            <>
              <p>La fiche sera retirée de ce jeu.</p>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (
                    await save({
                      ...s,
                      decks: s.decks.map((d) =>
                        d.id === deckId
                          ? {
                              ...d,
                              cards: d.cards.filter((c) => c.id !== edit.id),
                            }
                          : d,
                      ),
                    })
                  )
                    setModal("");
                }}
              >
                Supprimer
              </Button>
            </>
          )}
          {modal === "source" && (
            <div className="source-detail">
              <p>
                {edit.name} · p. / diapo {edit.page}
              </p>
              <p>
                {s.documents
                  .find((d) => d.id === edit.documentId)
                  ?.pages.find((p) => p.page === edit.page)?.text ||
                  "Le document original est privé ou n’est pas disponible dans ton espace. La référence est conservée à titre indicatif."}
              </p>
            </div>
          )}
          {modal === "document" && (
            <div className="document-preview">
              {edit.warnings?.map((w: string, i: number) => (
                <p className="warning-text" key={i}>
                  {w}
                </p>
              ))}
              {edit.id !== "sample-doc" && (
                <a
                  className="text-link"
                  target="_blank"
                  rel="noreferrer"
                  href={"/api/documents?id=" + encodeURIComponent(edit.id)}
                >
                  Ouvrir le fichier original <ArrowRight size={16} />
                </a>
              )}
              {edit.pages?.map((p: any) => (
                <article key={p.page}>
                  <h3>Page / diapositive {p.page}</h3>
                  <p>{p.text || "Aucun texte extractible."}</p>
                  {p.diagrams?.map((x: string, i: number) => (
                    <p key={i} className="warning-text">
                      {x}
                    </p>
                  ))}
                </article>
              ))}
            </div>
          )}
          {modal === "csv" && (
            <CSVImport
              courses={s.courses}
              busy={busy}
              onImport={async (name, courseId, cards) => {
                const imported = { id: uid(), name, courseId, cards };
                if (
                  await save(
                    { ...s, decks: [...s.decks, imported] },
                    `${cards.length} fiches importées, sans appel IA.`,
                  )
                ) {
                  setDeckId(imported.id);
                  setModal("");
                  setView("cards");
                }
              }}
            />
          )}
          {modal === "generate" && (
            <div className="modal-form">
              <fieldset disabled={generating} className="modal-form">
                <Field label="Cours">
                  <NativeSelect
                    value={selected || s.courses[0]?.id || ""}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setEdit({ ...edit, documentIds: [], examId: "" });
                    }}
                  >
                    {s.courses.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Examen visé">
                  <NativeSelect
                    value={edit.examId || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, examId: e.target.value })
                    }
                  >
                    <option value="">Tout le cours</option>
                    {s.exams
                      .filter(
                        (e) => e.courseId === (selected || s.courses[0]?.id),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <fieldset>
                  <legend>Documents à utiliser (tous si aucun choix)</legend>
                  {s.documents
                    .filter(
                      (d) => d.courseId === (selected || s.courses[0]?.id),
                    )
                    .map((d) => (
                      <label className="check-label" key={d.id}>
                        <input
                          type="checkbox"
                          checked={(edit.documentIds || []).includes(d.id)}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              documentIds: e.target.checked
                                ? [...(edit.documentIds || []), d.id]
                                : (edit.documentIds || []).filter(
                                    (id: string) => id !== d.id,
                                  ),
                            })
                          }
                        />
                        {d.name}
                      </label>
                    ))}
                </fieldset>
                <Field label="Notions à renforcer (facultatif)">
                  <Textarea
                    value={edit.focus || ""}
                    maxLength={2000}
                    onChange={(e) =>
                      setEdit({ ...edit, focus: e.target.value })
                    }
                  />
                </Field>
                <Field label="Nombre de fiches souhaité">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={edit.count || 24}
                    onChange={(e) =>
                      setEdit({ ...edit, count: e.target.value })
                    }
                  />
                </Field>
                <p>
                  Objectif de 1 à 120 fiches par génération. Chaque lot est
                  sauvegardé dans le même jeu. La matière disponible peut
                  produire moins de fiches; aucune réponse n’est inventée pour
                  atteindre le nombre.
                </p>
                <p className="muted">
                  Environ {Math.ceil(Number(edit.count || 24) / 6)} appels IA,
                  décomptés de ta limite mensuelle. Le budget et les pauses sont
                  vérifiés avant chaque appel. Garde l’app ouverte; tu peux
                  reprendre après une interruption.
                </p>
              </fieldset>
              {aiReason && <div className="alert warning">{aiReason}</div>}
              {generating && (
                <>
                  <p role="status">{generationStatus}</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      generationStop.current = true;
                      setGenerationStatus("Pause après le lot en cours…");
                    }}
                  >
                    Mettre en pause après ce lot
                  </Button>
                </>
              )}
              <Button
                disabled={
                  busy ||
                  !!aiReason ||
                  !Number.isInteger(Number(edit.count || 24)) ||
                  Number(edit.count || 24) < 1 ||
                  Number(edit.count || 24) > 120
                }
                onClick={() => generate()}
              >
                <Sparkles />
                {generating ? "Génération en cours…" : "Générer les fiches"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function AdminPanel({
  data,
  refresh,
  onError,
}: {
  data: any;
  refresh: () => void;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function act(body: any) {
    setBusy(true);
    try {
      await api("admin", body);
      refresh();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-grid">
      <section className="settings-panel">
        <h2>Utilisation ce mois-ci</h2>
        <p className="budget-number">
          {((data.used || 0) / 1e6).toFixed(3)} $ US
        </p>
        <p>
          Charges fournisseur estimées. Réservations incluses :{" "}
          {(data.reserved / 1e6).toFixed(3)} $ US.
        </p>
        <p>
          Conversion indicative : 1 $ US = {data.config.fx} $ CA. Hébergement et
          stockage : non inclus, à mesurer séparément.
        </p>
        {data.users.map((u: any) => (
          <p key={u.user_id}>
            {u.email || u.user_id} · {u.requests} requêtes ·{" "}
            {(u.cost / 1e6).toFixed(3)} $ US
          </p>
        ))}
        <p className="muted">
          Les alertes du fournisseur ne constituent pas un plafond garanti.
          Marquise réserve un maximum prudent par requête avant l’appel.
        </p>
      </section>
      <section className="settings-panel">
        <h2>Limites et pauses</h2>
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            act({
              action: "config",
              ...Object.fromEntries(new FormData(e.currentTarget)),
            });
          }}
        >
          <Field label="Allocation mensuelle IA ($ CA)">
            <Input
              name="allowance"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={data.config.allowance}
            />
          </Field>
          <Field label="Conversion indicative ($ CA pour 1 $ US)">
            <Input
              name="fx"
              type="number"
              min="1"
              max="3"
              step="0.01"
              defaultValue={data.config.fx}
            />
          </Field>
          <Field label="Limite mensuelle par membre (requêtes)">
            <Input
              name="perUser"
              type="number"
              min="1"
              max="1000"
              defaultValue={data.config.perUser}
            />
          </Field>
          <Field label="Modèle">
            <Input name="model" defaultValue={data.config.model} />
          </Field>
          <div className="form-row">
            <Field label="Début de pause">
              <Input
                name="pauseStart"
                type="date"
                defaultValue={data.config.pauseStart}
              />
            </Field>
            <Field label="Fin de pause (incluse)">
              <Input
                name="pauseEnd"
                type="date"
                defaultValue={data.config.pauseEnd}
              />
            </Field>
          </div>
          <Field label="État">
            <NativeSelect
              name="paused"
              defaultValue={String(data.config.paused)}
            >
              <option value="true">IA en pause</option>
              <option value="false">IA autorisée si configurée</option>
            </NativeSelect>
          </Field>
          <Button disabled={busy}>Enregistrer les limites</Button>
        </form>
        <p className="muted">
          Seuil prudent : 85 % de l’allocation. Deux requêtes simultanées au
          total, une par membre. L’activation payante exige aussi
          AI_ENABLED=true côté serveur et des tarifs configurés.
        </p>
      </section>
      <section className="settings-panel">
        <h2>Membres sur invitation</h2>
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            act({
              action: "invite",
              email: new FormData(e.currentTarget).get("email"),
            });
          }}
        >
          <Field label="Courriel du membre">
            <Input type="email" name="email" required />
          </Field>
          <Button disabled={busy}>Autoriser ce membre</Button>
        </form>
        {data.members.map((m: any) => (
          <div className="member-row" key={m.email}>
            <span>
              {m.email} · {m.active ? "Actif" : "Retiré"}
            </span>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => act({ action: "revoke", email: m.email })}
            >
              Retirer
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
