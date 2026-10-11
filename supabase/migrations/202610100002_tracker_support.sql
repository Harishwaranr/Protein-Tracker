-- PROPOSAL ONLY. Review live schema/policies and obtain approval before applying.
-- This migration touches only the four tracking tables and RPC reported missing.
-- It does not alter food_logs/user_goals, backfill rows, or change existing policies/grants.

begin;

do $$
begin
  if to_regclass('public.planned_meal_completions') is not null
    or to_regclass('public.daily_completion_records') is not null
    or to_regclass('public.challenge_records') is not null
    or to_regclass('public.challenge_dismissals') is not null then
    raise exception 'A proposed tracking table already exists; inspect it before applying this migration';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'protrack_start_challenge_v1'
  ) then
    raise exception 'protrack_start_challenge_v1 already exists; inspect its signature and definition before applying this migration';
  end if;
end $$;

create table public.planned_meal_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_on date not null,
  meal_name text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, completed_on, meal_name)
);

create table public.daily_completion_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  status text not null check (
    status in ('Completed', 'Partial', 'Missed', 'In progress', 'Upcoming')
  ),
  protein_total numeric not null default 0,
  protein_target numeric not null check (protein_target > 0),
  meals_completed integer not null default 0 check (meals_completed >= 0),
  planned_meals integer not null default 0 check (planned_meals >= 0),
  completion_percent numeric not null default 0
    check (completion_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create table public.challenge_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_on date not null,
  target_days integer not null check (target_days > 0),
  ended_on date,
  end_reason text check (
    end_reason in ('completed', 'restarted', 'streak_broken')
  ),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create index protrack_challenge_records_user_active_v1_idx
  on public.challenge_records (user_id, ended_on);

create unique index protrack_challenge_records_one_active_per_user_v1_uidx
  on public.challenge_records (user_id)
  where ended_on is null;

create table public.challenge_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null,
  broken_on date not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, challenge_id, broken_on),
  foreign key (user_id, challenge_id)
    references public.challenge_records(user_id, id)
);

alter table public.planned_meal_completions enable row level security;
alter table public.daily_completion_records enable row level security;
alter table public.challenge_records enable row level security;
alter table public.challenge_dismissals enable row level security;

create policy protrack_owner_planned_meal_completions_v1
  on public.planned_meal_completions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy protrack_owner_daily_completion_records_v1
  on public.daily_completion_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy protrack_owner_challenge_records_v1
  on public.challenge_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy protrack_owner_challenge_dismissals_v1
  on public.challenge_dismissals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.planned_meal_completions to authenticated;

grant select, insert, update, delete
  on public.daily_completion_records to authenticated;

grant select, insert, update, delete
  on public.challenge_records to authenticated;

grant select, insert, update, delete
  on public.challenge_dismissals to authenticated;

create function public.protrack_start_challenge_v1(
  p_started_on date,
  p_target_days integer
)
returns public.challenge_records
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  created_challenge public.challenge_records;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to start a challenge';
  end if;

  if p_started_on is null then
    raise exception 'Challenge started_on is required';
  end if;

  if p_target_days is null or p_target_days <= 0 then
    raise exception 'Challenge target_days must be greater than zero';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  update public.challenge_records
  set ended_on = p_started_on,
      end_reason = 'restarted'
  where user_id = v_user_id
    and ended_on is null;

  insert into public.challenge_records (
    user_id,
    started_on,
    target_days
  )
  values (
    v_user_id,
    p_started_on,
    p_target_days
  )
  returning * into created_challenge;

  return created_challenge;
end;
$function$;

revoke all
  on function public.protrack_start_challenge_v1(date, integer)
  from public, anon;

grant execute
  on function public.protrack_start_challenge_v1(date, integer)
  to authenticated;

commit;
