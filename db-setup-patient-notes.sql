-- Patient notes — a team feed per patient (post / edit / soft-delete),
-- each note stamped with who wrote it and when. Read by the Patient File
-- Notes tab and the dashboard notification centre.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.patient_notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  body        text not null,
  created_by  text,                       -- staff email
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  deleted_at  timestamptz                 -- soft delete
);

create index if not exists patient_notes_patient_idx
  on public.patient_notes (patient_id, created_at desc);

-- created_at index for the notification centre (recent notes across patients)
create index if not exists patient_notes_recent_idx
  on public.patient_notes (created_at desc);

alter table public.patient_notes enable row level security;

-- Small trusted clinic team: any signed-in staff member can read/post/edit.
do $$ begin
  create policy notes_select on public.patient_notes
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy notes_insert on public.patient_notes
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy notes_update on public.patient_notes
    for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

grant select, insert, update on public.patient_notes to authenticated;
