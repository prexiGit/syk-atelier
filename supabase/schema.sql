-- THE SYK ATELIER — internship certificates: database, security (RLS) and storage.
-- Run once in Supabase → SQL Editor → New query. Safe to re-run.

-- 1. Certificate numbers: SYK-2026-0001, SYK-2026-0002, ...
create sequence if not exists public.certificate_number_seq start 1;

create or replace function public.next_certificate_id()
returns text
language sql
volatile
as $$
  select 'SYK-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-'
         || lpad(nextval('public.certificate_number_seq')::text, 4, '0');
$$;

-- 2. Certificates (one row per student certificate)
create table if not exists public.certificates (
  id                    uuid primary key default gen_random_uuid(),
  certificate_id        text not null unique default public.next_certificate_id(),

  student_name          text not null check (char_length(student_name) between 2 and 120),
  father_name           text not null check (char_length(father_name) between 2 and 120),
  course_name           text not null check (char_length(course_name) between 1 and 120),
  semester              text not null check (char_length(semester) between 1 and 20),
  roll_number           text not null check (char_length(roll_number) between 1 and 40),
  college_name          text not null check (char_length(college_name) between 2 and 160),

  training_name         text not null check (char_length(training_name) between 2 and 120),
  start_date            date not null,
  end_date              date not null,
  hours                 integer not null check (hours >= 120 and hours <= 2000),
  academic_year         text not null check (academic_year ~ '^\d{4}-\d{2}$'),
  duties                text not null check (char_length(duties) between 2 and 600),

  signatory_name        text not null check (char_length(signatory_name) between 2 and 80),
  signatory_designation text not null check (char_length(signatory_designation) between 2 and 80),

  status                text not null default 'draft' check (status in ('draft', 'published')),
  pdf_path              text,                 -- file inside the private "certificates" bucket
  issued_at             timestamptz,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),

  constraint dates_in_order check (end_date >= start_date),
  constraint published_has_pdf check (status = 'draft' or (pdf_path is not null and issued_at is not null))
);

create index if not exists certificates_status_idx on public.certificates (status, issued_at desc);

-- 3. Administrators
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 4. Row Level Security: the tables are admin-only.
--    Visitors never read the tables directly; they use the two functions below,
--    which return only published certificates and only non-private columns.
alter table public.certificates enable row level security;
alter table public.admins enable row level security;

revoke all on public.certificates from anon;
revoke all on public.admins from anon;

-- Newer Supabase projects don't grant table access to the API roles automatically.
-- Admins sign in as "authenticated"; RLS policies below still decide which rows they can touch.
-- Visitors ("anon") get no table access at all and read only through the functions in section 5.
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.certificates to authenticated;
grant select on public.admins to authenticated;

drop policy if exists "Admins read certificates" on public.certificates;
create policy "Admins read certificates" on public.certificates
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins add certificates" on public.certificates;
create policy "Admins add certificates" on public.certificates
  for insert to authenticated with check (public.is_admin() and status = 'draft');

-- Only unpublished (draft) rows can change, so an issued certificate is never altered.
drop policy if exists "Admins publish drafts" on public.certificates;
create policy "Admins publish drafts" on public.certificates
  for update to authenticated
  using (public.is_admin() and status = 'draft')
  with check (public.is_admin());

drop policy if exists "Admins read own admin row" on public.admins;
create policy "Admins read own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- 5. Public read functions (no phone, email, father's name or roll number in the listing)
create or replace function public.list_published_certificates()
returns table (
  certificate_id text, student_name text, training_name text,
  start_date date, end_date date, hours integer, academic_year text, issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select certificate_id, student_name, training_name, start_date, end_date, hours, academic_year, issued_at
  from public.certificates
  where status = 'published'
  order by issued_at desc;
$$;

create or replace function public.get_published_certificate(p_certificate_id text)
returns table (
  certificate_id text, student_name text, training_name text,
  start_date date, end_date date, hours integer, academic_year text, issued_at timestamptz, pdf_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select certificate_id, student_name, training_name, start_date, end_date, hours, academic_year, issued_at, pdf_path
  from public.certificates
  where status = 'published' and certificate_id = upper(trim(p_certificate_id))
  limit 1;
$$;

create or replace function public.is_published_pdf(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.certificates where status = 'published' and pdf_path = p_path);
$$;

revoke all on function public.list_published_certificates() from public;
revoke all on function public.get_published_certificate(text) from public;
grant execute on function public.list_published_certificates() to anon, authenticated;
grant execute on function public.get_published_certificate(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_published_pdf(text) to anon, authenticated;

-- The table's ID uses the sequence on insert
grant usage, select on sequence public.certificate_number_seq to authenticated;
grant execute on function public.next_certificate_id() to authenticated;

-- 6. Storage: PRIVATE bucket. Visitors can read a PDF only once its certificate is published.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

drop policy if exists "Read published certificate PDFs" on storage.objects;
create policy "Read published certificate PDFs" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'certificates' and (public.is_published_pdf(name) or public.is_admin()));

drop policy if exists "Admins upload certificate PDFs" on storage.objects;
create policy "Admins upload certificate PDFs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificates' and public.is_admin());

-- Overwrite is allowed only while the certificate is still a draft (retrying a failed issue).
drop policy if exists "Admins replace draft PDFs" on storage.objects;
create policy "Admins replace draft PDFs" on storage.objects
  for update to authenticated
  using (bucket_id = 'certificates' and public.is_admin() and not public.is_published_pdf(name));

-- 7. Make your login an administrator.
-- First: Authentication → Users → Add user (email + password, auto-confirm).
-- Then run, with that email:
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'admin@example.com';
