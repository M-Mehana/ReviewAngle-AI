import type { Rejection } from "./guardrails";
export type SelectionEvent = {
  stage: string;
  candidate: number;
  attempt: "initial" | "QUALITY" | "FALLBACK";
  passed: boolean;
  reasons: string[];
  dropped?: boolean;
};
export async function selectiveRepair<T>(options: {
  stage: string;
  candidates: T[];
  validate: (candidate: T, accepted: T[]) => Rejection[];
  repair: (
    candidate: T,
    reasons: Rejection[],
    accepted: T[],
    tier: "QUALITY" | "FALLBACK",
  ) => Promise<T>;
  fallback: boolean;
  events: SelectionEvent[];
}) {
  const accepted: T[] = [],
    pending: { item: T; index: number; reasons: Rejection[] }[] = [];
  // Reserve every initial pass BEFORE repairing failures; never regenerate a passing item.
  options.candidates.forEach((item, index) => {
    const reasons = options.validate(item, accepted);
    options.events.push({
      stage: options.stage,
      candidate: index,
      attempt: "initial",
      passed: !reasons.length,
      reasons: reasons.map((r) => r.code),
    });
    if (reasons.length) pending.push({ item, index, reasons });
    else accepted.push(item);
  });
  for (const pendingItem of pending) {
    let { item, reasons } = pendingItem;
    let passed = false;
    for (const tier of (options.fallback
      ? ["QUALITY", "FALLBACK"]
      : ["QUALITY"]) as ("QUALITY" | "FALLBACK")[]) {
      try {
        item = await options.repair(item, reasons, accepted, tier);
        reasons = options.validate(item, accepted);
      } catch {
        reasons = [{ code: "repair.invalid-response", field: "response" }];
      }
      passed = !reasons.length;
      const final = tier === "FALLBACK" || !options.fallback;
      options.events.push({
        stage: options.stage,
        candidate: pendingItem.index,
        attempt: tier,
        passed,
        reasons: reasons.map((r) => r.code),
        dropped: !passed && final,
      });
      if (passed) {
        accepted.push(item);
        break;
      }
    }
  }
  return accepted;
}
