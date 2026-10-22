create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    student_code text unique,
    name text not null,
    class_name text not null,
    section text,
    guardian_name text,
    phone text,
    biometric_id text not null unique,
    photo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists students_class_name_idx on public.students (class_name);
create index if not exists students_name_idx on public.students (name);
create index if not exists students_biometric_id_idx on public.students (biometric_id);
