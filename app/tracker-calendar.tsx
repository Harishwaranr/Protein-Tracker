"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Plus, X } from "lucide-react";
import {
  completionPercent,
  dailyStatus,
  deriveStreaks,
  type DailyStatus
} from "@/lib/daily-progress";
import {
  dismissStreakBreak,
  finishChallenge,
  loadTrackerData,
  saveDailyRecords,
  startChallenge,
  type Challenge,
  type FoodLog,
  type MealCompletion,
  type PersistedDailyRecord
} from "@/lib/tracker-data";

type PlanDay = { day: number; meals: { name: string; status: string }[] };
type Props = { plan: PlanDay[]; enabled: boolean; onUnavailableTables?: (tables: string[]) => void };
type DayDetail = {
  date: string;
  foods: FoodLog[];
  meals: MealCompletion[];
  proteinTotal: number;
  target: number;
  plannedMeals: number;
  completedMeals: number;
  percent: number;
  status: DailyStatus;
};

function localDate(timezone: string, value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date: string, offset: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + offset));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function dateLabel(date: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function planForDate(date: string, plan: PlanDay[]): PlanDay {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return plan.find(item => item.day === (weekday === 0 ? 7 : weekday)) ?? plan[0];
}

function isPlannedMeal(meal: PlanDay["meals"][number]): boolean {
  return meal.status !== "Optional" && meal.name !== "Workout";
}

const statusStyle: Record<DailyStatus, string> = {
  Completed: "bg-emerald-600 text-white",
  Partial: "bg-amber-300 text-amber-950",
  Missed: "bg-rose-200 text-rose-900",
  "In progress": "bg-white text-gray-500",
  Upcoming: "bg-gray-100 text-gray-400",
  Unavailable: "bg-gray-200 text-gray-500"
};

export default function TrackerCalendar({ plan, enabled, onUnavailableTables }: Props) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [meals, setMeals] = useState<MealCompletion[]>([]);
  const [dailyRecords, setDailyRecords] = useState<PersistedDailyRecord[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [dismissedBreaks, setDismissedBreaks] = useState<string[]>([]);
  const [target, setTarget] = useState(130);
  const [timezone, setTimezone] = useState("UTC");
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unavailableTables, setUnavailableTables] = useState<string[]>([]);
  const [challengeDays, setChallengeDays] = useState(30);
  const [restartPrompt, setRestartPrompt] = useState<Challenge | null>(null);
  const handledChallenges = useRef(new Set<string>());

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const from = `${monthKey}-01`;
  const through = `${monthKey}-${String(new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const today = localDate(timezone);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnavailableTables(["Sign in required"]);
      onUnavailableTables?.(["Sign in required"]);
      setFoods([]);
      setMeals([]);
      setDailyRecords([]);
      setChallenges([]);
      setDismissedBreaks([]);
      return;
    }
    try {
      setError("");
      const snapshot = await loadTrackerData(from, through);
      setUnavailableTables(snapshot.unavailableTables);
      onUnavailableTables?.(snapshot.unavailableTables);
      setFoods(snapshot.foods);
      setMeals(snapshot.meals);
      setDailyRecords(snapshot.dailyRecords);
      setChallenges(snapshot.challenges);
      setDismissedBreaks(snapshot.dismissedBreaks);
      setTarget(snapshot.proteinTarget);
      setTimezone(snapshot.timezone);

      if (snapshot.unavailableTables.includes("planned_meal_completions")
        || snapshot.unavailableTables.includes("daily_completion_records")) {
        setDetail(null);
        return;
      }

      const todayAtTimezone = localDate(snapshot.timezone);
      const recordDates = new Set(snapshot.dailyRecords.map(record => record.recorded_on));
      const generated: Omit<PersistedDailyRecord, "user_id" | "updated_at">[] = [];
      const [year, monthNumber] = from.split("-").map(Number);
      const dayCount = new Date(year, monthNumber, 0).getDate();

      for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
        const date = `${from.slice(0, 7)}-${String(dayNumber).padStart(2, "0")}`;
        if (date > todayAtTimezone) continue;
        const dailyFoods = snapshot.foods.filter(food => food.logged_on === date);
        const dailyMeals = snapshot.meals.filter(meal => meal.completed_on === date);
        const plannedMeals = planForDate(date, plan).meals.filter(meal => meal.status !== "Optional");
        const proteinTotal = dailyFoods.reduce((sum, food) => sum + Number(food.protein), 0);
        const completedMeals = dailyMeals.filter(completion => plannedMeals.some(meal => meal.name === completion.meal_name)).length;
        const input = { date, today: todayAtTimezone, proteinTotal, proteinTarget: snapshot.proteinTarget, completedMeals, plannedMeals: plannedMeals.length };
        const status = dailyStatus(input);
        generated.push({
          recorded_on: date,
          status,
          protein_total: proteinTotal,
          protein_target: snapshot.proteinTarget,
          meals_completed: completedMeals,
          planned_meals: plannedMeals.length,
          completion_percent: completionPercent(input)
        });
      }

      if (generated.some(record => !recordDates.has(record.recorded_on)
        || snapshot.dailyRecords.find(saved => saved.recorded_on === record.recorded_on)?.status !== record.status
        || snapshot.dailyRecords.find(saved => saved.recorded_on === record.recorded_on)?.protein_total !== record.protein_total
        || snapshot.dailyRecords.find(saved => saved.recorded_on === record.recorded_on)?.meals_completed !== record.meals_completed)) {
        await saveDailyRecords(generated);
      }
      const reloaded = await loadTrackerData(from, through);
      setFoods(reloaded.foods);
      setMeals(reloaded.meals);
      setDailyRecords(reloaded.dailyRecords);
      setChallenges(reloaded.challenges);
      setDismissedBreaks(reloaded.dismissedBreaks);
      setTarget(reloaded.proteinTarget);
      setTimezone(reloaded.timezone);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your tracking records.");
    }
  }, [enabled, from, through, onUnavailableTables, plan]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: Event) => {
      const selectedDate = (event as CustomEvent<string>).detail;
      if (selectedDate) {
        const [year, monthNumber] = selectedDate.split("-").map(Number);
        setMonth(new Date(year, monthNumber - 1, 1));
      }
      void refresh();
    };
    window.addEventListener("protrack:refresh", handler);
    return () => window.removeEventListener("protrack:refresh", handler);
  }, [enabled, refresh]);

  const records = useMemo(() => {
    const byDate = new Map(dailyRecords.map(record => [record.recorded_on, record]));
    return byDate;
  }, [dailyRecords]);
  const streak = useMemo(() => deriveStreaks(dailyRecords.map(record => ({
    date: record.recorded_on,
    status: record.status as DailyStatus
  })), today), [dailyRecords, today]);
  const currentStreak = streak.current;
  const activeChallenge = challenges.find(challenge => !challenge.ended_on) ?? null;
  const challengeUnavailable = unavailableTables.includes("challenge_records");
  const undismissedBreak = challenges.find(challenge => challenge.end_reason === "streak_broken"
    && challenge.ended_on
    && !dismissedBreaks.includes(`${challenge.id}:${challenge.ended_on}`)) ?? null;
  const activeChallengeProgress = activeChallenge
    ? dailyRecords.filter(record => record.recorded_on >= activeChallenge.started_on
      && record.recorded_on <= today && record.status === "Completed").length
    : 0;

  useEffect(() => {
    if (!enabled) return;
    if (undismissedBreak) {
      setRestartPrompt(undismissedBreak);
      return;
    }
    if (challengeUnavailable || !activeChallenge || currentStreak > 0 || today <= activeChallenge.started_on) return;
    const yesterday = shiftDate(today, -1);
    const yesterdayRecord = records.get(yesterday);
    const eventKey = `${activeChallenge.id}:${yesterday}`;
    if (!yesterdayRecord || yesterdayRecord.status === "Completed" || dismissedBreaks.includes(eventKey) || handledChallenges.current.has(eventKey)) return;
    handledChallenges.current.add(eventKey);
    setRestartPrompt(activeChallenge);
    void finishChallenge(activeChallenge.id, yesterday, "streak_broken").then(refresh).catch(reason => {
      setError(reason instanceof Error ? reason.message : "Could not save the challenge break.");
    });
  }, [activeChallenge, challengeUnavailable, currentStreak, dismissedBreaks, enabled, records, refresh, today, undismissedBreak]);

  useEffect(() => {
    if (!enabled) return;
    if (!activeChallenge || activeChallengeProgress < activeChallenge.target_days) return;
    const eventKey = `completed:${activeChallenge.id}`;
    if (handledChallenges.current.has(eventKey)) return;
    handledChallenges.current.add(eventKey);
    void finishChallenge(activeChallenge.id, today, "completed").then(refresh).catch(reason => {
      setError(reason instanceof Error ? reason.message : "Could not save challenge completion.");
    });
  }, [activeChallenge, activeChallengeProgress, enabled, refresh, today]);

  const beginChallenge = async (targetDays = challengeDays) => {
    if (!enabled || challengeUnavailable) return;
    setBusy(true);
    try {
      await startChallenge(today, targetDays);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the challenge.");
    } finally {
      setBusy(false);
    }
  };

  const restartChallenge = async () => {
    if (!enabled || !restartPrompt || challengeUnavailable) return;
    setBusy(true);
    try {
      const brokenOn = restartPrompt.ended_on ?? shiftDate(today, -1);
      await dismissStreakBreak(restartPrompt.id, brokenOn);
      await startChallenge(today, restartPrompt.target_days);
      setRestartPrompt(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restart the challenge.");
    } finally {
      setBusy(false);
    }
  };

  const dismissBreak = async () => {
    if (!enabled || !restartPrompt || unavailableTables.includes("challenge_dismissals")) return;
    const brokenOn = shiftDate(today, -1);
    try {
      await dismissStreakBreak(restartPrompt.id, brokenOn);
      setDismissedBreaks(previous => [...previous, `${restartPrompt.id}:${brokenOn}`]);
      setRestartPrompt(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not dismiss the streak reminder.");
    }
  };

  const days = useMemo(() => {
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  }, [month]);

  const openDay = (date: string) => {
    if (!enabled) return;
    const dailyFoods = foods.filter(food => food.logged_on === date);
    const dailyMeals = meals.filter(meal => meal.completed_on === date);
    const planned = planForDate(date, plan).meals.filter(isPlannedMeal);
    const proteinTotal = dailyFoods.reduce((sum, food) => sum + Number(food.protein), 0);
    const completedMeals = dailyMeals.filter(completion => planned.some(meal => meal.name === completion.meal_name)).length;
    const input = { date, today, proteinTotal, proteinTarget: target, completedMeals, plannedMeals: planned.length };
    setDetail({ date, foods: dailyFoods, meals: dailyMeals, proteinTotal, target, plannedMeals: planned.length,
      completedMeals, percent: completionPercent(input), status: unavailableTables.includes("planned_meal_completions") || unavailableTables.includes("daily_completion_records") ? "Unavailable" : dailyStatus(input) });
  };

  const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month);
  const isEmpty = foods.length === 0 && meals.length === 0;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="eyebrow mb-2">DAILY RECORDS</div>
        <h2 className="text-xl font-extrabold">Consistency calendar</h2>
        <p className="mt-1 text-sm muted">Day status combines every planned meal with your protein target.</p>
      </div>
      <div className="flex gap-5 text-right">
        <div><div className="text-[10px] uppercase text-gray-500">Current streak</div><div className="mt-1 flex items-center justify-end gap-1 text-xl font-extrabold"><Flame size={17} className="text-orange-500"/>{enabled ? streak.current : "—"}</div></div>
        <div><div className="text-[10px] uppercase text-gray-500">Longest streak</div><div className="mt-1 text-xl font-extrabold">{enabled ? streak.longest : "—"}</div></div>
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5" aria-label="Daily completion calendar">
        <div className="mb-4 flex items-center justify-between">
          <button className="rounded-lg p-2 hover:bg-gray-100" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17}/></button>
          <h3 className="font-extrabold">{monthTitle}</h3>
          <button className="rounded-lg p-2 hover:bg-gray-100" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17}/></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-gray-500">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} className="pb-2">{day}</div>)}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, index) => {
            if (day === null) return <div key={`blank-${index}`} className="aspect-square"/>;
            const date = `${monthKey}-${String(day).padStart(2, "0")}`;
            const savedStatus = records.get(date)?.status as DailyStatus | undefined;
            const datePlan = planForDate(date, plan).meals.filter(isPlannedMeal);
            const dateFoods = foods.filter(food => food.logged_on === date);
            const dateMeals = meals.filter(meal => meal.completed_on === date);
            const protein = dateFoods.reduce((sum, food) => sum + Number(food.protein), 0);
            const completed = dateMeals.filter(item => datePlan.some(meal => meal.name === item.meal_name)).length;
            const status = !enabled || unavailableTables.includes("planned_meal_completions") || unavailableTables.includes("daily_completion_records")
              ? "Unavailable"
              : savedStatus ?? dailyStatus({ date, today, proteinTotal: protein, proteinTarget: target, completedMeals: completed, plannedMeals: datePlan.length });
            return <button key={date} disabled={!enabled} onClick={() => openDay(date)} aria-label={`${dateLabel(date, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}: ${status}`} className={`aspect-square min-w-0 rounded-lg border border-transparent text-sm font-bold transition hover:border-emerald-700 ${statusStyle[status]} ${date === today ? "ring-2 ring-emerald-700 ring-offset-1" : ""}`}>{day}</button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-[10px] font-semibold text-gray-600">{(["Completed", "Partial", "Missed", "In progress", "Upcoming", ...(unavailableTables.includes("planned_meal_completions") || unavailableTables.includes("daily_completion_records") ? ["Unavailable"] : [])] as DailyStatus[]).map(status => <span key={status} className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${statusStyle[status].split(" ")[0]}`}/>{status}</span>)}</div>
        {isEmpty && <p className="mt-3 text-xs text-gray-500">No records for this day until you save food or complete a planned meal.</p>}
      </section>

      {unavailableTables.length > 0 && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{enabled ? `Tracking storage is not installed for: ${unavailableTables.join(", ")}. These records are unavailable; no completion or challenge progress is being inferred or saved.` : "Sign in to load your saved calendar, streak, and challenge records."}</div>}

      <section className="rounded-xl bg-[#17221d] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-200"><CalendarDays size={15}/> Consistency challenge</div>
            {activeChallenge ? <><h3 className="mt-3 text-lg font-extrabold">{activeChallenge.target_days}-day challenge</h3><p className="mt-1 text-xs text-slate-300">Started {dateLabel(activeChallenge.started_on, timezone, { month: "short", day: "numeric", year: "numeric" })}</p></> : <><h3 className="mt-3 text-lg font-extrabold">Start a fresh challenge</h3><p className="mt-1 text-xs text-slate-300">Past challenges stay in your history.</p></>}
          </div><Flame className="text-orange-300" size={22}/>
        </div>
        {activeChallenge ? <><div className="mt-6 flex items-end justify-between"><div className="text-3xl font-extrabold">{activeChallengeProgress}<span className="text-sm font-semibold text-slate-400"> / {activeChallenge.target_days}</span></div><span className="text-xs text-emerald-200">completed days</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, activeChallengeProgress / activeChallenge.target_days * 100)}%` }}/></div><p className="mt-3 text-[11px] text-slate-300">Progress is derived from completed daily records.</p></> : <div className="mt-5 flex items-end gap-3"><label className="flex-1 text-[11px] font-semibold text-slate-300">Challenge length<select disabled={!enabled || challengeUnavailable} className="input mt-1 !border-white/20 !bg-[#26352c] !text-white" value={challengeDays} onChange={event => setChallengeDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label><button disabled={!enabled || busy || challengeUnavailable} className="btn btn-primary !border-emerald-400 !bg-emerald-600" onClick={() => void beginChallenge()}><Plus size={14}/> Start challenge</button></div>}
        {challenges.length > 0 && <div className="mt-5 border-t border-white/10 pt-4"><div className="text-[10px] font-bold uppercase text-slate-400">Challenge history</div><div className="mt-2 max-h-28 space-y-2 overflow-auto">{challenges.map(challenge => <div key={challenge.id} className="flex justify-between gap-2 text-[11px]"><span>{challenge.target_days} days · {challenge.started_on}</span><span className="text-slate-300">{challenge.ended_on ? challenge.end_reason?.replace("_", " ") : "Active"}</span></div>)}</div></div>}
      </section>
    </div>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

    {detail && <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setDetail(null); }}><section role="dialog" aria-modal="true" aria-labelledby="day-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><div className="eyebrow">DAILY HISTORY</div><h3 id="day-detail-title" className="mt-1 text-xl font-extrabold">{dateLabel(detail.date, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[detail.status]}`}>{detail.status}</span></div><button onClick={() => setDetail(null)} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close date details"><X size={18}/></button></div>
      {detail.foods.length === 0 && detail.meals.length === 0 && <p className="my-4 rounded-lg bg-gray-50 p-4 text-center text-sm font-semibold text-gray-600">No records for this day</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-emerald-50 p-3"><div className="text-[10px] uppercase text-emerald-800">Protein consumed</div><div className="mt-1 text-lg font-extrabold">{detail.proteinTotal.toFixed(1)} g</div></div><div className="rounded-lg bg-gray-50 p-3"><div className="text-[10px] uppercase text-gray-600">Daily target</div><div className="mt-1 text-lg font-extrabold">{detail.target} g</div></div><div className="rounded-lg bg-amber-50 p-3"><div className="text-[10px] uppercase text-amber-800">Protein remaining</div><div className="mt-1 text-lg font-extrabold">{Math.max(0, detail.target - detail.proteinTotal).toFixed(1)} g</div></div></div>
        <div className="mt-5 flex items-center justify-between gap-3"><h4 className="font-extrabold">Food logged</h4><span className="text-xs muted">{detail.foods.length} entries</span></div>
        {detail.foods.length ? <div className="mt-2 divide-y divide-gray-100">{detail.foods.map(food => <div key={food.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3"><div><div className="text-sm font-bold">{food.name}</div><div className="mt-1 text-xs muted">{food.grams} g · {food.meal_type} · {food.logged_at ? new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(food.logged_at)) : "Time unavailable"}</div></div><div className="text-sm font-extrabold">{Number(food.protein).toFixed(1)} g protein</div></div>)}</div> : <p className="py-3 text-xs muted">No food logged.</p>}
        {detail.status === "Unavailable" ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Planned-meal completion and daily completion percentage are unavailable until the tracking tables are installed.</p> : <>
          <div className="mt-4 flex items-center justify-between gap-3"><h4 className="font-extrabold">Planned meals</h4><span className="text-xs muted">{detail.completedMeals} done · {Math.max(0, detail.plannedMeals - detail.completedMeals)} remaining</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${detail.plannedMeals ? detail.completedMeals / detail.plannedMeals * 100 : 0}%` }}/></div>
          <div className="mt-4 flex items-center justify-between text-sm"><span className="font-semibold">Completion percentage</span><strong>{detail.percent}%</strong></div>
        </>}
    </section></div>}

    {restartPrompt && <div role="presentation" className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="streak-break-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-700"><Flame size={22}/></div><h3 id="streak-break-title" className="mt-4 text-lg font-extrabold">Your streak ended</h3><p className="mt-2 text-sm leading-6 text-gray-600">Your last challenge day was missed. Start a new challenge to begin a fresh streak, or dismiss this reminder.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button disabled={busy} className="btn" onClick={dismissBreak}>Dismiss</button><button disabled={busy} className="btn btn-primary" onClick={() => void restartChallenge()}>Restart challenge</button></div></section></div>}
  </section>;
}