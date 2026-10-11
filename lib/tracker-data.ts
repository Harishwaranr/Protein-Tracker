import { createClient } from "@/lib/surpabase";

export type FoodLog = {
  id: string;
  logged_on: string;
  name: string;
  grams: number;
  protein: number;
  meal_type: string;
  logged_at: string | null;
};

export type MealCompletion = { completed_on: string; meal_name: string };
export type Challenge = {
  id: string;
  started_on: string;
  target_days: number;
  ended_on: string | null;
  end_reason: string | null;
};
export type PersistedDailyRecord = {
  user_id: string;
  recorded_on: string;
  status: string;
  protein_total: number;
  protein_target: number;
  meals_completed: number;
  planned_meals: number;
  completion_percent: number;
  updated_at: string;
};

export type TrackerSnapshot = {
  userId: string;
  foods: FoodLog[];
  meals: MealCompletion[];
  dailyRecords: PersistedDailyRecord[];
  challenges: Challenge[];
  dismissedBreaks: string[];
  proteinTarget: number;
  waterTarget: number;
  timezone: string;
  unavailableTables: string[];
  unavailableFields: string[];
};

type FoodInput = {
  logged_on: string;
  name: string;
  grams: number;
  protein: number;
  meal_type: string;
};

type QueryResult<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
  status: number;
};

function requestError(table: string, method: string, result: QueryResult<unknown>): Error {
  const code = result.error?.code ? ` ${result.error.code}` : "";
  return new Error(`${table} ${method} failed (HTTP ${result.status}${code}): ${result.error?.message ?? "Unknown Supabase error"}`);
}

function isMissingTable(result: QueryResult<unknown>): boolean {
  return result.status === 404 && result.error?.code === "PGRST205";
}

async function authenticatedClient() {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (user) return { supabase, userId: user.id };
  if (userError && !userError.message.toLowerCase().includes("session")) throw userError;
  throw new Error("Sign in to access your saved tracker data.");
}

function foodDate(loggedOn: string | null, loggedAt: string | null, timezone: string): string {
  if (loggedOn) return loggedOn;
  if (!loggedAt) return "";

  const timestampHasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(loggedAt);
  if (!timestampHasZone) return loggedAt.slice(0, 10);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(loggedAt));
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function loadTrackerData(from: string, through: string): Promise<TrackerSnapshot> {
  const { supabase, userId } = await authenticatedClient();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [foodResult, goalsResult, mealResult, dailyResult, challengeResult, dismissalResult] = await Promise.all([
    supabase.from("food_logs").select("id, user_id, food_name, quantity_grams, protein_grams, logged_at")
      .order("logged_at", { ascending: false }),
    supabase.from("user_goals").select("user_id, protein_goal_grams, water_goal_ml, updated_at")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("planned_meal_completions").select("completed_on, meal_name")
      .gte("completed_on", from).lte("completed_on", through),
    supabase.from("daily_completion_records").select("user_id, recorded_on, status, protein_total, protein_target, meals_completed, planned_meals, completion_percent, updated_at"),
    supabase.from("challenge_records").select("id, started_on, target_days, ended_on, end_reason").order("created_at", { ascending: false }),
    supabase.from("challenge_dismissals").select("challenge_id, broken_on")
  ]);
  if (foodResult.error) throw requestError("food_logs", "GET", foodResult);
  if (goalsResult.error) throw requestError("user_goals", "GET", goalsResult);

  const trackingResults = [
    ["planned_meal_completions", mealResult],
    ["daily_completion_records", dailyResult],
    ["challenge_records", challengeResult],
    ["challenge_dismissals", dismissalResult]
  ] as const;
  const unavailableTables = trackingResults
    .filter(([, result]) => isMissingTable(result))
    .map(([table]) => table);
  const otherTrackingError = trackingResults.find(([, result]) => result.error && !isMissingTable(result));
  if (otherTrackingError) {
    const [table, result] = otherTrackingError;
    throw requestError(table, "GET", result);
  }

  const proteinTarget = Number(goalsResult.data?.protein_goal_grams ?? 130);
  const waterTarget = Number(goalsResult.data?.water_goal_ml ?? 4000);

  const foods = (foodResult.data ?? []).map(food => ({
    ...food,
    id: String(food.id),
    name: food.food_name,
    grams: Number(food.quantity_grams),
    protein: Number(food.protein_grams),
    meal_type: "Not stored in current schema",
    logged_on: foodDate(null, food.logged_at, timezone)
  })).filter(food => food.logged_on >= from && food.logged_on <= through);

  return {
    userId,
    foods,
    meals: isMissingTable(mealResult) ? [] : mealResult.data ?? [],
    dailyRecords: isMissingTable(dailyResult) ? [] : dailyResult.data ?? [],
    challenges: isMissingTable(challengeResult) ? [] : challengeResult.data ?? [],
    dismissedBreaks: isMissingTable(dismissalResult) ? [] : (dismissalResult.data ?? []).map(row => `${row.challenge_id}:${row.broken_on}`),
    proteinTarget,
    waterTarget,
    timezone,
    unavailableTables,
    unavailableFields: [
      "food_logs.logged_on (historical date is derived from logged_at in memory)",
      "food_logs.meal_type (meal type is not persisted)",
      "user_goals.timezone (browser timezone is used)"
    ]
  };
}

