import assert from "node:assert/strict";
import test from "node:test";
import { completionPercent, dailyStatus, deriveStreaks, proteinForQuantity } from "./daily-progress.ts";

test("a day completes only when all planned meals and the protein target are met", () => {
  const base = { date: "2026-10-10", today: "2026-10-10", proteinTotal: 130, proteinTarget: 130, completedMeals: 3, plannedMeals: 3 };
  assert.equal(dailyStatus(base), "Completed");
  assert.equal(dailyStatus({ ...base, completedMeals: 2 }), "Partial");
  assert.equal(dailyStatus({ ...base, proteinTotal: 129.9 }), "Partial");
});

test("empty dates stay in progress today, become missed after ending, and future dates stay upcoming", () => {
  const base = { proteinTotal: 0, proteinTarget: 130, completedMeals: 0, plannedMeals: 3 };
  assert.equal(dailyStatus({ ...base, date: "2026-10-10", today: "2026-10-10" }), "In progress");
  assert.equal(dailyStatus({ ...base, date: "2026-10-09", today: "2026-10-10" }), "Missed");
  assert.equal(dailyStatus({ ...base, date: "2026-10-11", today: "2026-10-10" }), "Upcoming");
});

test("a past day with recorded but incomplete progress remains partial", () => {
  assert.equal(dailyStatus({ date: "2026-10-09", today: "2026-10-10", proteinTotal: 20, proteinTarget: 130, completedMeals: 0, plannedMeals: 3 }), "Partial");
  assert.equal(dailyStatus({ date: "2026-10-09", today: "2026-10-10", proteinTotal: 0, proteinTarget: 130, completedMeals: 1, plannedMeals: 3 }), "Partial");
});

test("protein and completion percentages use quantity and both completion dimensions", () => {
  assert.equal(proteinForQuantity(150, 20), 30);
  assert.equal(completionPercent({ date: "2026-10-10", today: "2026-10-10", proteinTotal: 65, proteinTarget: 130, completedMeals: 2, plannedMeals: 4 }), 50);
  assert.equal(completionPercent({ date: "2026-10-10", today: "2026-10-10", proteinTotal: 130, proteinTarget: 130, completedMeals: 4, plannedMeals: 4 }), 100);
});

test("streaks derive from consecutive completed date records", () => {
  const records = [
    { date: "2026-10-01", status: "Completed" },
    { date: "2026-10-02", status: "Completed" },
    { date: "2026-10-03", status: "Completed" },
    { date: "2026-10-04", status: "Missed" },
    { date: "2026-10-05", status: "Completed" }
  ];
  assert.deepEqual(deriveStreaks([...records], "2026-10-05"), { current: 1, longest: 3 });
  assert.deepEqual(deriveStreaks([...records], "2026-10-06"), { current: 1, longest: 3 });
});