-- Create driver request history table
CREATE TABLE IF NOT EXISTS public.driver_request_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  request_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  emergency_type TEXT NOT NULL,
  pickup_address TEXT,
  action TEXT NOT NULL CHECK (action IN ('accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.driver_request_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Drivers can view their own history"
ON public.driver_request_history
FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own history"
ON public.driver_request_history
FOR INSERT
WITH CHECK (auth.uid() = driver_id);

-- Add indexes for performance
CREATE INDEX idx_driver_request_history_driver_id ON public.driver_request_history(driver_id);
CREATE INDEX idx_driver_request_history_created_at ON public.driver_request_history(created_at DESC);