import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db";
import CardPractice from "./CardPractice";

export default function PracticeView() {
  // Bumped after each grade so the due query re-evaluates against a fresh "now".
  const [pass, setPass] = useState(0);
  const [forcedCardId, setForcedCardId] = useState<number | null>(null);

  const dueCards = useLiveQuery(
    () => db.cards.where("due_at").belowOrEqual(Date.now()).sortBy("due_at"),
    [pass],
  );

  const nextUpcoming = useLiveQuery(async () => {
    const upcoming = await db.cards
      .where("due_at")
      .above(Date.now())
      .sortBy("due_at");
    return upcoming[0] ?? null;
  }, [pass]);

  const totalCards = useLiveQuery(() => db.cards.count(), [pass]);

  if (dueCards === undefined) return null;

  const forced =
    forcedCardId !== null && nextUpcoming?.id === forcedCardId
      ? nextUpcoming
      : null;
  const current = dueCards[0] ?? forced;

  if (!current) {
    return (
      <div className="space-y-4 py-12 text-center">
        {totalCards === 0 ? (
          <p className="text-neutral-400">
            No cards yet. Go to <b>Capture</b> and log your first gap.
          </p>
        ) : nextUpcoming ? (
          <>
            <p className="text-neutral-400">Nothing due right now.</p>
            <p className="text-sm text-neutral-500">
              Next card (&ldquo;{nextUpcoming.expression}&rdquo;) due{" "}
              {formatDue(nextUpcoming.due_at)}.
            </p>
            <button
              onClick={() => setForcedCardId(nextUpcoming.id!)}
              className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Practice it now anyway
            </button>
          </>
        ) : (
          <p className="text-neutral-400">All done.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-neutral-500">
        {dueCards.length} card{dueCards.length === 1 ? "" : "s"} due
      </div>
      <CardPractice
        key={current.id}
        card={current}
        onGraded={() => {
          setForcedCardId(null);
          setPass((p) => p + 1);
        }}
      />
    </div>
  );
}

function formatDue(dueAt: number): string {
  const diffMin = Math.round((dueAt - Date.now()) / 60000);
  if (diffMin < 60) return `in ${Math.max(1, diffMin)} min`;
  if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)} h`;
  return `in ${Math.round(diffMin / 60 / 24)} d`;
}
