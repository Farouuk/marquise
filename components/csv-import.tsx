"use client";
import { useState } from "react";
import { parseCardsCSV } from "@/lib/cards-csv";
import type { Card, Course } from "@/lib/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
export function CSVImport({
  courses,
  onImport,
  busy,
}: {
  courses: Course[];
  onImport: (name: string, courseId: string, cards: Card[]) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState(""),
    [name, setName] = useState("Fiches importées"),
    [course, setCourse] = useState(courses[0]?.id || ""),
    [result, setResult] = useState<ReturnType<typeof parseCardsCSV> | null>(
      null,
    ),
    [error, setError] = useState("");
  function preview(value: string) {
    setText(value);
    setResult(null);
    setError("");
    try {
      setResult(parseCardsCSV(value));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-form">
      <p>
        Importe les fiches créées dans ChatGPT ou une autre application. Aucun
        appel IA ni frais API pour cet import.
      </p>
      <label>
        Nom du jeu
        <Input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Cours
        <NativeSelect
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label>
        Fichier CSV
        <input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2_000_000) {
              setError("Le fichier dépasse 2 Mo.");
              setResult(null);
              return;
            }
            try {
              preview(await file.text());
            } catch {
              setError("Impossible de lire le fichier.");
              setResult(null);
            }
          }}
        />
      </label>
      <label>
        Ou colle ton CSV
        <Textarea
          rows={7}
          value={text}
          placeholder={'question,reponse\n"Quelle notion ?","Son explication."'}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
        />
      </label>
      <p className="muted">
        Colonnes : question, réponse; thème, source et page facultatifs.
        Virgule, point-virgule ou tabulation. Les sources importées restent non
        vérifiées.
      </p>
      <Button variant="outline" onClick={() => preview(text)}>
        Vérifier le CSV
      </Button>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite">
          <p>
            {result.cards.length} fiches prêtes · {result.duplicates} doublons
            ignorés · {result.issues.length} lignes à corriger
          </p>
          {result.issues.slice(0, 5).map((x) => (
            <p key={x}>{x}</p>
          ))}
          {result.cards.slice(0, 3).map((c) => (
            <article key={c.id}>
              <strong>{c.question}</strong>
              <p>{c.answer}</p>
            </article>
          ))}
        </div>
      )}
      <Button
        disabled={
          busy ||
          !course ||
          !name.trim() ||
          !result?.cards.length ||
          !!result?.issues.length
        }
        onClick={() => onImport(name.trim(), course, result!.cards)}
      >
        Importer {result?.cards.length || ""} fiches
      </Button>
    </div>
  );
}
