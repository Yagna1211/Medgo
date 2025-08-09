-- Driver status table
create table if not exists public.driver_status (
  user_id uuid primary key,
  available boolean not null default false,
  location point,
  updated_at timestamptz not null default now()
);

alter table public.driver_status enable row level security;

-- Recreate policies to be idempotent
drop policy if exists "Drivers can view their own status" on public.driver_status;
drop policy if exists "Drivers can insert their own status" on public.driver_status;
drop policy if exists "Drivers can update their own status" on public.driver_status;

create policy "Drivers can view their own status"
  on public.driver_status for select
  using (auth.uid() = user_id);

create policy "Drivers can insert their own status"
  on public.driver_status for insert
  with check (auth.uid() = user_id);

create policy "Drivers can update their own status"
  on public.driver_status for update
  using (auth.uid() = user_id);

-- Trigger to maintain updated_at
drop trigger if exists update_driver_status_updated_at on public.driver_status;
create trigger update_driver_status_updated_at
before update on public.driver_status
for each row execute function public.update_updated_at_column();

-- Notifications table
create table if not exists public.ambulance_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  driver_id uuid not null,
  pickup_location point not null,
  pickup_address text,
  emergency_type text not null,
  description text,
  status text not null default 'pending',
  distance_km numeric
);

alter table public.ambulance_notifications enable row level security;

create index if not exists idx_ambulance_notifications_driver on public.ambulance_notifications(driver_id);
create index if not exists idx_ambulance_notifications_user on public.ambulance_notifications(user_id);

-- RLS for notifications
drop policy if exists "Drivers can view their notifications" on public.ambulance_notifications;
drop policy if exists "Drivers can update their notifications" on public.ambulance_notifications;
drop policy if exists "Requesters can view their notifications" on public.ambulance_notifications;

create policy "Drivers can view their notifications"
  on public.ambulance_notifications for select
  using (auth.uid() = driver_id);

create policy "Drivers can update their notifications"
  on public.ambulance_notifications for update
  using (auth.uid() = driver_id);

create policy "Requesters can view their notifications"
  on public.ambulance_notifications for select
  using (auth.uid() = user_id);
