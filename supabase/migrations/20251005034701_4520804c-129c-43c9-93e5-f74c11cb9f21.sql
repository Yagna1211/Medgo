-- Remove profiles.role column and update RLS policies
-- The role is now managed exclusively in user_roles table

-- Drop the old complex UPDATE policy that protected role column
DROP POLICY IF EXISTS "Users can update their own profile (except role)" ON public.profiles;

-- Create simpler UPDATE policy (no role column to protect anymore)
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Remove the role column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Set up pg_cron for location data cleanup
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job to run daily at 2 AM
SELECT cron.schedule(
  'cleanup-driver-locations',
  '0 2 * * *',
  $$ SELECT public.cleanup_old_location_data(); $$
);

-- Add audit logging table for SMS dispatches
CREATE TABLE IF NOT EXISTS public.sms_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient_count integer NOT NULL,
  emergency_type text NOT NULL,
  consent_given boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.sms_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own SMS logs
CREATE POLICY "Users can view their own SMS logs"
ON public.sms_audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- Add rate limiting table for OTP and SMS
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- user_id or IP address
  action text NOT NULL, -- 'otp', 'sms', 'emergency_alert'
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action 
ON public.rate_limits(identifier, action, window_start);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _action text,
  _max_attempts integer,
  _window_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_count integer;
  _window_start timestamp with time zone;
  _blocked_until timestamp with time zone;
BEGIN
  -- Check if currently blocked
  SELECT blocked_until INTO _blocked_until
  FROM rate_limits
  WHERE identifier = _identifier
    AND action = _action
    AND blocked_until > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF _blocked_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_until', _blocked_until,
      'message', 'Rate limit exceeded. Please try again later.'
    );
  END IF;
  
  -- Get or create rate limit record
  SELECT attempt_count, window_start INTO _current_count, _window_start
  FROM rate_limits
  WHERE identifier = _identifier
    AND action = _action
    AND window_start > now() - interval '1 minute' * _window_minutes
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF _current_count IS NULL THEN
    -- First attempt in this window
    INSERT INTO rate_limits (identifier, action, attempt_count, window_start)
    VALUES (_identifier, _action, 1, now());
    
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - 1);
  ELSIF _current_count >= _max_attempts THEN
    -- Exceeded limit, block for window duration
    UPDATE rate_limits
    SET blocked_until = now() + interval '1 minute' * _window_minutes
    WHERE identifier = _identifier AND action = _action;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_until', now() + interval '1 minute' * _window_minutes,
      'message', 'Rate limit exceeded. Please try again later.'
    );
  ELSE
    -- Increment attempt count
    UPDATE rate_limits
    SET attempt_count = attempt_count + 1
    WHERE identifier = _identifier 
      AND action = _action 
      AND window_start = _window_start;
    
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - _current_count - 1);
  END IF;
END;
$$;
