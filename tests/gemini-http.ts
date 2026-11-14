import { mock, spyOn } from 'bun:test';
import { z } from 'zod';

// The real @google/genai SDK runs; only its HTTP calls are faked, so request serialization,
// error types, and response parsing are the library's own, not a hand-written guess at them.

export interface SentRequest {
  url: string;
  headers: Record<string, string>;
  body: GenerateContentBody;
}

const GenerateContentBodySchema = z.object({
  contents: z.array(
    z.object({ role: z.string(), parts: z.array(z.record(z.string(), z.unknown())) })
  ),
  systemInstruction: z.object({ parts: z.array(z.object({ text: z.string() })) }),
  generationConfig: z.record(z.string(), z.unknown()),
});
export type GenerateContentBody = z.infer<typeof GenerateContentBodySchema>;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A generateContent reply; `null` finishReason sends no candidate. */
export const geminiReply = (
  text: string | undefined,
  finishReason: string | null = 'STOP',
  blockReason?: string
): Response =>
  json(200, {
    candidates:
      finishReason === null
        ? []
        : [
            {
              content: { role: 'model', parts: text === undefined ? [] : [{ text }] },
              finishReason,
            },
          ],
    ...(blockReason === undefined ? {} : { promptFeedback: { blockReason } }),
  });

export const geminiStatus = (status: number): Response =>
  json(status, { error: { code: status, message: `status ${status}`, status: 'ERROR' } });

/** Fakes every Gemini HTTP call; `respond` decides each reply, `sent` records each request. */
export const fakeGeminiHttp = () => {
  const sent: SentRequest[] = [];
  const respond = mock<(req: SentRequest) => Response | Promise<Response>>(() => geminiReply('[]'));
  const fake = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request =
      input instanceof Request ? new Request(input, init) : new Request(String(input), init);
    const req: SentRequest = {
      url: request.url,
      headers: Object.fromEntries(request.headers),
      body: GenerateContentBodySchema.parse(await request.json()),
    };
    sent.push(req);
    return respond(req);
  };
  const spy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(fake, { preconnect: globalThis.fetch.preconnect })
  );
  return { sent, respond, restore: () => spy.mockRestore() };
};
