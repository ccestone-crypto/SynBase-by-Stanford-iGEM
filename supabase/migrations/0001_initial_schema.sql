-- SynBase initial schema for Supabase Postgres.
-- Run this once, either via `supabase db push` (CLI, after `supabase link`)
-- or by pasting the whole file into the Supabase Dashboard's SQL Editor and
-- clicking Run. Safe to run more than once (every statement is idempotent).

-- ---------- profiles ----------
-- Supabase Auth owns auth.users (email, password, etc.) — you can't add
-- custom columns to it directly. App-specific fields (name, admin flag, TA
-- eligibility) live here instead, one row per auth user, kept in sync by the
-- trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  is_admin boolean not null default false,
  ta_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Only the server (using the service_role key, which bypasses RLS entirely)
-- reads/writes these tables — the browser never talks to Supabase directly.
-- RLS stays enabled with no permissive policies as defense-in-depth: even if
-- the anon/publishable key ever leaked or got used client-side by mistake,
-- it still couldn't read or write anything here.

-- Auto-create a profile row whenever someone signs up. `raw_user_meta_data`
-- is populated by passing `options.data` to supabase.auth.signUp() — the
-- server sets `name` and `is_admin` there at signup time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- progress ----------
create table if not exists public.progress_sections (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  section_id text not null,
  completed boolean not null default true,
  primary key (user_id, module_id, section_id)
);
alter table public.progress_sections enable row level security;

create table if not exists public.progress_video (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  watched boolean not null default false,
  primary key (user_id, module_id)
);
alter table public.progress_video enable row level security;

-- ---------- applications ----------
create table if not exists public.application_questions (
  id text primary key,
  kind text not null default 'sibrp',
  prompt text not null,
  type text not null default 'short',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.application_questions enable row level security;

create table if not exists public.applications (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'sibrp',
  name text not null,
  email text not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.applications enable row level security;

create table if not exists public.application_windows (
  kind text primary key,
  opens_at timestamptz,
  closes_at timestamptz
);
alter table public.application_windows enable row level security;

-- ---------- speaker talks ----------
create table if not exists public.speaker_talks (
  id text primary key,
  title text not null,
  speaker_name text not null,
  description text not null default '',
  youtube_id text not null,
  uploaded_at timestamptz not null default now()
);
alter table public.speaker_talks enable row level security;

-- ---------- portfolio projects ("Beyond SiBRP") ----------
create table if not exists public.portfolio_projects (
  id text primary key,
  student text not null,
  title text not null,
  year text not null default '',
  tag text not null default '',
  accent text not null default 'teal',
  image text not null default '',
  short_description text not null default '',
  full_story text not null default '',
  anecdote text not null default '',
  link text not null default '',
  created_at timestamptz not null default now()
);
alter table public.portfolio_projects enable row level security;

-- ---------- free-response / discussion board answers ----------
create table if not exists public.free_responses (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  section_id text not null,
  answer text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id, section_id)
);
alter table public.free_responses enable row level security;

-- ---------- seed: the one real portfolio project that used to be hardcoded ----------
insert into public.portfolio_projects
  (id, student, title, year, tag, accent, image, short_description, full_story, anecdote, link)
values (
  'diabetic-retinopathy-ai',
  'Roseline Bandela',
  'AI-Based Screening System for Diabetic Retinopathy',
  '2025',
  'Research',
  'gold',
  'assets/img/portfolio/bandela-diabetic-retinopathy-poster.jpg',
  'Roseline built an AI-powered diabetic retinopathy screening tool and now leads an effort to bring iGEM and a biomedical engineering lab to McNeese State University.',
  E'Following SiBRP, Roseline developed a project titled "Development of an Artificial Intelligence-Based Screening System for Diabetic Retinopathy in Rural Regions Using the Integration of Convolutional Neural Networks in PyCharm." Roseline trained her own CNN model, wrote a research paper, and presented it at the Region V Science Fair. The project earned a nomination for the Louisiana Science & Engineering Fair (LSEF) and received several awards, including the Yale Science & Engineering Association Most Outstanding Exhibit in STEM Award, the Regeneron Biomedical Science Award, the Society for In Vitro Biology Outstanding Achievement Award, and 2nd Place in Biomedical Engineering.\n\nSince September 2025, Roseline has also been working to bring iGEM to McNeese State University to build a team centered around synthetic biology, with an emphasis on the Software & AI, Diagnostics, and Space Innovation Villages. Alongside this, Roseline is developing a Bioelectronics & Neural Interfaces Lab for students to work on hands-on projects involving biosensors, neural engineering, wearable devices, and AI-driven healthcare technologies. This idea was sparked by a session where 2025 iGEM team member Melwin talked about biomedical engineering and developing medical devices. From that session, Roseline did more research and eventually came up with the idea to develop a lab. She plans to officially launch the lab this year.',
  'Last year, my team and I focused on using AI to detect retinoblastoma from fundus retinal images. That experience introduced me to AI applications in healthcare and inspired me to pursue independent research. Looking back, SiBRP gave me the foundation and confidence to dive into AI, biomedical engineering, and synthetic biology. I would not have started these initiatives without that experience, and it has played a major role in shaping my career path.',
  ''
)
on conflict (id) do nothing;
