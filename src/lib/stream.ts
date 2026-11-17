import "server-only";
import { friendlyError, type streamChat } from "./claude";

/** Marker the client looks for to show an error inline instead of as reply text. */
export const STREAM_ERROR = "\u0000ERROR:";

/**
 * Pipes a Claude message stream to the browser as plain text and calls
 * `onComplete` with the full reply (for persistence) when it finishes.
 */
export function textStreamResponse(
  start: () => ReturnType<typeof streamChat>,
  onComplete: (text: string) => void,
) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = start();
        stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode(`${STREAM_ERROR}The model declined to answer this one. Try rephrasing.`));
        } else {
          const text = final.content.map((b) => (b.type === "text" ? b.text : "")).join("");
          if (text.trim()) onComplete(text);
        }
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode(`${STREAM_ERROR}${friendlyError(err)}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
