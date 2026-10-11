"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Activity, Apple, ArrowDownRight, ArrowRight, Bell, CalendarDays, Camera, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Droplets, FileText,
  Flame, GlassWater, LayoutDashboard, Leaf, Menu, Plus, Search, Settings, ShieldCheck,
  Target, TrendingUp, Upload, Utensils, Weight, X, Trash2, Pencil, Image as ImageIcon,
  History, LogOut, Dumbbell, Sparkles, CircleHelp
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar
} from "recharts";
import TrackerCalendar from "@/app/tracker-calendar";
import AuthPanel from "@/app/auth-panel";
import { proteinForQuantity } from "@/lib/daily-progress";
import { loadTrackerData, removeFood, saveFood, saveGoals, setPlannedMeal } from "@/lib/tracker-data";
import { createClient } from "@/lib/surpabase";

type Page = "Overview" | "My Diet Plan" | "Protein Tracker" | "Water Tracker" | "Meal History" | "Reminders" | "Settings";
type FoodLog = { id:string; name:string; grams:number; protein:number; meal:string; time:string; image?:string };
type WaterLog = { id:number; ml:number; time:string };
type Reminder = { id:number; label:string; time:string; type:"Meal"|"Water"; enabled:boolean };
const navItems: { label:Page; icon:typeof LayoutDashboard }[] = [
  {label:"Overview",icon:LayoutDashboard},{label:"My Diet Plan",icon:CalendarDays},
  {label:"Protein Tracker",icon:Apple},{label:"Water Tracker",icon:GlassWater},
  {label:"Meal History",icon:History},{label:"Reminders",icon:Bell},{label:"Settings",icon:Settings}
];
const plan = [
  {day:1,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"4 eggs, 3 bread slices, 1 banana, milk",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"Curd 200 g, fruit, peanuts 20 g",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, chicken 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"2 bread slices, 2 eggs, 1 banana",status:"Planned"},
    {time:"7:30 PM",name:"Workout",foods:"Workout + creatine as directed",status:"Planned"},
    {time:"8:45 PM",name:"Post-workout",foods:"1 scoop whey, 1 banana",status:"Planned"},
    {time:"9:30 PM",name:"Dinner",foods:"Cooked rice 250 g, chicken 120 g, vegetables",status:"Planned"}
  ]},
  {day:2,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"Dry oats 80 g, milk, banana, 3 eggs",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"2 bananas, peanuts 25 g, curd",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, fish 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"Dry oats 60 g, milk, banana, 2 eggs",status:"Planned"},
    {time:"8:45 PM",name:"Post-workout",foods:"1 scoop whey, 1 banana",status:"Planned"},
    {time:"9:30 PM",name:"Dinner",foods:"Cooked rice 250 g, 3 eggs, vegetables",status:"Planned"}
  ]},
  {day:3,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"Dry oats 80 g, milk, banana, 3 eggs",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"Curd 200 g, banana, peanuts 20 g",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, chicken 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"3 bread slices, peanut butter, banana",status:"Planned"},
    {time:"8:45 PM",name:"Post-workout",foods:"1 scoop whey, 1 banana",status:"Planned"},
    {time:"9:30 PM",name:"Dinner",foods:"Cooked rice 250 g, fish 150 g, vegetables",status:"Planned"}
  ]},
  {day:4,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"4 eggs, 3 bread slices, fruit, milk",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"Milk, banana, peanuts 20–25 g",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, chicken 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"Dry oats 60 g, milk, banana",status:"Planned"},
    {time:"8:45 PM",name:"Post-workout",foods:"1 scoop whey, 1 banana",status:"Planned"},
    {time:"9:30 PM",name:"Dinner",foods:"Cooked rice 250 g, 4 eggs, vegetables, curd",status:"Planned"}
  ]},
  {day:5,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"4 eggs, bread, banana, milk",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"Curd, fruit, peanuts 20 g",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, fish 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"Bread, eggs, banana",status:"Planned"},
    {time:"8:45 PM",name:"Post-workout",foods:"1 scoop whey, 1 banana",status:"Planned"},
    {time:"9:30 PM",name:"Dinner",foods:"Cooked rice 250 g, chicken 120 g, vegetables",status:"Planned"}
  ]},
  {day:6,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"Dry oats 80 g, milk, banana, 3 eggs",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"Banana, milk, peanuts 20–25 g",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, chicken 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"Dry oats 60 g, milk, banana",status:"Planned"},
    {time:"8:45 PM",name:"Post-workout",foods:"1 scoop whey, 1 banana",status:"Planned"},
    {time:"9:30 PM",name:"Dinner",foods:"Cooked rice 250 g, fish or chicken 150 g, vegetables",status:"Planned"}
  ]},
  {day:7,meals:[
    {time:"7:30 AM",name:"Breakfast",foods:"Dry oats 80 g, milk, banana, 3 eggs",status:"Planned"},
    {time:"10:30 AM",name:"Morning snack",foods:"Curd 200 g, fruit, peanuts 20 g",status:"Planned"},
    {time:"1:30 PM",name:"Lunch",foods:"Cooked rice 300 g, chicken 150 g, vegetables, curd",status:"Planned"},
    {time:"5:30 PM",name:"Evening snack",foods:"2 bread slices, peanut butter, banana",status:"Planned"},
    {time:"8:30 PM",name:"Dinner",foods:"Cooked rice 250 g, fish or chicken 150 g, vegetables",status:"Planned"},
    {time:"9:45 PM",name:"Optional",foods:"Milk if hungry",status:"Optional"}
  ]}
];
const initialFood:FoodLog[]=[];
const fmt = (n:number) => n.toLocaleString("en-IN");
const localISODate = () => {
  const parts = new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  return `${parts.find(part=>part.type==="year")?.value}-${parts.find(part=>part.type==="month")?.value}-${parts.find(part=>part.type==="day")?.value}`;
};
function Card({children,className=""}:{children:ReactNode;className?:string}) { return <section className={`card p-5 ${className}`}>{children}</section>; }
function Progress({value,color="green"}:{value:number;color?:string}) { return <div className="progress-track"><div className="progress-fill" style={{width:`${Math.min(100,Math.max(0,value))}%`,background:color==="blue"?"#2799d5":undefined}}/></div>; }
function Field({label,children}:{label:string;children:ReactNode}) { return <div><label className="label">{label}</label>{children}</div>; }
function Empty({title,detail}:{title:string;detail:string}) { return <div className="py-10 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><CircleHelp size={22}/></div><div className="font-bold">{title}</div><p className="mt-1 text-sm muted">{detail}</p></div>; }

export default function Home() {
  const [page,setPage]=useState<Page>("Overview");
  const [mobileOpen,setMobileOpen]=useState(false);
  const [day,setDay]=useState(()=>{const weekday=new Date().getDay();return weekday===0?7:weekday;});
  const [selectedDate,setSelectedDate]=useState(localISODate);
  const [proteinGoal,setProteinGoal]=useState(130);
  const [waterGoal,setWaterGoal]=useState(4000);
  const [foods,setFoods]=useState<FoodLog[]>(initialFood);
  const [waterLogs,setWaterLogs]=useState<WaterLog[]>([]);
  const [reminders,setReminders]=useState<Reminder[]>([]);
  const [completedMeals,setCompletedMeals]=useState<string[]>([]);
  const [foodName,setFoodName]=useState("");
  const [foodGrams,setFoodGrams]=useState("100");
  const [proteinPer100,setProteinPer100]=useState("20");
  const [mealType,setMealType]=useState("Lunch");
  const [foodTime,setFoodTime]=useState("1:30 PM");
  const [photo,setPhoto]=useState<string|undefined>();
  const [waterAmount,setWaterAmount]=useState(250);
  const [customWater,setCustomWater]=useState("");
  const [newReminderTime,setNewReminderTime]=useState("9:00 AM");
  const [newReminderLabel,setNewReminderLabel]=useState("Drink water");
  const [newReminderType,setNewReminderType]=useState<"Meal"|"Water">("Water");
  const [search,setSearch]=useState("");
  const [toast,setToast]=useState("");
  const [uploadedName,setUploadedName]=useState("");
  const [planReview,setPlanReview]=useState(false);
  const [profileName,setProfileName]=useState("Member");
  const [timezone,setTimezone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [trackerError,setTrackerError]=useState("");
  const [unavailableTrackerTables,setUnavailableTrackerTables]=useState<string[]>([]);
  const [unavailableTrackerFields,setUnavailableTrackerFields]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const [authReady,setAuthReady]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const [showAuthPanel,setShowAuthPanel]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const pdfRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const supabase=createClient();
    void supabase.auth.getSession().then(({data})=>{
      setAuthenticated(Boolean(data.session));
      setAuthReady(true);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setAuthenticated(Boolean(session));
      setAuthReady(true);
    });
    return ()=>subscription.unsubscribe();
  },[]);
  const proteinTotal=foods.reduce((sum,f)=>sum+f.protein,0);
  const waterTotal=waterLogs.reduce((sum,w)=>sum+w.ml,0);
  const waterPercent=waterGoal?waterTotal/waterGoal*100:0;
  const todayPlan=plan.find(p=>p.day===day) ?? plan[0];
  const filteredFoods=foods.filter(f=>(f.name+" "+f.meal).toLowerCase().includes(search.toLowerCase()));
  const weeklyProtein=useMemo(()=>[92,108,84,116,proteinTotal,72,95].map((v,i)=>({day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],protein:v})),[proteinTotal]);
  const showToast=(message:string)=>{setToast(message);};
  const changePage=(next:Page)=>{setPage(next);setMobileOpen(false);};
  const requireSignIn=()=>{
    setTrackerError("Sign in is required to load or change saved account data.");
    setShowAuthPanel(true);
  };
  const handlePhoto=(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/")){showToast("Please choose an image file.");return;}
    const reader=new FileReader();reader.onload=()=>setPhoto(String(reader.result));reader.readAsDataURL(file);
  };
  const refreshSelectedDay=useCallback(async()=>{
    const snapshot=await loadTrackerData(selectedDate,selectedDate);
    setUnavailableTrackerFields(snapshot.unavailableFields);
    setFoods(snapshot.foods.map(food=>({id:food.id,name:food.name,grams:Number(food.grams),protein:Number(food.protein),meal:food.meal_type,time:food.logged_at?new Intl.DateTimeFormat("en-US",{timeZone:snapshot.timezone,hour:"numeric",minute:"2-digit"}).format(new Date(food.logged_at)):"Time unavailable"})));
    setCompletedMeals(snapshot.meals.filter(meal=>meal.completed_on===selectedDate).map(meal=>`${selectedDate}-${meal.meal_name}`));
    setProteinGoal(snapshot.proteinTarget);
    setWaterGoal(snapshot.waterTarget);
    setTimezone(snapshot.timezone);
  },[selectedDate]);
  useEffect(()=>{
    if(!authenticated)return;
    void refreshSelectedDay().catch(error=>setTrackerError(error instanceof Error?error.message:"Could not load saved tracking data."));
  },[authenticated,refreshSelectedDay]);
  const addFood=async()=>{
    if(!authenticated){requireSignIn();return;}
    if(!foodName.trim()||!Number(foodGrams)||Number(foodGrams)<=0||Number(proteinPer100)<0){showToast("Enter a food name and valid quantity.");return;}
    const grams=Number(foodGrams),protein=proteinForQuantity(grams,Number(proteinPer100));
    setSaving(true);
    try{
      await saveFood({logged_on:selectedDate,name:foodName.trim(),grams,protein,meal_type:mealType},timezone);
                <Card><div className="section-title">Daily targets</div><p className="mt-1 text-xs muted">Adjust these values to your individual plan.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Protein goal (grams)"><input className="input" type="number" min="1" value={proteinGoal} onChange={e=>setProteinGoal(Math.max(1,Number(e.target.value)||1))}/></Field><Field label="Water goal (ml)"><input className="input" type="number" min="1" step="250" value={waterGoal} onChange={e=>setWaterGoal(Math.max(1,Number(e.target.value)||1))}/></Field></div><button className="btn btn-primary mt-5" onClick={()=>void saveGoals(proteinGoal,waterGoal).then(()=>{window.dispatchEvent(new Event("protrack:refresh"));showToast("Daily targets saved.");}).catch(error=>setTrackerError(error instanceof Error?error.message:"Could not save preferences."))}><Check size={14}/> Save preferences</button></Card>
      await refreshSelectedDay();
      window.dispatchEvent(new CustomEvent("protrack:refresh",{detail:selectedDate}));
      setFoodName("");setFoodGrams("100");setPhoto(undefined);showToast("Food saved to your log.");
    }catch(error){setTrackerError(error instanceof Error?error.message:"Could not save this food log.");}
    finally{setSaving(false);}
  };
  const addWater=(amount:number)=>{
    if(!Number.isFinite(amount)||amount<=0){showToast("Enter a valid water amount.");return;}
    setWaterLogs(old=>[{id:Date.now(),ml:amount,time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})},...old]);
    showToast(`${amount} ml added for this session only; it is not saved.`);
  };
  const addReminder=()=>{
    if(!newReminderTime.trim()||!newReminderLabel.trim()){showToast("Enter a reminder label and time.");return;}
    setReminders(old=>[...old,{id:Date.now(),label:newReminderLabel.trim(),time:newReminderTime.trim(),type:newReminderType,enabled:true}]);
    showToast("Reminder added to this preview.");
  };
  const toggleMeal=async(mealName:string)=>{
    if(!authenticated){requireSignIn();return;}
    if(unavailableTrackerTables.includes("planned_meal_completions")){
      setTrackerError("planned_meal_completions is not installed; meal completion was not saved.");
      return;
    }
    const key=`${selectedDate}-${mealName}`;
    const complete=!completedMeals.includes(key);
    setSaving(true);
    try{
      await setPlannedMeal(selectedDate,mealName,complete);
      await refreshSelectedDay();
      window.dispatchEvent(new CustomEvent("protrack:refresh",{detail:selectedDate}));
    }catch(error){setTrackerError(error instanceof Error?error.message:"Could not update the planned meal.");}
    finally{setSaving(false);}
  };
  const deleteFood=async(id:string)=>{
    if(!authenticated){requireSignIn();return;}
    try{await removeFood(id);await refreshSelectedDay();window.dispatchEvent(new CustomEvent("protrack:refresh",{detail:selectedDate}));}
    catch(error){setTrackerError(error instanceof Error?error.message:"Could not remove this food log.");}
  };
  const pageTitles:Record<Page,{subtitle:string}> = {
    "Overview":{subtitle:"Your nutrition, one day at a time."},"My Diet Plan":{subtitle:"Your personalized seven-day meal schedule."},
    "Protein Tracker":{subtitle:"Log what you eat and keep your protein goal in sight."},
    "Water Tracker":{subtitle:"Track hydration and choose your own reminder times."},
    "Meal History":{subtitle:"Review your food logs and daily progress."},"Reminders":{subtitle:"Manage your meal and water reminder preferences."},
    "Settings":{subtitle:"Manage your targets and personal preferences."}
  };
  const proteinPercent=Math.min(100,proteinTotal/proteinGoal*100);
  const completedCount=todayPlan.meals.filter(m=>completedMeals.includes(`${selectedDate}-${m.name}`)).length;
  const selectedDateLabel=new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:timezone});

  const sidebar=<aside className={`sidebar ${mobileOpen?"open":""}`}>
    <div className="brand"><div className="brand-mark"><Activity size={20}/></div><span>PROTRACK</span></div>
    <div className="nav-label">WORKSPACE</div>
    <nav className="flex-1">
      {navItems.map(item=>{const Icon=item.icon;return <button key={item.label} className={`nav-button ${page===item.label?"active":""}`} onClick={()=>changePage(item.label)}><Icon size={17}/><span>{item.label}</span>{item.label==="Reminders"&&<span className="ml-auto rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-200">{reminders.filter(r=>r.enabled).length}</span>}</button>;})}
    </nav>
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-white"><Sparkles size={15} className="text-emerald-300"/> Stay consistent</div>
      <p className="text-[11px] leading-5 text-slate-400">Small daily habits build long-term progress.</p>
    </div>
    <div className="sidebar-bottom flex items-center gap-3 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-800 text-xs font-bold text-white">M</div>
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-white">{profileName}</div><div className="text-[10px] text-slate-400">Signed-in account</div></div>
      <button className="text-slate-400 hover:text-white" title="Settings" onClick={()=>changePage("Settings")}><Settings size={16}/></button>
    </div>
  </aside>;

  if(!authReady)return <main className="grid min-h-screen place-items-center bg-[#f6f8f6] text-sm font-semibold text-gray-600">Loading your account...</main>;
  if(!authenticated&&showAuthPanel)return <AuthPanel onAuthenticated={()=>{setAuthenticated(true);setShowAuthPanel(false);}} onCancel={()=>setShowAuthPanel(false)}/>;

  const signOut=async()=>{
    const {error}=await createClient().auth.signOut();
    if(error)setTrackerError(error.message);
  };

  return <div className="app-shell">
    {mobileOpen&&<div className="overlay lg:hidden" onClick={()=>setMobileOpen(false)}/>}
    {sidebar}
    <div className="main-area">
      <header className="topbar">
        <div className="flex items-center gap-3">
          <button className="btn mobile-menu !p-2" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><Menu size={18}/></button>
          <div><div className="text-sm font-extrabold">{page}</div><div className="hidden text-[11px] muted sm:block">{pageTitles[page].subtitle}</div></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs muted md:block">{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
          <button className="relative rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50" aria-label="Notifications" onClick={()=>changePage("Reminders")}><Bell size={17}/>{reminders.some(r=>r.enabled)&&<span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500"/>}</button>
          <button className="flex items-center gap-2" onClick={()=>changePage("Settings")}><div className="grid h-8 w-8 place-items-center rounded-full bg-[#dcefe3] text-xs font-bold text-[#176746]">M</div><ChevronDown size={14} className="hidden text-gray-500 sm:block"/></button>
        </div>
      </header>
      <main className="page-content">
        {page==="Overview"&&<div className="space-y-6">
          {trackerError&&<div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Tracker request failed: {trackerError}</div>}
          {unavailableTrackerTables.length>0&&<div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Database tracking features unavailable until migration: {unavailableTrackerTables.join(", ")}. Food and goal reads use existing tables; unavailable records are not simulated.</div>}
          {unavailableTrackerFields.length>0&&<div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Current schema limitations: {unavailableTrackerFields.join("; ")}.</div>}
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow mb-2">YOUR DAILY OVERVIEW</div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Good morning, {profileName.split(" ")[0]} <span>✦</span></h1><p className="mt-2 text-sm muted">A little progress every day adds up.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Selected tracking date" className="input !w-auto" type="date" value={selectedDate} onChange={event=>{setSelectedDate(event.target.value);const weekday=new Date(`${event.target.value}T12:00:00`).getDay();setDay(weekday===0?7:weekday);}}/><button className="btn btn-primary" onClick={()=>changePage("Protein Tracker")}><Plus size={15}/> Log food</button></div></div>
          <div className="rounded-2xl bg-[#17221d] p-5 text-white sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-200"><ShieldCheck size={15}/> Today&apos;s consistency</div><h2 className="text-xl font-bold">You&apos;re building the habit.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-300">Track your meals, log your water, and use your personal plan as a guide.</p></div><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Meals checked off</div><div className="mt-1 text-2xl font-extrabold">{completedCount}<span className="text-sm font-medium text-slate-400"> / {todayPlan.meals.length}</span></div></div></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><div className="flex items-start justify-between"><div><div className="text-xs muted">Protein consumed</div><div className="mt-2 text-2xl font-extrabold">{proteinTotal.toFixed(0)} <span className="text-sm font-semibold muted">g</span></div></div><div className="stat-icon bg-emerald-50 text-emerald-700"><Apple size={18}/></div></div><div className="mt-4"><Progress value={proteinPercent}/><div className="mt-2 flex justify-between text-[11px] muted"><span>Goal {proteinGoal} g</span><span>{Math.max(0,proteinGoal-proteinTotal).toFixed(0)} g left</span></div></div></Card>
            <Card><div className="flex items-start justify-between"><div><div className="text-xs muted">Water consumed</div><div className="mt-2 text-2xl font-extrabold">{(waterTotal/1000).toFixed(2)} <span className="text-sm font-semibold muted">L</span></div></div><div className="stat-icon bg-sky-50 text-sky-700"><Droplets size={18}/></div></div><div className="mt-4"><Progress value={waterPercent} color="blue"/><div className="mt-2 flex justify-between text-[11px] muted"><span>Goal {(waterGoal/1000).toFixed(1)} L</span><span>{Math.max(0,waterGoal-waterTotal)} ml left</span></div></div></Card>
            <Card><div className="flex items-start justify-between"><div><div className="text-xs muted">Meals completed</div><div className="mt-2 text-2xl font-extrabold">{completedCount}<span className="text-sm font-semibold muted"> / {todayPlan.meals.length}</span></div></div><div className="stat-icon bg-amber-50 text-amber-700"><Utensils size={18}/></div></div><div className="mt-4"><Progress value={completedCount/todayPlan.meals.length*100}/><div className="mt-2 text-[11px] muted">Based on your selected plan day</div></div></Card>
            <Card><div className="flex items-start justify-between"><div><div className="text-xs muted">Daily plan</div><div className="mt-2 text-2xl font-extrabold">Day {day}<span className="text-sm font-semibold muted"> / 7</span></div></div><div className="stat-icon bg-violet-50 text-violet-700"><CalendarDays size={18}/></div></div><button className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700" onClick={()=>changePage("My Diet Plan")}>View diet plan <ArrowRight size={14}/></button></Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <Card><div className="mb-5 flex items-center justify-between"><div><div className="section-title">Protein consistency</div><p className="mt-1 text-xs muted">Illustrative weekly intake · grams</p></div><span className="pill pill-green"><TrendingUp size={12} className="mr-1"/> Weekly view</span></div><div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weeklyProtein} margin={{left:-20,right:8,top:10,bottom:0}}><defs><linearGradient id="proteinFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16845b" stopOpacity={.2}/><stop offset="95%" stopColor="#16845b" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf1ed" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize:11,fill:"#89938c"}}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:10,fill:"#89938c"}}/><Tooltip contentStyle={{borderRadius:10,border:"1px solid #e8ece8",fontSize:12}}/><Area type="monotone" dataKey="protein" name="Protein (g)" stroke="#16845b" strokeWidth={2.5} fill="url(#proteinFill)" activeDot={{r:5}}/></AreaChart></ResponsiveContainer></div></Card>
            <Card><div className="mb-4 flex items-center justify-between"><div><div className="section-title">Water check-ins</div><p className="mt-1 text-xs muted">Quickly log a drink</p></div><div className="stat-icon bg-sky-50 text-sky-700"><GlassWater size={18}/></div></div><div className="mb-5 flex items-end gap-2"><span className="text-3xl font-extrabold">{(waterTotal/1000).toFixed(2)} L</span><span className="mb-1 text-xs muted">of {(waterGoal/1000).toFixed(1)} L</span></div><Progress value={waterPercent} color="blue"/><div className="mt-4 grid grid-cols-3 gap-2">{[150,250,500].map(n=><button key={n} className="btn !px-2" onClick={()=>addWater(n)}><Plus size={13}/>{n} ml</button>)}</div><button className="btn mt-3 w-full" onClick={()=>changePage("Water Tracker")}>Open water tracker <ArrowRight size={14}/></button></Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <Card><div className="mb-4 flex items-center justify-between"><div><div className="section-title">Meal timeline · {selectedDateLabel}</div><p className="mt-1 text-xs muted">Day {day} · Tap to mark a meal complete</p></div><button className="btn !px-3 !py-2" onClick={()=>changePage("My Diet Plan")}>Full plan <ArrowRight size={13}/></button></div><div>{todayPlan.meals.slice(0,5).map((m,i)=>{const key=`${selectedDate}-${m.name}`,done=completedMeals.includes(key);return <div key={key} className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-0"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done?"bg-emerald-100 text-emerald-700":"bg-gray-100 text-gray-500"}`}>{done?<Check size={16}/>:i===4?<Dumbbell size={16}/>:<Utensils size={16}/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{m.name}</span><span className="text-[11px] muted">{m.time}</span></div><p className="mt-1 text-xs leading-5 muted">{m.foods}</p></div><button disabled={saving} className={`pill ${done?"pill-green":"pill-gray"}`} onClick={()=>void toggleMeal(m.name)}>{done?"Done":"Mark done"}</button></div>})}</div></Card>
            <Card><div className="mb-4 flex items-center justify-between"><div><div className="section-title">Recent food logs</div><p className="mt-1 text-xs muted">Latest entries on the selected date</p></div><button className="text-xs font-bold text-emerald-700" onClick={()=>changePage("Meal History")}>View all</button></div>{foods.slice(0,4).map(f=><div key={f.id} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Apple size={17}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{f.name}</div><div className="mt-1 text-[11px] muted">{f.grams} g · {f.meal}</div></div><div className="text-sm font-extrabold">{f.protein} g</div></div>)}<button className="btn mt-4 w-full" onClick={()=>changePage("Protein Tracker")}><Plus size={14}/> Add a food entry</button></Card>
          </div>
          <TrackerCalendar plan={plan} onUnavailableTables={setUnavailableTrackerTables}/>
          <div className="text-center text-[10px] muted">Food and completion records are saved to your account. Protein estimates use your manual nutrition entry.</div>
        </div>}

        {page==="My Diet Plan"&&<div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow mb-2">YOUR PERSONAL PLAN</div><h1 className="text-2xl font-extrabold">My diet plan</h1><p className="mt-2 text-sm muted">Review your meal schedule and mark meals as completed.</p></div><button className="btn btn-primary" onClick={()=>pdfRef.current?.click()}><Upload size={15}/> Upload diet PDF</button><input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){setUploadedName(f.name);setPlanReview(true);showToast("PDF selected. Extraction is not connected yet.");}}}/></div>
          <Card className="border-dashed !border-2"><div className="flex flex-col items-center py-4 text-center"><div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileText size={23}/></div><div className="font-bold">{uploadedName||"Upload your existing diet plan"}</div><p className="mt-2 max-w-md text-xs leading-5 muted">Select a PDF diet plan. In this UI preview, the file is selected locally but not yet parsed or stored.</p><button className="btn mt-4" onClick={()=>pdfRef.current?.click()}><Upload size={14}/> Choose PDF</button>{planReview&&<span className="mt-3 pill pill-yellow">Selected · Awaiting PDF integration</span>}</div></Card>
          <div className="grid gap-4 sm:grid-cols-3"><Card><div className="text-xs muted">Daily protein target</div><div className="mt-2 text-2xl font-extrabold">125–135 g</div><div className="mt-1 text-[11px] muted">Example from reference plan</div></Card><Card><div className="text-xs muted">Daily calorie target</div><div className="mt-2 text-2xl font-extrabold">2,700 kcal</div><div className="mt-1 text-[11px] muted">Approximate plan value</div></Card><Card><div className="text-xs muted">Schedule</div><div className="mt-2 text-2xl font-extrabold">7 days</div><div className="mt-1 text-[11px] muted">Includes a rest day</div></Card></div>
          <Card><div className="mb-5 flex items-center justify-between"><div><div className="section-title">Weekly schedule</div><p className="mt-1 text-xs muted">Choose a day to view the planned meals.</p></div><span className="pill pill-gray">Day {day} of 7</span></div><div className="flex gap-2 overflow-x-auto pb-2">{plan.map(p=><button key={p.day} className={`day-chip ${day===p.day?"active":""}`} onClick={()=>setDay(p.day)}>Day {p.day}{p.day===7?" · Rest":""}</button>)}</div><div className="mt-5">{todayPlan.meals.map((m,i)=>{const key=`${selectedDate}-${m.name}`,done=completedMeals.includes(key);return <div key={key} className="table-row"><div><div className="text-xs font-extrabold">{m.time}</div><div className="mt-1 text-[10px] muted">Meal {i+1}</div></div><div><div className="text-sm font-bold">{m.name}</div><div className="mt-1 text-xs leading-5 muted">{m.foods}</div></div><button disabled={saving} className={`pill ${done?"pill-green":"pill-gray"}`} onClick={()=>void toggleMeal(m.name)}>{done?"Completed":"Mark done"}</button></div>})}</div><div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 muted">Plan details shown here are based on the supplied example diet plan and illustrative entries. Actual uploaded PDFs require a real extraction workflow and user review.</div></Card>
        </div>}

        {page==="Protein Tracker"&&<div className="space-y-6">
          <div><div className="eyebrow mb-2">FOOD JOURNAL</div><h1 className="text-2xl font-extrabold">Protein tracker</h1><p className="mt-2 text-sm muted">Log food, confirm quantities and keep your daily total up to date.</p></div>
          <div className="grid gap-4 sm:grid-cols-3"><Card><div className="text-xs muted">Consumed</div><div className="mt-2 text-2xl font-extrabold">{proteinTotal.toFixed(1)} g</div><Progress value={proteinPercent}/></Card><Card><div className="text-xs muted">Daily target</div><div className="mt-2 text-2xl font-extrabold">{proteinGoal} g</div><button className="mt-2 text-xs font-bold text-emerald-700" onClick={()=>changePage("Settings")}>Edit target <ArrowRight size={12} className="inline"/></button></Card><Card><div className="text-xs muted">Remaining</div><div className="mt-2 text-2xl font-extrabold">{Math.max(0,proteinGoal-proteinTotal).toFixed(1)} g</div><div className="mt-2 text-xs muted">{proteinTotal>=proteinGoal?"Daily target reached in this demo.":"Based on logged entries"}</div></Card></div>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <Card><div className="mb-5"><div className="section-title">Log a food</div><p className="mt-1 text-xs muted">Photo analysis is a planned integration. Confirm food and quantity manually in this preview.</p></div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/>
              <button onClick={()=>fileRef.current?.click()} className="flex min-h-[160px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center hover:border-emerald-400">{photo?<img src={photo} alt="Selected food" className="max-h-48 rounded-lg object-contain"/>:<><div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><Camera size={23}/></div><div className="text-sm font-bold">Upload a food photo</div><div className="mt-1 text-xs muted">Choose an image from your device</div></>}</button>
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Food name"><input className="input" value={foodName} onChange={e=>setFoodName(e.target.value)} placeholder="e.g. cooked chicken"/></Field><Field label="Quantity eaten (grams)"><input className="input" type="number" min="1" value={foodGrams} onChange={e=>setFoodGrams(e.target.value)}/></Field><Field label="Protein per 100 g"><input className="input" type="number" min="0" step=".1" value={proteinPer100} onChange={e=>setProteinPer100(e.target.value)}/></Field><Field label="Meal type"><select className="input" value={mealType} onChange={e=>setMealType(e.target.value)}>{["Breakfast","Morning Snack","Lunch","Evening Snack","Dinner","Post-workout","Other"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Meal time (AM/PM)"><input className="input" value={foodTime} onChange={e=>setFoodTime(e.target.value)} placeholder="1:30 PM"/></Field><Field label="Estimated protein"><div className="input bg-gray-50 font-bold">{(Math.max(0,Number(foodGrams)||0)*Math.max(0,Number(proteinPer100)||0)/100).toFixed(1)} g</div></Field></div>
              <div className="mt-5 flex gap-2"><button className="btn btn-primary flex-1" onClick={addFood}><Plus size={15}/> Add to food log</button><button className="btn" onClick={()=>{setFoodName("");setPhoto(undefined);}}>Clear</button></div><p className="mt-3 text-[10px] leading-5 muted">The protein-per-100-g value is entered manually in this preview. Real AI identification and nutrition database lookup are not connected.</p>
            </Card>
            <Card><div className="mb-4 flex items-center justify-between"><div><div className="section-title">Food log · {selectedDateLabel}</div><p className="mt-1 text-xs muted">{foods.length} entries</p></div><Apple size={19} className="text-emerald-700"/></div>{foods.length===0?<Empty title="No food logged" detail="Save a food entry to see it in this daily log."/>:<div className="space-y-3">{foods.map(f=><div key={f.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-700"><Apple size={17}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{f.name}</div><div className="mt-1 text-[11px] muted">{f.grams} g · {f.meal} · {f.time}</div></div><div className="text-right"><div className="text-sm font-extrabold">{f.protein} g</div><button className="mt-1 text-[10px] text-red-500" onClick={()=>void deleteFood(f.id)}>Remove</button></div></div>)}</div>}</Card>
          </div>
        </div>}

        {page==="Water Tracker"&&<div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow mb-2">HYDRATION</div><h1 className="text-2xl font-extrabold">Water tracker</h1><p className="mt-2 text-sm muted">Choose your goal, log your drinks and set reminders at times that suit you.</p></div><button className="btn" onClick={()=>changePage("Reminders")}><Bell size={14}/> Manage reminders</button></div>
          <div className="grid gap-4 sm:grid-cols-3"><Card><div className="flex items-center gap-2 text-xs muted"><Droplets size={15}/> Consumed today</div><div className="mt-2 text-3xl font-extrabold">{(waterTotal/1000).toFixed(2)} <span className="text-sm muted">L</span></div><div className="mt-2 text-xs muted">{waterTotal} ml logged</div></Card><Card><div className="flex items-center gap-2 text-xs muted"><Target size={15}/> Daily goal</div><div className="mt-2 text-3xl font-extrabold">{(waterGoal/1000).toFixed(2)} <span className="text-sm muted">L</span></div><button className="mt-2 text-xs font-bold text-emerald-700" onClick={()=>changePage("Settings")}>Edit goal</button></Card><Card><div className="flex items-center gap-2 text-xs muted"><TrendingUp size={15}/> Remaining</div><div className="mt-2 text-3xl font-extrabold">{(Math.max(0,waterGoal-waterTotal)/1000).toFixed(2)} <span className="text-sm muted">L</span></div><div className="mt-2 text-xs muted">{Math.round(waterPercent)}% of target</div></Card></div>
          <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><Card><div className="section-title">Log water</div><p className="mt-1 text-xs muted">Water entries are session-only and are not saved to the database yet.</p><div className="mt-5 grid grid-cols-3 gap-2">{[150,250,500].map(n=><button key={n} className={`btn !px-2 ${waterAmount===n?"!border-emerald-500 !bg-emerald-50 !text-emerald-800":""}`} onClick={()=>setWaterAmount(n)}>{n} ml</button>)}</div><div className="mt-4"><Field label="Custom amount (ml)"><input className="input" type="number" min="1" value={customWater} onChange={e=>setCustomWater(e.target.value)} placeholder="Enter a custom amount"/></Field></div><button className="btn btn-primary mt-4 w-full" onClick={()=>{addWater(customWater.trim()?Number(customWater):waterAmount);setCustomWater("");}}> <Plus size={15}/> Log water</button><div className="mt-5 rounded-xl bg-sky-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-sky-900"><GlassWater size={17}/> Today&apos;s session progress</div><div className="mt-3"><Progress value={waterPercent} color="blue"/></div><div className="mt-2 flex justify-between text-xs text-sky-800"><span>{(waterTotal/1000).toFixed(2)} L in this session</span><span>{Math.round(waterPercent)}%</span></div></div></Card>
            <Card><div className="mb-4 flex items-center justify-between"><div><div className="section-title">Water entries · this session</div><p className="mt-1 text-xs muted">These entries disappear when you leave or refresh.</p></div><span className="pill pill-gray">{waterLogs.length} entries</span></div>{waterLogs.length?waterLogs.map(w=><div key={w.id} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"><div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><Droplets size={17}/></div><div className="flex-1"><div className="text-sm font-bold">{w.ml} ml</div><div className="mt-1 text-[11px] muted">{w.time} · Not saved</div></div><button className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove water entry" onClick={()=>setWaterLogs(old=>old.filter(x=>x.id!==w.id))}><Trash2 size={15}/></button></div>):<Empty title="No water logged this session" detail="Water logging is not connected to saved database records yet."/>}</Card></div>
          <Card><div className="section-title">Your reminders</div><p className="mt-1 text-xs muted">These are your chosen times, not an automatically divided drinking schedule.</p><div className="mt-4 space-y-2">{reminders.filter(r=>r.type==="Water").map(r=><div key={r.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sky-700"><Bell size={16}/></div><div className="flex-1"><div className="text-sm font-bold">{r.label}</div><div className="text-xs muted">{r.time}</div></div><span className={`pill ${r.enabled?"pill-green":"pill-gray"}`}>{r.enabled?"Enabled":"Paused"}</span></div>)}</div><button className="btn mt-4" onClick={()=>changePage("Reminders")}>Edit water reminders <ArrowRight size={14}/></button></Card>
        </div>}

        {page==="Meal History"&&<div className="space-y-6">
          <div><div className="eyebrow mb-2">YOUR RECORDS</div><h1 className="text-2xl font-extrabold">Meal history</h1><p className="mt-2 text-sm muted">Search and review food entries recorded in this session.</p></div>
          <Card><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-gray-400"/><input className="input pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search food or meal type"/></div><span className="pill pill-gray self-start sm:self-center">{filteredFoods.length} results</span></div>{filteredFoods.length?<div className="mt-4">{filteredFoods.map(f=><div key={f.id} className="table-row"><div><div className="text-xs font-bold">{f.time}</div><div className="mt-1 text-[10px] muted">Today</div></div><div><div className="text-sm font-bold">{f.name}</div><div className="mt-1 text-xs muted">{f.grams} g · {f.meal}</div></div><div className="text-sm font-extrabold">{f.protein} g protein</div></div>)}</div>:<Empty title="No matching food entries" detail="Try another search term or add a food in Protein Tracker."/>}</Card>
          <div className="grid gap-5 md:grid-cols-2"><Card><div className="section-title">Daily protein</div><p className="mt-1 text-xs muted">Current session total</p><div className="mt-4 text-3xl font-extrabold">{proteinTotal.toFixed(1)} g</div><Progress value={proteinPercent}/><div className="mt-2 text-xs muted">Target: {proteinGoal} g</div></Card><Card><div className="section-title">Daily water</div><p className="mt-1 text-xs muted">Current session total</p><div className="mt-4 text-3xl font-extrabold">{(waterTotal/1000).toFixed(2)} L</div><Progress value={waterPercent} color="blue"/><div className="mt-2 text-xs muted">Target: {(waterGoal/1000).toFixed(1)} L</div></Card></div>
        </div>}

        {page==="Reminders"&&<div className="space-y-6">
          <div><div className="eyebrow mb-2">STAY ON TRACK</div><h1 className="text-2xl font-extrabold">Reminders</h1><p className="mt-2 text-sm muted">Manage meal and water reminder preferences in AM/PM format.</p></div>
          <Card><div className="section-title">Add a reminder</div><p className="mt-1 text-xs muted">Preview-only settings. Actual notifications are not sent yet.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Reminder name"><input className="input" value={newReminderLabel} onChange={e=>setNewReminderLabel(e.target.value)} placeholder="e.g. Drink water"/></Field><Field label="Time (AM/PM)"><input className="input" value={newReminderTime} onChange={e=>setNewReminderTime(e.target.value)} placeholder="9:00 AM"/></Field><Field label="Reminder type"><select className="input" value={newReminderType} onChange={e=>setNewReminderType(e.target.value as "Meal"|"Water")}><option value="Water">Water</option><option value="Meal">Meal</option></select></Field><div className="flex items-end"><button className="btn btn-primary w-full" onClick={addReminder}><Plus size={14}/> Add reminder</button></div></div></Card>
          <Card><div className="mb-4 flex items-center justify-between"><div><div className="section-title">Your reminders</div><p className="mt-1 text-xs muted">Turn individual reminders on or off.</p></div><span className="pill pill-green">{reminders.filter(r=>r.enabled).length} active</span></div>{reminders.map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-4 last:border-0"><div className={`grid h-10 w-10 place-items-center rounded-xl ${r.type==="Water"?"bg-sky-50 text-sky-700":"bg-emerald-50 text-emerald-700"}`}>{r.type==="Water"?<Droplets size={18}/>:<Utensils size={18}/>}</div><div className="min-w-0 flex-1"><div className="text-sm font-bold">{r.label}</div><div className="mt-1 text-xs muted">{r.time} · {r.type}</div></div><button className={`pill ${r.enabled?"pill-green":"pill-gray"}`} onClick={()=>setReminders(old=>old.map(x=>x.id===r.id?{...x,enabled:!x.enabled}:x))}>{r.enabled?"Enabled":"Paused"}</button><button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Delete reminder" onClick={()=>setReminders(old=>old.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></div>)}</Card>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Reminder delivery isn&apos;t connected.</strong> This UI preview can manage settings in temporary state, but real notifications require a backend scheduler and an appropriate browser or mobile notification mechanism.</div>
        </div>}

        {page==="Settings"&&<div className="space-y-6">
          <div><div className="eyebrow mb-2">PREFERENCES</div><h1 className="text-2xl font-extrabold">Settings</h1><p className="mt-2 text-sm muted">Update your profile, goals and display preferences.</p></div>
          <Card><div className="section-title">Profile</div><p className="mt-1 text-xs muted">Account data is scoped to your signed-in user.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className="input" value={profileName} onChange={e=>setProfileName(e.target.value)}/></Field><Field label="Timezone"><select className="input" value={timezone} onChange={e=>setTimezone(e.target.value)}><option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option><option value="Asia/Dubai">Gulf Standard Time</option><option value="Europe/London">United Kingdom</option><option value="America/New_York">Eastern Time</option></select></Field></div><button className="btn mt-5" onClick={()=>void signOut()}><LogOut size={15}/> Sign out</button></Card>
          <Card><div className="section-title">Daily targets</div><p className="mt-1 text-xs muted">Adjust these values to your individual plan.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Protein goal (grams)"><input className="input" type="number" min="1" value={proteinGoal} onChange={e=>setProteinGoal(Math.max(1,Number(e.target.value)||1))}/></Field><Field label="Water goal (ml)"><input className="input" type="number" min="1" step="250" value={waterGoal} onChange={e=>setWaterGoal(Math.max(1,Number(e.target.value)||1))}/></Field></div><button className="btn btn-primary mt-5" onClick={()=>{if(!authenticated){requireSignIn();return;}void saveGoals(proteinGoal,waterGoal).then(()=>{window.dispatchEvent(new Event("protrack:refresh"));showToast("Daily targets saved.");}).catch(error=>setTrackerError(error instanceof Error?error.message:"Could not save preferences."));}}><Check size={14}/> Save preferences</button></Card>
          <Card><div className="section-title">Display and notifications</div><div className="mt-4 flex items-center justify-between gap-4 border-b border-gray-100 py-3"><div><div className="text-sm font-bold">12-hour time format</div><div className="mt-1 text-xs muted">Show times like 7:30 AM and 8:45 PM.</div></div><span className="pill pill-green">AM / PM</span></div><div className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-bold">Scheduled notifications</div><div className="mt-1 text-xs muted">Connect a notification service to enable delivery.</div></div><span className="pill pill-yellow">Not connected</span></div></Card>
        </div>}
        {toast&&<div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-[#17221d] px-4 py-3 text-sm font-semibold text-white shadow-xl"><CheckCircle2 size={17} className="text-emerald-300"/><span>{toast}</span><button className="ml-2 text-slate-300" onClick={()=>setToast("")} aria-label="Dismiss"><X size={15}/></button></div>}
      </main>
    </div>
  </div>;
}