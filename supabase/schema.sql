-- ReadBit: Database Schema Setup for Supabase PostgreSQL

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. users mapping table (mirrors supabase.auth.users)
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    timezone text default 'UTC' not null,
    profile_settings jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;

create policy "Users can view and edit their own user profiles."
    on public.users for all
    using (auth.uid() = id);

-- Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.users (id, timezone)
    values (new.id, 'UTC');
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();


-- 2. books table
create table public.books (
    id text primary key,
    title text not null,
    author text not null,
    cover_url text,
    file_path text not null,
    file_type text check (file_type in ('pdf', 'epub')) not null,
    total_pages integer not null,
    current_page integer default 0 not null,
    user_id uuid references public.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.books enable row level security;

create policy "Users can manage their own books."
    on public.books for all
    using (auth.uid() = user_id);


-- 3. reading_sessions table
create table public.reading_sessions (
    id text primary key,
    book_id text references public.books(id) on delete cascade not null,
    pages_read integer not null,
    duration_minutes integer not null,
    read_date date default current_date not null,
    user_id uuid references public.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.reading_sessions enable row level security;

create policy "Users can manage their own reading sessions."
    on public.reading_sessions for all
    using (auth.uid() = user_id);


-- 4. goals table
create table public.goals (
    id text primary key,
    book_id text references public.books(id) on delete cascade not null,
    target_date date not null,
    start_page integer default 0 not null,
    current_page integer default 0 not null,
    total_pages integer not null,
    user_id uuid references public.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.goals enable row level security;

create policy "Users can manage their own goals."
    on public.goals for all
    using (auth.uid() = user_id);


-- 5. streaks table
create table public.streaks (
    id text primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    current_streak integer default 0 not null,
    longest_streak integer default 0 not null,
    last_active_date date,
    constraint unique_user_streak unique (user_id)
);

alter table public.streaks enable row level security;

create policy "Users can manage their own streaks."
    on public.streaks for all
    using (auth.uid() = user_id);
