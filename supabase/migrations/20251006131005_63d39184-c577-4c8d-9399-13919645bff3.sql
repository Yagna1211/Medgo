-- Fix the handle_new_user trigger to work without profiles.role column
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer');
  
  -- Insert into profiles (without role column)
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    email,
    phone,
    ambulance_number,
    vehicle_details,
    service_area
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone),
    NEW.raw_user_meta_data ->> 'ambulance_number',
    NEW.raw_user_meta_data ->> 'vehicle_details',
    NEW.raw_user_meta_data ->> 'service_area'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    ambulance_number = COALESCE(EXCLUDED.ambulance_number, profiles.ambulance_number),
    vehicle_details = COALESCE(EXCLUDED.vehicle_details, profiles.vehicle_details),
    service_area = COALESCE(EXCLUDED.service_area, profiles.service_area);
  
  -- Insert into user_roles (this is where role is stored for security)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();