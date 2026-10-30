import assert from "node:assert/strict";
import test from "node:test";
import { decideHandling } from "../src/exception_decision.ts";

test("a delivered shipment with proof closes, while a damaged shipment goes to human review", () => {
  assert.equal(decideHandling({ shipmentId: "SHP-1", status: "delivered", proofOfDelivery: "pod.pdf", note: "signed" }), "close");
  assert.equal(decideHandling({ shipmentId: "SHP-2", status: "damaged", proofOfDelivery: null, note: "torn carton" }), "human-review");
});
