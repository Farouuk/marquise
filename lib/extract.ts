export async function extract(file: File) {
  if (file.size > 15 * 1024 * 1024)
    throw new Error(
      "Ce fichier dépasse 15 Mo. Divise-le en documents plus petits.",
    );
  const ext = file.name.toLowerCase().split(".").pop();
  if (!["pdf", "pptx"].includes(ext || ""))
    throw new Error(
      "Format non pris en charge. Utilise un PDF avec texte sélectionnable ou un PowerPoint .pptx (pas .ppt).",
    );
  const pages: { page: number; text: string; diagrams: string[] }[] = [],
    warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const loading = pdfjs.getDocument({ data: buffer, useSystemFonts: true });
    let pdf;
    try {
      pdf = await loading.promise;
    } catch {
      throw new Error(
        "Impossible d’ouvrir ce PDF. Il peut être protégé, endommagé ou incompatible.",
      );
    }
    if (pdf.numPages > 150) {
      await loading.destroy();
      throw new Error("Limite de 150 pages par document. Divise le PDF.");
    }
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n);
        const content = await p.getTextContent();
        const text = content.items
          .map((x: any) => x.str + (x.hasEOL ? "\n" : " "))
          .join("")
          .trim();
        pages.push({
          page: n,
          text,
          diagrams: [
            "Contenu visuel non interprété : vérifie les schémas, images et tableaux dans le PDF original.",
          ],
        });
        if (!text)
          warnings.push(
            `Page ${n} : aucun texte extractible. Les scans nécessitent une reconnaissance de caractères externe.`,
          );
        p.cleanup();
      }
    } finally {
      await loading.destroy();
    }
  } else {
    const { unzipSync } = await import("fflate");
    let expanded = 0;
    const zip = unzipSync(new Uint8Array(buffer), {
      filter(entry) {
        if (
          !/^ppt\/slides\/slide\d+\.xml$/.test(entry.name) &&
          !["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"].includes(
            entry.name,
          )
        )
          return false;
        expanded += entry.originalSize;
        if (expanded > 10 * 1024 * 1024 || entry.originalSize > 1024 * 1024)
          throw new Error(
            "Archive PowerPoint trop volumineuse après décompression.",
          );
        return true;
      },
    });
    const parse = (name: string) =>
      new DOMParser().parseFromString(
        new TextDecoder().decode(zip[name]),
        "application/xml",
      );
    if (!zip["ppt/presentation.xml"] || !zip["ppt/_rels/presentation.xml.rels"])
      throw new Error("Ordre des diapositives introuvable.");
    const relationships = Array.from(
      parse("ppt/_rels/presentation.xml.rels").getElementsByTagNameNS(
        "*",
        "Relationship",
      ),
    );
    const names = Array.from(
      parse("ppt/presentation.xml").getElementsByTagNameNS("*", "sldId"),
    ).map((slide) => {
      const rid = slide.getAttribute("r:id");
      const target =
        relationships
          .find((r) => r.getAttribute("Id") === rid)
          ?.getAttribute("Target") || "";
      const path = target.startsWith("/ppt/")
        ? target.slice(1)
        : "ppt/" + target;
      if (!zip[path])
        throw new Error("Diapositive introuvable dans le PowerPoint.");
      return path;
    });
    if (!names.length || names.length > 150)
      throw new Error("PowerPoint invalide ou supérieur à 150 diapositives.");
    for (const [slideIndex, name] of names.entries()) {
      const xml = new DOMParser().parseFromString(
        new TextDecoder().decode(zip[name]),
        "application/xml",
      );
      if (xml.querySelector("parsererror"))
        throw new Error("Une diapositive est endommagée.");
      const text = Array.from(xml.getElementsByTagNameNS("*", "t"))
        .map((x) => x.textContent)
        .join("\n");
      const n = slideIndex + 1;
      pages.push({
        page: n,
        text,
        diagrams: [
          "Images, graphiques et schémas non interprétés. Consulte la diapositive originale.",
        ],
      });
      if (!text.trim())
        warnings.push(`Diapositive ${n} : aucun texte extractible.`);
    }
  }
  if (!pages.some((p) => p.text.trim()))
    throw new Error(
      "Aucun texte sélectionnable trouvé. Aucun contenu n’a été inventé.",
    );
  if (
    pages.some((p) => p.text.length > 20000) ||
    pages.reduce((a, p) => a + p.text.length, 0) > 600000
  )
    throw new Error(
      "Trop de texte dans ce document. Divise-le pour conserver les références sans troncature.",
    );
  warnings.unshift(
    "Les schémas ne sont pas interprétés automatiquement. Le fichier original est conservé pour consultation.",
  );
  return { pages, warnings };
}
