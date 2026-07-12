import { useState } from "react";
import { generateCards } from "../api/claude";
import { saveGeneratedCards } from "../db";
import type { GeneratedCardSet } from "../types";

const PLACEHOLDER = `Dump a gap — a moment today where you stalled or avoided a word. Any language, messy is fine.

e.g. 想说"这个假设站不住脚"，结果只说了 this is not good
e.g. stalled on "comparable" again`;

export default function CaptureView({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedCardSet | null>(null);

  async function handleGenerate() {
    const gap = text.trim();
    if (!gap || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const generated = await generateCards(gap);
      await saveGeneratedCards(gap, generated);
      setResult(generated);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
        }}
        placeholder={PLACEHOLDER}
        rows={5}
        autoFocus
        className="w-full resize-y rounded border border-neutral-700 bg-neutral-900 p-3 text-base placeholder-neutral-600 focus:border-neutral-400 focus:outline-none sm:text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={busy || !text.trim()}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate cards"}
        </button>
        <span className="text-xs text-neutral-500">⌘/Ctrl+Enter</span>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="text-sm text-emerald-400">
            {result.target_expressions.length} card
            {result.target_expressions.length === 1 ? "" : "s"} added to your
            deck.
          </div>
          {result.target_expressions.map((expr, i) => (
            <div
              key={i}
              className="rounded border border-neutral-800 bg-neutral-900 p-3"
            >
              <div className="font-semibold">{expr.expression}</div>
              <div className="mt-1 text-sm italic text-neutral-400">
                {expr.example_sentence}
              </div>
              {expr.hard_words.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {expr.hard_words.map((hw) => (
                    <span
                      key={hw.word}
                      className="rounded bg-neutral-800 px-2 py-1 font-mono"
                    >
                      {hw.stress_marked} {hw.ipa}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={onDone}
            className="rounded bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white"
          >
            Practice now →
          </button>
        </div>
      )}
    </div>
  );
}
