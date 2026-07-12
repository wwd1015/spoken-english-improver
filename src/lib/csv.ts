import db from "../db";

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Export all cards as Anki-importable CSV (Front, Back).
 * Back holds example sentence + hard-word breakdowns as HTML (Anki renders it).
 */
export async function exportAnkiCsv(): Promise<void> {
  const cards = await db.cards.toArray();
  const lines: string[] = ["#separator:Comma", "#html:true", "#columns:Front,Back"];

  for (const card of cards) {
    const hardWords = await db.hardWords
      .where("card_id")
      .equals(card.id!)
      .toArray();
    const front = card.expression;
    const backParts = [
      `<i>${card.example_sentence}</i>`,
      ...hardWords.map(
        (hw) =>
          `<b>${hw.word}</b>: ${hw.stress_marked} ${hw.ipa}` +
          (hw.reduced_syllables.length
            ? ` — swallow: ${hw.reduced_syllables.join(", ")}`
            : "") +
          `<br><small>${hw.phonics_note}</small>`,
      ),
    ];
    lines.push(`${csvEscape(front)},${csvEscape(backParts.join("<br>"))}`);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gap-trainer-anki-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
