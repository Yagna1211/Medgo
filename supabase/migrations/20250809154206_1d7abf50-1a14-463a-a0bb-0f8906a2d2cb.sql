-- Create driver_status table to track ambulance driver availability and location
create table if not exists public.driver_status (
  user_id uuid primary key,
  available boolean not null default false,
  location point,
  updated_at timestamptz not null default now()
);

alter table public.driver_status enable row level security;

-- RLS policies for driver_status
create policy if not exists "Drivers can view their own status"
  on public.driver_status for select
  using (auth.uid() = user_id);

create policy if not exists "Drivers can insert their own status"
  on public.driver_status for insert
  with check (auth.uid() = user_id);

create policy if not exists "Drivers can update their own status"
  on public.driver_status for update
  using (auth.uid() = user_id);

-- Trigger to update updated_at
create trigger if not exists update_driver_status_updated_at
before update on public.driver_status
for each row execute function public.update_updated_at_column();

-- Create ambulance_notifications table used to notify drivers
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

-- Indexes to speed up lookups
create index if not exists idx_ambulance_notifications_driver on public.ambulance_notifications(driver_id);
create index if not exists idx_ambulance_notifications_user on public.ambulance_notifications(user_id);

-- RLS policies for notifications
create policy if not exists "Drivers can view their notifications"
  on public.ambulance_notifications for select
  using (auth.uid() = driver_id);

create policy if not exists "Drivers can update their notifications"
  on public.ambulance_notifications for update
  using (auth.uid() = driver_id);

create policy if not exists "Requesters can view their notifications"
  on public.ambulance_notifications for select
  using (auth.uid() = user_id);
