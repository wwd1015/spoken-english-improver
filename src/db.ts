import Dexie, { type EntityTable } from "dexie";
import type { Gap, Card, HardWord, Rep, GeneratedCardSet } from "./types";

const db = new Dexie("gap-trainer") as Dexie & {
  gaps: EntityTable<Gap, "id">;
  cards: EntityTable<Card, "id">;
  hardWords: EntityTable<HardWord, "id">;
  reps: EntityTable<Rep, "id">;
};

db.version(1).stores({
  gaps: "++id, created_at",
  cards: "++id, gap_id, due_at, state",
  hardWords: "++id, card_id",
  reps: "++id, card_id, created_at",
});

export default db;

/** Persist a gap and the cards Claude generated for it, atomically. */
export async function saveGeneratedCards(
  rawText: string,
  generated: GeneratedCardSet,
): Promise<number[]> {
  return db.transaction("rw", db.gaps, db.cards, db.hardWords, async () => {
    const now = Date.now();
    const gapId = await db.gaps.add({ raw_text: rawText, created_at: now });
    const cardIds: number[] = [];
    for (const expr of generated.target_expressions) {
      const cardId = await db.cards.add({
        gap_id: gapId,
        expression: expr.expression,
        example_sentence: expr.example_sentence,
        why_i_avoided: expr.why_i_avoided,
        ease: 2.5,
        interval: 0,
        step: 0,
        due_at: now, // new cards are due immediately
        state: "new",
        created_at: now,
      });
      cardIds.push(cardId);
      for (const hw of expr.hard_words) {
        await db.hardWords.add({
          card_id: cardId,
          word: hw.word,
          syllables: hw.syllables,
          stress_marked: hw.stress_marked,
          ipa: hw.ipa,
          reduced_syllables: hw.reduced_syllables,
          phonics_note: hw.phonics_note,
        });
      }
    }
    return cardIds;
  });
}

export async function deleteCard(cardId: number): Promise<void> {
  await db.transaction("rw", db.cards, db.hardWords, db.reps, async () => {
    await db.hardWords.where("card_id").equals(cardId).delete();
    await db.reps.where("card_id").equals(cardId).delete();
    await db.cards.delete(cardId);
  });
}
