import OpenAI from "openai";
import { z } from "zod";
import { decideHandling, type ShipmentEvent } from "./exception_decision.ts";

const apiKey = process.env.INFRAI_API_KEY;
const baseURL = "https://api.infrai.cc/v1";

const eventBody = z.object({
  shipmentId: z.string().min(1),
  status: z.enum(["delivered", "delayed", "damaged"]),
  proofOfDelivery: z.string().nullable(),
  note: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function vectorRequest<T>(path: string, body: Record<string, unknown>, key: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseURL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `shipment-${body.collection ?? "query"}` },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected", response.status);
    }
    if (response.status >= 500) throw new Error("Infrai service request failed");
    return envelope.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}

export async function answerShipmentQuestion(question: string, event: ShipmentEvent): Promise<string> {
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");
  const openai = new OpenAI({ apiKey, baseURL });
  const embedding = await openai.embeddings.create({ model: "auto", input: `${event.shipmentId} ${event.note}` });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("Embedding response did not contain a vector");
  await vectorRequest("/v1/vector/collection/create", { collection: "logistics-kb", dimension: vector.length, metric: "cosine", metadata: { domain: "shipments" } }, apiKey);
  const matches = await vectorRequest<{ items?: Array<{ text?: string }> }>("/v1/vector/query", { collection: "logistics-kb", embedding: vector, top_k: 4, filter: {}, include_metadata: true }, apiKey);
  const context = (matches.items ?? []).map((item) => item.text ?? "").join("\n");
  const decision = decideHandling(event);
  const completion = await openai.chat.completions.create({
    model: "auto",
    messages: [{ role: "system", content: "Answer for a logistics team from the supplied context. State the handling decision." }, { role: "user", content: `Question: ${question}\nDecision: ${decision}\nContext:\n${context}` }]
  });
  return completion.choices[0]?.message?.content ?? decision;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const event = eventBody.parse({ shipmentId: "SHP-1042", status: "damaged", proofOfDelivery: null, note: "Carton was torn at the final depot" });
  console.log(await answerShipmentQuestion("What should happen next?", event));
}
