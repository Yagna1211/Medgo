-- Add role and driver-specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role text DEFAULT 'customer' CHECK (role IN ('customer', 'driver')),
ADD COLUMN ambulance_number text,
ADD COLUMN vehicle_details text,
ADD COLUMN service_area text,
ADD COLUMN is_available boolean DEFAULT true;

-- Update the handle_new_user function to include role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle the case where profile already exists
    RETURN NEW;
END;
$function$;

-- Create ambulance requests table
CREATE TABLE public.ambulance_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_location point NOT NULL,
  pickup_address text,
  emergency_type text DEFAULT 'Medical Emergency',
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  driver_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for ambulance_requests
ALTER TABLE public.ambulance_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for ambulance_requests
CREATE POLICY "Customers can create their own requests"
ON public.ambulance_requests
FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own requests"
ON public.ambulance_requests
FOR SELECT
USING (auth.uid() = customer_id);

CREATE POLICY "Drivers can view requests assigned to them"
ON public.ambulance_requests
FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update requests assigned to them"
ON public.ambulance_requests
FOR UPDATE
USING (auth.uid() = driver_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_ambulance_requests_updated_at
BEFORE UPDATE ON public.ambulance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();