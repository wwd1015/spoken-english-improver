import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db";
import type { Card } from "../types";
import { speak } from "../lib/tts";
import { schedule, stumbleRatio, voiceGatePassed } from "../lib/scheduler";
import { useRecorder } from "../hooks/useRecorder";

const GATE_MESSAGE = "You've read it. You haven't said it.";

export default function CardPractice({
  card,
  onGraded,
}: {
  card: Card;
  onGraded: () => void;
}) {
  const [slow, setSlow] = useState(false);
  const [gateWarning, setGateWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const recorder = useRecorder();

  const hardWords = useLiveQuery(
    () => db.hardWords.where("card_id").equals(card.id!).toArray(),
    [card.id],
  );
  const reps = useLiveQuery(
    () => db.reps.where("card_id").equals(card.id!).sortBy("created_at"),
    [card.id],
  );

  async function grade(smooth: boolean) {
    if (saving) return;
    if (recorder.status !== "recorded" || !recorder.blob) {
      setGateWarning(true);
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      const rep = {
        card_id: card.id!,
        audio_blob: recorder.blob,
        mime_type: recorder.mimeType,
        smooth,
        created_at: now,
      };
      await db.transaction("rw", db.reps, db.cards, async () => {
        await db.reps.add(rep);
        const allReps = await db.reps
          .where("card_id")
          .equals(card.id!)
          .toArray();
        const next = schedule(card, smooth, allReps, now);
        await db.cards.update(card.id!, next);
      });
      recorder.reset();
      onGraded();
    } finally {
      setSaving(false);
    }
  }

  const ratio = reps ? stumbleRatio(reps) : 0;
  const gatePassed = reps ? voiceGatePassed(reps) : false;

  return (
    <div className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      {/* Expression + TTS */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold">{card.expression}</h2>
          <button
            onClick={() => speak(card.expression, slow)}
            className="rounded bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600"
            title="Play native TTS"
          >
            ▶ Listen
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={slow}
              onChange={(e) => setSlow(e.target.checked)}
            />
            0.75× slow
          </label>
        </div>
        <p className="mt-2 text-sm italic text-neutral-300">
          {card.example_sentence}
          <button
            onClick={() => speak(card.example_sentence, slow)}
            className="ml-2 text-neutral-500 hover:text-neutral-300"
            title="Play sentence"
          >
            ▶
          </button>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Why you avoided it: {card.why_i_avoided}
        </p>
      </div>

      {/* Hard words */}
      {hardWords && hardWords.length > 0 && (
        <div className="space-y-2">
          {hardWords.map((hw) => (
            <div
              key={hw.id}
              className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-base font-bold tracking-wide">
                  {renderStress(hw.stress_marked)}
                </span>
                <span className="font-mono text-neutral-400">{hw.ipa}</span>
                <button
                  onClick={() => speak(hw.word, slow)}
                  className="text-neutral-500 hover:text-neutral-300"
                  title={`Play "${hw.word}"`}
                >
                  ▶
                </button>
              </div>
              {hw.reduced_syllables.length > 0 && (
                <div className="mt-1 text-xs text-amber-400">
                  Swallow (schwa /ə/):{" "}
                  {hw.reduced_syllables.map((s) => `“${s}”`).join(", ")} — don't
                  pronounce these fully
                </div>
              )}
              <div className="mt-1 text-xs text-neutral-500">
                {hw.phonics_note}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Speak: record, A/B compare, grade */}
      <div className="space-y-3 border-t border-neutral-800 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          {recorder.status === "recording" ? (
            <button
              onClick={recorder.stop}
              className="animate-pulse rounded bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-500 sm:py-2 sm:text-sm"
            >
              ■ Stop recording
            </button>
          ) : (
            <button
              onClick={() => {
                setGateWarning(false);
                recorder.start();
              }}
              className="rounded bg-red-700 px-4 py-3 text-base font-semibold text-white hover:bg-red-600 sm:py-2 sm:text-sm"
            >
              ● {recorder.status === "recorded" ? "Record again" : "Record yourself"}
            </button>
          )}

          {recorder.status === "recorded" && recorder.url && (
            <>
              <audio controls src={recorder.url} className="h-9" />
              <button
                onClick={() => speak(card.expression, slow)}
                className="rounded bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600"
                title="A/B: play the native version again"
              >
                ▶ Native
              </button>
            </>
          )}
        </div>

        {recorder.error && (
          <div className="text-sm text-red-400">{recorder.error}</div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => grade(true)}
            disabled={saving}
            className={`flex-1 rounded px-5 py-3 text-base font-semibold transition-colors sm:flex-none sm:py-2 sm:text-sm ${
              recorder.status === "recorded"
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "bg-neutral-800 text-neutral-500"
            }`}
          >
            Smooth
          </button>
          <button
            onClick={() => grade(false)}
            disabled={saving}
            className={`flex-1 rounded px-5 py-3 text-base font-semibold transition-colors sm:flex-none sm:py-2 sm:text-sm ${
              recorder.status === "recorded"
                ? "bg-orange-600 text-white hover:bg-orange-500"
                : "bg-neutral-800 text-neutral-500"
            }`}
          >
            Stumbled
          </button>
          {gateWarning && (
            <span className="w-full text-sm font-semibold text-red-400 sm:w-auto">
              {GATE_MESSAGE}
            </span>
          )}
        </div>

        {/* Rep history / gate status */}
        {reps && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>
              {reps.length} spoken rep{reps.length === 1 ? "" : "s"}
            </span>
            {reps.length > 0 && (
              <span>
                stumble ratio {Math.round(ratio * 100)}%
                {ratio > 0.3 && (
                  <span className="text-amber-500">
                    {" "}
                    — over 30%, this card never graduates
                  </span>
                )}
              </span>
            )}
            <span>
              voice gate:{" "}
              {gatePassed ? (
                <span className="text-emerald-500">passed</span>
              ) : (
                `${Math.min(reps.length, 3)}/3 reps, last 2 must be smooth`
              )}
            </span>
            <span className="text-neutral-600">
              state {card.state} · interval {card.interval}d · ease{" "}
              {card.ease.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Render "as-SUMP-tion" with the stressed syllable highlighted. */
function renderStress(stressMarked: string) {
  return stressMarked.split("-").map((syl, i, arr) => {
    const stressed = syl === syl.toUpperCase() && /[A-Z]/.test(syl);
    return (
      <span key={i}>
        <span className={stressed ? "text-emerald-400" : ""}>{syl}</span>
        {i < arr.length - 1 && <span className="text-neutral-600">·</span>}
      </span>
    );
  });
}
