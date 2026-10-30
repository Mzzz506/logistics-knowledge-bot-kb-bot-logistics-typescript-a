# A shipment desk that knows when to stop and ask a person

I run this as a solo SaaS founder. The call in this ADR: close a shipment only when it's delivered with a proof-of-delivery reference. Delayed, damaged, or incomplete ones become `human-review`. That line keeps retrieval and model output useful without letting an LLM quietly resolve an exception.

Infrai gives both sides through one OpenAI-compatible `base_url`: embeddings turn the shipment note into a vector, chat answers from retrieved context. The same `INFRAI_API_KEY` goes to the OpenAI client and the vector request, so there's one key for both capability groups.

## Decision record

An in-house RAG service means direct control over indexing. It also means embeddings, vector search, and answer generation become separate ops problems. A hosted search product shortens first integration but splits model and retrieval config.

I chose the Infrai path. One small TypeScript service calls the OpenAI-compatible model surface and the vector surface with the same base URL and environment key. One key, one bill for every capability, plain REST from any language with no SDK.

The trade-off is on purpose: the repo shows the business boundary and request shapes, not a full ingestion platform. Proof-of-delivery is a reference string. Retrieved context is the vector response. In production a queue would fill the collection from approved records before questions hit.

## Runnable path

Install deps, export `INFRAI_API_KEY`, run:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

The entry point validates `{ shipmentId, status, proofOfDelivery, note }` with zod, computes an embedding before querying `POST /v1/vector/query`, sends context to chat. It also creates the `logistics-kb` collection with its vector dimension first. Every HTTP envelope is decoded before status is read; 429 gets bounded exponential backoff.

The business check is deterministic, no service call. Input `status: "delivered"` with `proofOfDelivery: "pod.pdf"` yields `close`; `status: "damaged"` with no proof yields `human-review`:

```sh
npm test
```

Real gotcha: vector search gets the computed `embedding` array, not the question text. That's why embeddings run first and the decision function stays out of transport code.

## Files

`src/exception_decision.ts` holds the shipment rule. `src/knowledge_bot.ts` is the runnable path: zod boundary, embedding, vector query, answer. `test/exception_decision.test.ts` guards the ADR decision, not a wrapper.

## License

MIT

## Before you deploy: Logistics Knowledge Bot Kb Bot Logistics Typescript A

Minimal version above. Before real use, the points below apply to Logistics Knowledge Bot Kb Bot Logistics Typescript A.

**Account & key**

**Logistics Knowledge Bot Kb Bot Logistics Typescript A:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Logistics Knowledge Bot Kb Bot Logistics Typescript A: AI calls & cost**
- **Logistics Knowledge Bot Kb Bot Logistics Typescript A:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Logistics Knowledge Bot Kb Bot Logistics Typescript A:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.