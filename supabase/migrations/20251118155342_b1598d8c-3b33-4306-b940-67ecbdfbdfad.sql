-- Create a function to mark all notifications for an emergency as accepted
-- This runs with elevated privileges to bypass RLS
CREATE OR REPLACE FUNCTION accept_emergency_request(
  p_user_id UUID,
  p_emergency_type TEXT,
  p_accepting_driver_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update all pending notifications for this emergency to 'accepted'
  UPDATE ambulance_notifications
  SET status = 'accepted'
  WHERE user_id = p_user_id
    AND emergency_type = p_emergency_type
    AND status = 'pending';
    
  -- Update the ambulance request to mark which driver accepted
  UPDATE ambulance_requests
  SET driver_id = p_accepting_driver_id,
      status = 'accepted'
  WHERE customer_id = p_user_id
    AND emergency_type = p_emergency_type
    AND status = 'pending';
END;
$$;