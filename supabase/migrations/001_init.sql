-- RosterIQ — initial schema (Supabase Postgres).
-- Design notes:
-- * A brand-process requirement is separate from an employee allocation.
--   Removing an employee never removes the client's coverage need.
-- * roster_days holds ONE attendance status per employee per date.
--   roster_coverage holds the MANY process allocations for that date.
-- * Coverage is counted by headcount; allocation % is a daily workload cap
--   (sum of an employee's roster_coverage % on a date must be <= 100), and a
--   coverage row counts toward min_staff only if it meets
--   coverage_rules.min_allocation_pct.
-- * Public demo uses the anon key with read-only grants + RLS (see 002_rls.sql
--   when manager mode lands). The service key is never shipped to the browser.

create table pods (
  id text primary key,
  name text not null,
  lead_employee_id text -- FK added after employees exists
);

create table employees (
  id text primary key,
  name text not null,
  pod_id text not null references pods (id),
  is_pod_lead boolean not null default false,
  weekly_off_pref int[] not null default '{}', -- 0=Sun .. 6=Sat, preference only
  max_consecutive_days int not null default 6 check (max_consecutive_days > 0)
);

alter table pods
  add constraint pods_lead_fk foreign key (lead_employee_id) references employees (id);

create table brands (
  id text primary key,
  name text not null unique, -- canonical names live here; seed/tests/UI copy from this
  pod_id text not null references pods (id)
);

create table processes (
  code text primary key check (code in ('CS', 'ACC', 'NDR', 'RET')),
  name text not null
);

create table brand_processes (
  id text primary key, -- '<brand_id>:<process_code>'
  brand_id text not null references brands (id),
  process_code text not null references processes (code),
  calendar_type text not null check (
    calendar_type in ('ALL_365', 'DAILY_EXCEPT_HOLIDAYS', 'SUN_AND_HOLIDAYS_OFF')
  ),
  unique (brand_id, process_code)
);

create table coverage_rules (
  brand_process_id text primary key references brand_processes (id),
  min_staff int not null check (min_staff >= 0),
  min_allocation_pct int not null default 20 check (min_allocation_pct between 1 and 100),
  overrides jsonb not null default '{}' -- { "2026-12-19": 2 } sale-day staffing
);

create table assignments (
  employee_id text not null references employees (id),
  brand_process_id text not null references brand_processes (id),
  role text not null check (role in ('primary', 'shared', 'backup')),
  allocation_pct int not null check (allocation_pct between 1 and 100),
  valid_from date,
  valid_to date,
  primary key (employee_id, brand_process_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table employee_eligibility (
  employee_id text not null references employees (id),
  brand_process_id text not null references brand_processes (id),
  primary key (employee_id, brand_process_id)
);

create table holidays (
  date date primary key,
  name text not null
);

create table leaves (
  id bigint generated always as identity primary key,
  employee_id text not null references employees (id),
  start_date date not null,
  end_date date not null,
  type text not null check (type in ('planned_leave', 'comp_off_taken')),
  status text not null default 'approved' check (status in ('approved', 'planned')),
  earned_on date, -- for comp_off_taken: the holiday that was worked
  check (end_date >= start_date)
);

create table rosters (
  id text primary key,
  month text not null, -- '2026-12'
  version int not null default 1,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'VALIDATED', 'PUBLISHED')),
  unique (month, version)
);

-- ONE attendance status per employee per date.
create table roster_days (
  roster_id text not null references rosters (id),
  employee_id text not null references employees (id),
  date date not null,
  status text not null check (
    status in ('WORK', 'WEEKLY_OFF', 'LEAVE', 'HOLIDAY_OFF', 'COMP_OFF', 'CLOSED')
  ),
  primary key (roster_id, employee_id, date)
);

-- MANY process allocations per employee per date.
create table roster_coverage (
  roster_id text not null references rosters (id),
  employee_id text not null references employees (id),
  date date not null,
  brand_process_id text not null references brand_processes (id),
  allocation_pct int not null check (allocation_pct between 1 and 100),
  role text not null check (role in ('primary', 'shared', 'backup')),
  primary key (roster_id, employee_id, date, brand_process_id),
  foreign key (roster_id, employee_id, date)
    references roster_days (roster_id, employee_id, date)
);

create table issues (
  id bigint generated always as identity primary key,
  roster_id text not null references rosters (id),
  code text not null,
  severity text not null check (severity in ('mandatory', 'preference')),
  claim_kind text not null check (claim_kind in ('structural', 'gap', 'repair', 'validation')),
  date date,
  brand_id text references brands (id),
  process_code text,
  employee_id text references employees (id),
  required int,
  actual int,
  message text not null
);

create index roster_days_date_idx on roster_days (date);
create index roster_coverage_bp_date_idx on roster_coverage (brand_process_id, date);
create index issues_roster_idx on issues (roster_id, severity);
