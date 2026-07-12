import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "./db";
import CaptureView from "./components/CaptureView";
import PracticeView from "./components/PracticeView";
import CardsView from "./components/CardsView";

type Tab = "practice" | "capture" | "cards";

export default function App() {
  const [tab, setTab] = useState<Tab>("practice");

  const dueCount = useLiveQuery(
    () => db.cards.where("due_at").belowOrEqual(Date.now()).count(),
    [tab],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "practice", label: `Practice${dueCount ? ` (${dueCount})` : ""}` },
    { id: "capture", label: "Capture" },
    { id: "cards", label: "Cards" },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 pb-[env(safe-area-inset-bottom)] text-neutral-100">
      <header className="border-b border-neutral-800 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
          <h1 className="text-sm font-bold tracking-wide text-neutral-400">
            GAP TRAINER
          </h1>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === "practice" && <PracticeView />}
        {tab === "capture" && <CaptureView onDone={() => setTab("practice")} />}
        {tab === "cards" && <CardsView />}
      </main>
    </div>
  );
}
