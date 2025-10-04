-- Update the handle_new_user trigger to properly save driver-specific fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    email, 
    role,
    ambulance_number,
    vehicle_details,
    service_area
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer'),
    NEW.raw_user_meta_data ->> 'ambulance_number',
    NEW.raw_user_meta_data ->> 'vehicle_details',
    NEW.raw_user_meta_data ->> 'service_area'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    role = COALESCE(EXCLUDED.role, profiles.role),
    ambulance_number = COALESCE(EXCLUDED.ambulance_number, profiles.ambulance_number),
    vehicle_details = COALESCE(EXCLUDED.vehicle_details, profiles.vehicle_details),
    service_area = COALESCE(EXCLUDED.service_area, profiles.service_area);
  
  RETURN NEW;
END;
$$;