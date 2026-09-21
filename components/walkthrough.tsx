"use client";
import { useEffect, useState } from "react";
import {
  Leaf,
  BookOpen,
  CalendarDays,
  Layers,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const steps = [
  {
    title: "Bienvenue dans Marquise",
    icon: Leaf,
    text: "Un espace pour préparer tes examens, comprendre tes cours et réviser à ton rythme.",
    detail:
      "Cette visite prend environ une minute. Tu peux la fermer en tout temps et la reprendre avec le bouton Guide.",
    view: "home",
    action: "Aller à mon espace",
  },
  {
    title: "Rassemble tes cours",
    icon: BookOpen,
    text: "Dans Mes cours, crée un cours, puis ajoute plusieurs PDF ou PowerPoint en une seule sélection.",
    detail:
      "Ouvre Consulter pour vérifier le texte et ses pages. Les schémas demandent une vérification humaine; Marquise ne devine pas leur contenu.",
    view: "courses",
    action: "Ouvrir mes cours",
  },
  {
    title: "Prépare tes examens",
    icon: CalendarDays,
    text: "Ajoute la date, le format, la matière à couvrir et les consignes du professeur. Indique ensuite tes heures disponibles par jour.",
    detail:
      "Le planning répartit le travail entre tes cours, respecte tes disponibilités et te signale ce qui ne tient pas. Tu peux ajuster les estimations et redistribuer le travail inachevé.",
    view: "plan",
    action: "Ouvrir mon planning",
  },
  {
    title: "Crée, vérifie et révise",
    icon: Layers,
    text: "Crée un brouillon de fiches à partir de tes documents, ou écris tes propres questions. Vérifie les réponses et leurs références avant de réviser.",
    detail:
      "Essaie de retrouver la réponse, puis indique ton niveau de rappel. Marquise organise les prochaines révisions. Partager un jeu ne partage ni tes documents, ni tes conversations, ni ton progrès.",
    view: "cards",
    action: "Ouvrir mes fiches",
  },
  {
    title: "Pose une question à ton tuteur",
    icon: MessageCircle,
    text: "Choisis ton cours et, au besoin, ton examen. Demande une explication, une comparaison ou une question de pratique.",
    detail:
      "Le tuteur s’appuie d’abord sur les extraits du cours et indique ses références. Les compléments externes sont identifiés. La génération et le tutorat utilisent l’allocation IA du propriétaire; les fiches enregistrées et le planning restent accessibles pendant une pause.",
    view: "tutor",
    action: "Ouvrir mon tuteur",
  },
];

export function Walkthrough({
  ready,
  navigate,
}: {
  ready: boolean;
  navigate: (view: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!ready) return;
    try {
      if (!localStorage.getItem("marquise-guide-v1")) setOpen(true);
    } catch {
      /* The guide also works without browser storage. */
    }
  }, [ready]);
  function close() {
    setOpen(false);
    try {
      localStorage.setItem("marquise-guide-v1", "seen");
    } catch {
      /* Optional device preference. */
    }
  }
  const current = steps[step],
    Icon = current.icon;
  return (
    <>
      <Button
        variant="ghost"
        disabled={!ready}
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        aria-label="Guide de Marquise"
      >
        <BookOpen size={17} /> Guide
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent className="marquise-dialog walkthrough">
          <div className="guide-symbol" aria-hidden="true">
            <Icon size={30} />
          </div>
          <p className="guide-progress" aria-live="polite">
            Découvrir Marquise · {step + 1} sur {steps.length}
          </p>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.text}</DialogDescription>
          <p className="guide-detail">{current.detail}</p>
          <Button
            variant="outline"
            onClick={() => {
              close();
              navigate(current.view);
            }}
          >
            {current.action}
          </Button>
          <div className="guide-actions">
            <Button variant="ghost" onClick={close}>
              Plus tard
            </Button>
            <div>
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Précédent
                </Button>
              )}
              <Button
                onClick={() =>
                  step === steps.length - 1 ? close() : setStep(step + 1)
                }
              >
                {step === steps.length - 1 ? "C’est parti" : "Suivant"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
