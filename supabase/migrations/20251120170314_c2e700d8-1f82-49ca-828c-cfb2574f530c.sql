-- Add delivery tracking fields to ambulance_notifications
ALTER TABLE ambulance_notifications 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create SMS delivery status table
CREATE TABLE IF NOT EXISTS sms_delivery_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_request_id UUID REFERENCES ambulance_requests(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  driver_phone TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending', -- pending, delivered, failed
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sms_delivery_status
ALTER TABLE sms_delivery_status ENABLE ROW LEVEL SECURITY;

-- Allow customers to view SMS delivery status for their requests
CREATE POLICY "Customers can view SMS delivery for their requests"
ON sms_delivery_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ambulance_requests 
    WHERE ambulance_requests.id = sms_delivery_status.ambulance_request_id 
    AND ambulance_requests.customer_id = auth.uid()
  )
);

-- Service role can manage SMS delivery status
CREATE POLICY "Service role can manage SMS delivery status"
ON sms_delivery_status
FOR ALL
USING (true)
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_delivery_request_id ON sms_delivery_status(ambulance_request_id);
CREATE INDEX IF NOT EXISTS idx_ambulance_notifications_read_at ON ambulance_notifications(read_at);

-- Enable realtime for ambulance_notifications and sms_delivery_status
ALTER TABLE ambulance_notifications REPLICA IDENTITY FULL;
ALTER TABLE sms_delivery_status REPLICA IDENTITY FULL;