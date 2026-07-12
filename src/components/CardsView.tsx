import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { deleteCard } from "../db";
import { exportAnkiCsv } from "../lib/csv";
import { stumbleRatio } from "../lib/scheduler";

export default function CardsView() {
  const [exporting, setExporting] = useState(false);

  const rows = useLiveQuery(async () => {
    const cards = await db.cards.orderBy("due_at").toArray();
    return Promise.all(
      cards.map(async (card) => {
        const reps = await db.reps.where("card_id").equals(card.id!).toArray();
        return { card, repCount: reps.length, ratio: stumbleRatio(reps) };
      }),
    );
  });

  if (rows === undefined) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-400">
          {rows.length} card{rows.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={async () => {
            setExporting(true);
            try {
              await exportAnkiCsv();
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting || rows.length === 0}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-40"
        >
          {exporting ? "Exporting…" : "Export Anki CSV"}
        </button>
      </div>

      {rows.length === 0 && (
        <p className="py-8 text-center text-neutral-500">
          No cards yet. Capture a gap to get started.
        </p>
      )}

      <div className="space-y-2">
        {rows.map(({ card, repCount, ratio }) => (
          <div
            key={card.id}
            className="flex items-start justify-between gap-3 rounded border border-neutral-800 bg-neutral-900 p-3"
          >
            <div className="min-w-0">
              <div className="font-medium">{card.expression}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                <span
                  className={
                    card.state === "learned"
                      ? "text-emerald-500"
                      : card.state === "review"
                        ? "text-sky-500"
                        : "text-amber-500"
                  }
                >
                  {card.state}
                </span>
                <span>due {formatWhen(card.due_at)}</span>
                <span>{repCount} reps</span>
                {repCount > 0 && (
                  <span className={ratio > 0.3 ? "text-amber-500" : ""}>
                    {Math.round(ratio * 100)}% stumbles
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete card "${card.expression}"?`)) {
                  deleteCard(card.id!);
                }
              }}
              className="shrink-0 text-xs text-neutral-600 hover:text-red-400"
            >
              delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatWhen(ts: number): string {
  const diffMin = Math.round((ts - Date.now()) / 60000);
  if (diffMin <= 0) return "now";
  if (diffMin < 60) return `in ${diffMin} min`;
  if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)} h`;
  return `in ${Math.round(diffMin / 60 / 24)} d`;
}
