-- RosterIQ — Row Level Security.
-- Model: the public demo is READ-ONLY through the anon key. All writes
-- require an authenticated manager (Supabase Auth) whose JWT carries
-- app_metadata.role = 'manager'. The service key is never used client-side.
-- Grants + RLS together: a publishable anon key is only safe because these
-- policies bound what it can do.

alter table pods enable row level security;
alter table employees enable row level security;
alter table brands enable row level security;
alter table processes enable row level security;
alter table brand_processes enable row level security;
alter table coverage_rules enable row level security;
alter table assignments enable row level security;
alter table employee_eligibility enable row level security;
alter table holidays enable row level security;
alter table leaves enable row level security;
alter table rosters enable row level security;
alter table roster_days enable row level security;
alter table roster_coverage enable row level security;
alter table issues enable row level security;

-- Read: anyone (the demo dataset is fictional).
create policy "public read" on pods for select using (true);
create policy "public read" on employees for select using (true);
create policy "public read" on brands for select using (true);
create policy "public read" on processes for select using (true);
create policy "public read" on brand_processes for select using (true);
create policy "public read" on coverage_rules for select using (true);
create policy "public read" on assignments for select using (true);
create policy "public read" on employee_eligibility for select using (true);
create policy "public read" on holidays for select using (true);
create policy "public read" on leaves for select using (true);
create policy "public read" on rosters for select using (true);
create policy "public read" on roster_days for select using (true);
create policy "public read" on roster_coverage for select using (true);
create policy "public read" on issues for select using (true);

-- Write: authenticated managers only, on the eight tables below (employees,
-- brands, brand_processes, assignments, leaves, rosters, roster_days,
-- roster_coverage). The remaining tables (pods, processes, coverage_rules,
-- employee_eligibility, holidays, issues) have NO write policy: under RLS
-- that means API writes to them are denied for everyone, which is the
-- intended posture — reference data changes ship as migrations, and issues
-- are written only by the backend that owns validation.
create policy "manager write" on employees
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on brands
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on brand_processes
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on assignments
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on leaves
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on rosters
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on roster_days
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
create policy "manager write" on roster_coverage
  for all
  using (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  with check (auth.role() = 'authenticated' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