export async function saveFood(input: FoodInput, timezone: string): Promise<void> {
  const { supabase, userId } = await authenticatedClient();
  const today = dateInTimezone(timezone);
  if (input.logged_on !== today) {
    throw new Error("This database schema can only timestamp food logs for today; backdated logs require the reviewed migration.");
  }
  const result = await supabase.from("food_logs").insert({
    user_id: userId,
    food_name: input.name,
    quantity_grams: input.grams,
    protein_grams: input.protein
  });
  if (result.error) throw requestError("food_logs", "INSERT", result);
}

export async function setPlannedMeal(date: string, mealName: string, complete: boolean): Promise<void> {
  const { supabase, userId } = await authenticatedClient();
  if (complete) {
    const result = await supabase.from("planned_meal_completions")
      .upsert({ user_id: userId, completed_on: date, meal_name: mealName }, { onConflict: "user_id,completed_on,meal_name" });
    if (result.error) throw requestError("planned_meal_completions", "UPSERT", result);
    return;
  }
  const result = await supabase.from("planned_meal_completions")
    .delete().eq("user_id", userId).eq("completed_on", date).eq("meal_name", mealName);
  if (result.error) throw requestError("planned_meal_completions", "DELETE", result);
}

export async function saveDailyRecords(records: Omit<PersistedDailyRecord, "user_id" | "updated_at">[]): Promise<void> {
  if (!records.length) return;
  const { supabase, userId } = await authenticatedClient();
  const rows = records.map(record => ({ ...record, user_id: userId, updated_at: new Date().toISOString() }));
  const result = await supabase.from("daily_completion_records")
    .upsert(rows, { onConflict: "user_id,recorded_on" });
  if (result.error) throw requestError("daily_completion_records", "UPSERT", result);
}

export async function saveGoals(proteinTarget: number, waterTarget: number): Promise<void> {
  const { supabase, userId } = await authenticatedClient();
  const result = await supabase.from("user_goals").upsert({
    user_id: userId,
    protein_goal_grams: proteinTarget,
    water_goal_ml: waterTarget,
  }, { onConflict: "user_id" });
  if (result.error) throw requestError("user_goals", "UPSERT", result);
}

export async function startChallenge(date: string, targetDays: number): Promise<void> {
  const { supabase } = await authenticatedClient();
  const result = await supabase.rpc("protrack_start_challenge_v1", {
    p_started_on: date,
    p_target_days: targetDays
  });
  if (result.error) throw requestError("protrack_start_challenge_v1 RPC", "POST", result);
}

export async function finishChallenge(id: string, date: string, reason: "completed" | "streak_broken"): Promise<void> {
  const { supabase, userId } = await authenticatedClient();
  const result = await supabase.from("challenge_records")
    .update({ ended_on: date, end_reason: reason }).eq("id", id).eq("user_id", userId);
  if (result.error) throw requestError("challenge_records", "UPDATE", result);
}

export async function dismissStreakBreak(challengeId: string, date: string): Promise<void> {
  const { supabase, userId } = await authenticatedClient();
  const result = await supabase.from("challenge_dismissals")
    .upsert({ user_id: userId, challenge_id: challengeId, broken_on: date }, { onConflict: "user_id,challenge_id,broken_on" });
  if (result.error) throw requestError("challenge_dismissals", "UPSERT", result);
}

export async function removeFood(id: string): Promise<void> {
  const { supabase, userId } = await authenticatedClient();
  const result = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", userId);
  if (result.error) throw requestError("food_logs", "DELETE", result);
}