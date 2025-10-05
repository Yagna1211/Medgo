-- Enable realtime for ambulance notifications
ALTER TABLE public.ambulance_notifications REPLICA IDENTITY FULL;

-- Add notifications to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulance_notifications;