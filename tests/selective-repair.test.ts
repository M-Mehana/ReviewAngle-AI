import { expect, it, vi } from "vitest";
import {
  selectiveRepair,
  type SelectionEvent,
} from "../src/lib/analysis/selective-repair";
const validate = (item: { id: string; valid: boolean }) =>
  item.valid ? [] : [{ code: "claim.unsupported", field: "copy" }];
it("reserves all first-pass items and repairs only failed items with minimal bounded escalation", async () => {
  const good = { id: "good", valid: true },
    bad = { id: "bad", valid: false };
  const events: SelectionEvent[] = [];
  const repair = vi.fn(async (item, reasons, accepted, tier) => {
    expect(accepted).toContain(good);
    expect(reasons[0].code).toBe("claim.unsupported");
    return { ...item, valid: tier === "FALLBACK" };
  });
  const result = await selectiveRepair({
    stage: "angles",
    candidates: [bad, good],
    validate,
    repair,
    fallback: true,
    events,
  });
  expect(result[0]).toBe(good);
  expect(repair.mock.calls.map((c) => c[3])).toEqual(["QUALITY", "FALLBACK"]);
  expect(repair.mock.calls.every((c) => c[0].id === "bad")).toBe(true);
  expect(result).toHaveLength(2);
});
it("does not call fallback when QUALITY repair passes, or call anything for initial passes", async () => {
  const repair = vi.fn(async (item, _reasons, _accepted, _tier) => ({
    ...item,
    valid: true,
  }));
  const events: SelectionEvent[] = [];
  await selectiveRepair({
    stage: "angles",
    candidates: [
      { id: "ok", valid: true },
      { id: "bad", valid: false },
    ],
    validate,
    repair,
    fallback: true,
    events,
  });
  expect(repair).toHaveBeenCalledTimes(1);
  expect(repair.mock.calls[0][3]).toBe("QUALITY");
});
it.each([false, true])(
  "omits failed final repair safely with fallback=%s",
  async (fallback) => {
    const repair = vi.fn(async (item) => item);
    const events: SelectionEvent[] = [];
    expect(
      await selectiveRepair({
        stage: "angles",
        candidates: [{ id: "bad", valid: false }],
        validate,
        repair,
        fallback,
        events,
      }),
    ).toEqual([]);
    expect(repair).toHaveBeenCalledTimes(fallback ? 2 : 1);
    expect(events.at(-1)?.dropped).toBe(true);
  },
);
it("does not loop after transport or schema failures", async () => {
  const repair = vi.fn(async () => {
    throw new Error("private diagnostic");
  });
  const events: SelectionEvent[] = [];
  expect(
    await selectiveRepair({
      stage: "followup",
      candidates: [{ id: "bad", valid: false }],
      validate,
      repair,
      fallback: true,
      events,
    }),
  ).toEqual([]);
  expect(repair).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(events)).not.toContain("private diagnostic");
});
