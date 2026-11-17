import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const CHAT_EFFORT = (process.env.CLAUDE_CHAT_EFFORT ?? "medium") as Effort;
const ANALYSIS_EFFORT = (process.env.CLAUDE_ANALYSIS_EFFORT ?? "medium") as Effort;
// The canvas re-scores after every intake turn, so it trades depth for speed.
export const ASSESS_EFFORT = (process.env.CLAUDE_ASSESS_EFFORT ?? "low") as Effort;

// Server-side refusal fallback: if the model declines on policy grounds, the API
// re-runs the request on Anthropic's recommended fallback model inside the same call.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

let client: Anthropic | null = null;
export function claude() {
  client ??= new Anthropic();
  return client;
}

export function hasCredentials() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export class ClaudeRefusalError extends Error {}

export type SystemBlock = { text: string; cache?: boolean };

function systemBlocks(blocks: SystemBlock[]): Anthropic.Beta.BetaTextBlockParam[] {
  return blocks
    .filter((b) => b.text.trim())
    .map((b) => ({
      type: "text" as const,
      text: b.text,
      ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
    }));
}

/** Streams assistant text; resolves `done` with the full text once complete. */
export function streamChat(opts: {
  system: SystemBlock[];
  messages: Anthropic.Beta.BetaMessageParam[];
  effort?: Effort;
}) {
  const stream = claude().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    ...FALLBACK,
    output_config: { effort: opts.effort ?? CHAT_EFFORT },
    system: systemBlocks(opts.system),
    messages: opts.messages,
  });
  return stream;
}

/** One structured call, validated against a Zod schema. */
export async function generateObject<S extends z.ZodType>(opts: {
  schema: S;
  system: SystemBlock[];
  prompt: string;
  effort?: Effort;
}): Promise<z.infer<S>> {
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: opts.effort ?? ANALYSIS_EFFORT, format: betaZodOutputFormat(opts.schema) },
    system: systemBlocks(opts.system),
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (res.stop_reason === "refusal") {
    throw new ClaudeRefusalError(res.stop_details?.explanation ?? "The model declined this request.");
  }
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason: ${res.stop_reason}).`);
  return res.parsed_output as z.infer<S>;
}

/** Image -> text description at upload time, so documents stay text-only downstream. */
export async function describeImage(base64: string, mediaType: string, filename: string) {
  const res = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/png", data: base64 },
          },
          {
            type: "text",
            text: `This image ("${filename}") was attached to an AI use-case proposal. Transcribe any text verbatim, then describe diagrams, architecture, process flows or charts in enough detail to assess the proposal. Plain text, no preamble.`,
          },
        ],
      },
    ],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export function friendlyError(err: unknown): string {
  if (err instanceof ClaudeRefusalError) return err.message;
  if (err instanceof Anthropic.AuthenticationError)
    return "Claude rejected the API key. Check ANTHROPIC_API_KEY in .env.local.";
  if (err instanceof Anthropic.RateLimitError) return "Claude is rate-limited right now. Try again in a moment.";
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status}): ${err.message}`;
  if (err instanceof Error && /credentials|api key|apiKey/i.test(err.message))
    return "No Claude credentials found. Add ANTHROPIC_API_KEY to .env.local and restart the server.";
  return err instanceof Error ? err.message : "Unexpected error";
}
