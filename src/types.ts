export type CardState = "new" | "learning" | "review" | "learned";

// `id` fields are auto-incremented by Dexie; EntityTable makes them optional
// on insert.
export interface Gap {
  id: number;
  raw_text: string;
  created_at: number;
}

export interface Card {
  id: number;
  gap_id: number;
  expression: string;
  example_sentence: string;
  why_i_avoided: string;
  ease: number; // SM-2 ease factor, starts at 2.5
  interval: number; // days (0 while in learning steps)
  step: number; // index into learning steps while state is new/learning
  due_at: number; // epoch ms
  state: CardState;
  created_at: number;
}

export interface HardWord {
  id: number;
  card_id: number;
  word: string;
  syllables: string;
  stress_marked: string;
  ipa: string;
  reduced_syllables: string[];
  phonics_note: string;
}

export interface Rep {
  id: number;
  card_id: number;
  audio_blob: Blob;
  mime_type: string;
  smooth: boolean;
  created_at: number;
}

// Shape returned by the Claude API for one gap.
export interface GeneratedExpression {
  expression: string;
  hard_words: {
    word: string;
    syllables: string;
    stress_marked: string;
    ipa: string;
    reduced_syllables: string[];
    phonics_note: string;
  }[];
  example_sentence: string;
  why_i_avoided: string;
}

export interface GeneratedCardSet {
  target_expressions: GeneratedExpression[];
}
