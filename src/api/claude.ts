import type { GeneratedCardSet } from "../types";

// Requests go to the Vite dev-server proxy (see vite.config.ts), which
// injects the API key server-side. The key never reaches the browser.
const ENDPOINT = "/api/anthropic/v1/messages";
const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a spoken-English coach for one specific learner:
- Advanced ESL speaker, Chinese L1, works in US commercial bank risk management (credit risk, model risk, loss forecasting, data quality, AI adoption).
- Reads and writes at a native level. Vocabulary is stored visually, with no reliable sound attached. Never learned phonics. Gives every syllable equal weight (syllable-timed L1 habit), so multisyllabic words come out choppy.
- His job with this app: convert words he already understands into words he can SAY out loud, fluently.

The user logs a "gap": a moment where he stalled on or avoided a word/phrase while speaking. The input may be English, Chinese, or mixed.

Your job: return 2-3 target expressions a native professional in his field would actually say in that situation.

Rules:
- Prioritize multi-word chunks and collocations over fancy single words (e.g. "I'd push back on that assumption", "that doesn't quite hold up", "we're not comparing apples to apples").
- For each expression, identify the hard words: words likely to trip THIS speaker (multisyllabic, unpredictable stress, vowel reduction, spelling-sound mismatch). Function words and easy words are not hard words. 1-4 hard words per expression; if an expression is genuinely all easy words, return an empty hard_words array.
- For each hard word:
  - syllables: hyphen-split, e.g. "as-sump-tion"
  - stress_marked: same split with the stressed syllable in CAPS, e.g. "as-SUMP-tion"
  - ipa: American English IPA, e.g. "/əˈsʌmpʃən/"
  - reduced_syllables: the syllables that reduce to schwa and should be swallowed, not fully pronounced, e.g. ["as", "tion"]. Empty array if none.
  - phonics_note: ONE short line on the spelling-to-sound rule at play, so he slowly builds a grapheme-phoneme decoder (e.g. "-tion is always /ʃən/, never 'tie-on'").
- example_sentence: ONE sentence using the expression in HIS domain (commercial banking risk, credit, model risk, loss forecasting, data quality, AI adoption). Not a generic ESL textbook sentence.
- why_i_avoided: one line guessing the mechanism (unknown stress? never heard it aloud? too long? L1 interference?).`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    target_expressions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          expression: { type: "string" },
          hard_words: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                syllables: { type: "string" },
                stress_marked: { type: "string" },
                ipa: { type: "string" },
                reduced_syllables: {
                  type: "array",
                  items: { type: "string" },
                },
                phonics_note: { type: "string" },
              },
              required: [
                "word",
                "syllables",
                "stress_marked",
                "ipa",
                "reduced_syllables",
                "phonics_note",
              ],
              additionalProperties: false,
            },
          },
          example_sentence: { type: "string" },
          why_i_avoided: { type: "string" },
        },
        required: [
          "expression",
          "hard_words",
          "example_sentence",
          "why_i_avoided",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["target_expressions"],
  additionalProperties: false,
} as const;

/** Strip markdown fences and any preamble, then parse. */
function parseDefensively(text: string): GeneratedCardSet {
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) cleaned = fenced[1].trim();
  // If there is still preamble, cut to the first '{' and last '}'.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first > 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  const parsed = JSON.parse(cleaned) as GeneratedCardSet;
  if (!Array.isArray(parsed.target_expressions)) {
    throw new Error("Response missing target_expressions array");
  }
  return parsed;
}

const APP_TOKEN_KEY = "gap-trainer-app-token";

/**
 * When deployed (Vercel), the serverless proxy can require a shared access
 * code (APP_TOKEN env var) so strangers can't spend your API credits. We
 * prompt once and remember it in localStorage. Not used in local dev.
 */
function getAppToken(): string | null {
  return localStorage.getItem(APP_TOKEN_KEY);
}

function askForAppToken(): string | null {
  const entered = window.prompt(
    "Enter the access code for this app (the APP_TOKEN you set on the server):",
  );
  if (entered && entered.trim()) {
    localStorage.setItem(APP_TOKEN_KEY, entered.trim());
    return entered.trim();
  }
  return null;
}

export async function generateCards(
  gapText: string,
): Promise<GeneratedCardSet> {
  return requestCards(gapText, true);
}

async function requestCards(
  gapText: string,
  allowTokenPrompt: boolean,
): Promise<GeneratedCardSet> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const appToken = getAppToken();
  if (appToken) headers["x-app-token"] = appToken;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Here is the gap I logged today:\n\n${gapText}\n\nReturn JSON only — no preamble, no markdown fences.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    let errType = "";
    try {
      const err = await res.json();
      detail = err?.error?.message ?? "";
      errType = err?.error?.type ?? "";
    } catch {
      /* ignore */
    }
    if (errType === "app_auth") {
      // Deployed proxy wants the shared access code — ask once and retry.
      if (allowTokenPrompt && askForAppToken()) {
        return requestCards(gapText, false);
      }
      localStorage.removeItem(APP_TOKEN_KEY);
      throw new Error(
        "Wrong or missing access code. It must match the APP_TOKEN set on the server.",
      );
    }
    if (res.status === 401) {
      throw new Error(
        "Authentication failed. Is ANTHROPIC_API_KEY set? (local: .env + restart `npm run dev`; deployed: Vercel env vars)",
      );
    }
    throw new Error(`Claude API error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined this request. Try rephrasing the gap.");
  }
  const textBlock = (data.content as { type: string; text?: string }[]).find(
    (b) => b.type === "text",
  );
  if (!textBlock?.text) {
    throw new Error("Empty response from Claude");
  }
  return parseDefensively(textBlock.text);
}
