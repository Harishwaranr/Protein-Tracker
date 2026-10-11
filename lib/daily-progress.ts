export type DailyStatus = "Completed" | "Partial" | "Missed" | "In progress" | "Upcoming" | "Unavailable";

export type DailyProgressInput = {
  date: string;
  today: string;
  proteinTotal: number;
  proteinTarget: number;
  completedMeals: number;
  plannedMeals: number;
};

export type DailyRecord = {
  date: string;
  status: DailyStatus;
};

export function proteinForQuantity(grams: number, proteinPer100g: number): number {
  return Number((grams * proteinPer100g / 100).toFixed(1));
}

export function completionPercent(input: DailyProgressInput): number {
  const mealProgress = input.plannedMeals > 0
    ? Math.min(1, input.completedMeals / input.plannedMeals)
    : 0;
  const proteinProgress = input.proteinTarget > 0
    ? Math.min(1, input.proteinTotal / input.proteinTarget)
    : 0;
  return Math.round((mealProgress + proteinProgress) * 50);
}

export function dailyStatus(input: DailyProgressInput): DailyStatus {
  if (input.date > input.today) return "Upcoming";

  const complete = input.plannedMeals > 0
    && input.completedMeals >= input.plannedMeals
    && input.proteinTotal >= input.proteinTarget;
  if (complete) return "Completed";
  if (input.completedMeals > 0 || input.proteinTotal > 0) return "Partial";
  if (input.date < input.today) return "Missed";
  return "In progress";
}

function previousDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}-${String(previous.getUTCDate()).padStart(2, "0")}`;
}

export function deriveStreaks(records: DailyRecord[], today: string): { current: number; longest: number } {
  const completed = new Set(records.filter(record => record.status === "Completed").map(record => record.date));
  const sortedDates = [...completed].sort();
  let longest = 0;
  let run = 0;
  let prior = "";

  for (const date of sortedDates) {
    run = prior && previousDate(date) === prior ? run + 1 : 1;
    longest = Math.max(longest, run);
    prior = date;
  }

  let cursor = completed.has(today) ? today : previousDate(today);
  let current = 0;
  while (completed.has(cursor)) {
    current += 1;
    cursor = previousDate(cursor);
  }

  return { current, longest };
}