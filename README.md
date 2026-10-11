# PROTRACK UI

Frontend MVP for an AI gym nutrition tracker. Food logs, planned meal completions, daily completion summaries, and challenge history are stored in Supabase.

## Run locally
1. Install Node.js (LTS).
2. In this folder run `npm install`
3. Run `npm run dev`
4. Open http://localhost:3000

## Important
PDF upload is a UI placeholder. Food protein is calculated from the manually entered protein-per-100g value. Water logs and reminder settings are temporary and are not persisted. No real notifications or AI services are connected yet.

## Daily tracking database setup
The live project schema was probed read-only on 2026-10-10. `public.food_logs` exists and has `user_id`, `food_name`, `quantity_grams`, `protein_grams`, `logged_at`, `created_at`, and `image_url`; it does not have `logged_on`, `meal_type`, `name`, `grams`, or `protein`. `user_settings`, `planned_meal_completions`, `daily_completion_records`, `challenge_records`, and `challenge_dismissals` returned PostgREST `PGRST205` (table not found). Auth settings show email enabled, signup allowed, and anonymous users disabled. The browser now uses email/password signup and sign-in.

The older `202610100001_daily_tracking.sql` draft has been renamed with a `.disabled` suffix because it assumes the wrong `food_logs` schema. Do not apply it. Before applying the additive draft `supabase/migrations/202610100002_tracker_support.sql`, inspect the actual table columns and RLS policies in the Supabase SQL editor:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
	and table_name in (
		'food_logs', 'user_settings', 'planned_meal_completions',
		'daily_completion_records', 'challenge_records', 'challenge_dismissals'
	)
order by table_name, ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
	and tablename in (
		'food_logs', 'user_settings', 'planned_meal_completions',
		'daily_completion_records', 'challenge_records', 'challenge_dismissals'
	)
order by tablename, policyname;
```

Do not apply the draft until the result confirms the `food_logs.user_id` type and existing policies. PostgreSQL permissive policies combine with OR; the draft deliberately aborts if any other permissive policy exists on these tables, so that policy can be reviewed before proceeding. The draft only adds `logged_on` and `meal_type`, backfills the new date from existing `logged_at` values, creates missing support tables, enables RLS, adds authenticated owner policies, and grants table operations to `authenticated`; it does not drop tables, delete food logs, or remove challenge history. No remote SQL has been applied by this implementation.

After reviewing those query results, apply the migration through the Supabase SQL editor, then restart Next.js and use email/password sign-in. Email confirmation is enabled on the live project, so signup may require confirming the email before signing in.

Daily status is derived using the browser's local timezone unless a saved user timezone is configured. A completed day requires all non-optional planned meals (excluding the workout activity) and the protein target. Past days with recorded but incomplete progress are Partial; past days with no progress are Missed.
