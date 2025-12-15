-- Add email column to profiles and enforce global uniqueness (case-insensitive)
-- Nulls allowed, but when provided, email must be unique across the application

alter table public.profiles
  add column if not exists email text;

-- Create a unique index on lower(email) to enforce case-insensitive uniqueness
create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

-- Optional: ensure default disabled flag exists for activation control
alter table public.profiles
  add column if not exists disabled boolean default false;
