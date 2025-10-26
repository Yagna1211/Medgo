-- Add customer details to ambulance_notifications table
ALTER TABLE public.ambulance_notifications
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;