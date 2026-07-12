import type { Card, Rep } from "../types";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// Learning steps for new / relearning cards. A card must pass through all
// steps smoothly before it enters review — combined with the Voice Gate this
// forces several spoken reps early on.
const LEARNING_STEPS_MS = [10 * MIN, 60 * MIN];

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

// A card whose lifetime stumble ratio exceeds this never graduates and its
// interval is capped, so it keeps resurfacing.
export const STUMBLE_RATIO_CEILING = 0.3;
const CAPPED_INTERVAL_DAYS = 3;

// Interval at which a gate-passing card counts as "learned".
const LEARNED_INTERVAL_DAYS = 7;

export function stumbleRatio(reps: Rep[]): number {
  if (reps.length === 0) return 0;
  return reps.filter((r) => !r.smooth).length / reps.length;
}

/**
 * The Voice Gate: a card can only be considered learned if it has at least 3
 * recorded spoken reps and the last 2 were marked smooth. There is no other
 * path — this is computed from rep history, never set directly.
 */
export function voiceGatePassed(reps: Rep[]): boolean {
  if (reps.length < 3) return false;
  const sorted = [...reps].sort((a, b) => a.created_at - b.created_at);
  return sorted.slice(-2).every((r) => r.smooth);
}

/**
 * Compute the card's next scheduling state after a rep.
 * `allReps` must include the rep just recorded.
 */
export function schedule(
  card: Card,
  smooth: boolean,
  allReps: Rep[],
  now: number = Date.now(),
): Pick<Card, "ease" | "interval" | "step" | "due_at" | "state"> {
  const ratio = stumbleRatio(allReps);
  const overRatio = ratio > STUMBLE_RATIO_CEILING;

  if (!smooth) {
    // Stumble: drop back to relearning, pull the card way forward.
    return {
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      interval: 0,
      step: 0,
      due_at: now + LEARNING_STEPS_MS[0],
      state: "learning",
    };
  }

  // Smooth rep inside the learning steps.
  if (card.state === "new" || card.state === "learning") {
    const nextStep = card.step + 1;
    if (nextStep < LEARNING_STEPS_MS.length) {
      return {
        ease: card.ease,
        interval: 0,
        step: nextStep,
        due_at: now + LEARNING_STEPS_MS[nextStep],
        state: "learning",
      };
    }
    // Graduate from learning steps into review.
    return {
      ease: card.ease,
      interval: 1,
      step: 0,
      due_at: now + DAY,
      state: "review",
    };
  }

  // Smooth rep in review: SM-2-style growth.
  const ease = Math.min(MAX_EASE, card.ease + 0.05);
  let interval = Math.max(1, Math.round(Math.max(1, card.interval) * ease));
  if (overRatio) interval = Math.min(interval, CAPPED_INTERVAL_DAYS);

  const learned =
    !overRatio && interval >= LEARNED_INTERVAL_DAYS && voiceGatePassed(allReps);

  return {
    ease,
    interval,
    step: 0,
    due_at: now + interval * DAY,
    state: learned ? "learned" : "review",
  };
}
