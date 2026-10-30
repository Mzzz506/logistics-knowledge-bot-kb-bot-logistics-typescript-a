export type ShipmentEvent = {
  shipmentId: string;
  status: "delivered" | "delayed" | "damaged";
  proofOfDelivery: string | null;
  note: string;
};

export type HandlingDecision = "close" | "human-review";

export function decideHandling(event: ShipmentEvent): HandlingDecision {
  if (event.status === "delivered" && event.proofOfDelivery) return "close";
  return "human-review";
}
