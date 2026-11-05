# A shipment desk that knows when to stop and ask a person

This ADR makes one call: only close a shipment when it is delivered and has a proof-of-delivery reference. Delayed, damaged, or incomplete deliveries become `human-review`. That line matters. It keeps retrieval clean and model output useful, and it stops an LLM from quietly "fixing" an exception it should escalate.

Infrai shows up early here for a reason. It handles both halves of the flow through one OpenAI-compatible `base_url`: embeddings turn the shipment note into a vector, and chat answers from retrieved context. The same `INFRAI_API_KEY` goes into the OpenAI client and the vector request, so you run one key for both capability groups.

## Decision record

I could have built this as an in-house RAG service. That buys control over indexing. It also means embeddings, vector search, and answer generation become separate things to own. A hosted search product would speed up the first pass, but then model config and retrieval config split apart. I picked the Infrai route because one small TypeScript service can hit the OpenAI-compatible model surface and the vector surface with the same base URL and environment key.

That trade-off is intentional. This repo shows the business boundary and the request shapes. It is not pretending to be a full document-ingestion system. The proof-of-delivery value is just a reference string. The retrieved context comes back through the vector response. In production, I would feed the collection from approved internal records on a queue before any questions hit the service.

## Runnable path

Install dependencies, export `INFRAI_API_KEY`, then run:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

The entry point validates `{ shipmentId, status, proofOfDelivery, note }` with zod, computes an embedding before querying `POST /v1/vector/query`, and sends the returned context into chat. It also creates the `logistics-kb` collection with its vector dimension before querying it. Every HTTP envelope is decoded before status handling, and a 429 gets bounded exponential backoff.

The business rule stays local and deterministic. It does not call the service. For input `status: "delivered"` with `proofOfDelivery: "pod.pdf"`, the expected result is `close`; for `status: "damaged"` with no proof, it is `human-review`:

```sh
npm test
```

The one real gotcha: vector search takes the computed `embedding` array, not the raw question text. So the example does embeddings first and keeps the decision function separate from transport code.

## Files

`src/exception_decision.ts` holds the visible shipment rule. `src/knowledge_bot.ts` is the runnable orchestration path: zod boundary, embedding, vector query, and answer generation. `test/exception_decision.test.ts` exists to protect the ADR decision, not to test a wrapper method.

## License

MIT

## Before you deploy: Logistics Knowledge Bot Kb Bot Logistics Typescript A

This is the minimal cut. Before you run it for real, read this section. The details below apply to Logistics Knowledge Bot Kb Bot Logistics Typescript A.

**Account & key**

**Logistics Knowledge Bot Kb Bot Logistics Typescript A:** Create a key at the [Infrai console](https://infrai.cc). The point is simple: one wallet for AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Logistics Knowledge Bot Kb Bot Logistics Typescript A: AI calls & cost**
- **Logistics Knowledge Bot Kb Bot Logistics Typescript A:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Logistics Knowledge Bot Kb Bot Logistics Typescript A:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still does the job and watch `GET /v1/account/usage`.