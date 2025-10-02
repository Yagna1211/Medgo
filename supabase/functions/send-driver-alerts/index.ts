import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FAST2SMS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SMS API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      customerId, 
      customerName, 
      customerPhone, 
      customerLat, 
      customerLng, 
      emergencyType,
      description,
      pickupAddress 
    } = await req.json();

    // Find nearby drivers
    const { data: driversResponse } = await supabase.functions.invoke('find-nearby-drivers', {
      body: { 
        customerLat, 
        customerLng, 
        radiusKm: 10 
      }
    });

    const nearbyDrivers = driversResponse?.drivers || [];
    
    if (nearbyDrivers.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No available drivers found nearby. Please call 108 for emergency services.',
        driversNotified: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create ambulance request in database
    const { data: newRequest, error: insertError } = await supabase
      .from('ambulance_requests')
      .insert({
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_location: `POINT(${customerLng} ${customerLat})`,
        pickup_address: pickupAddress,
        emergency_type: emergencyType,
        description: description,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch driver phone numbers from profiles
    const driverIds = nearbyDrivers.slice(0, 3).map(d => d.driver_id);
    const { data: driverProfiles } = await supabase
      .from('profiles')
      .select('user_id, phone')
      .in('user_id', driverIds);

    // Send SMS to nearest drivers (max 3)
    const smsPromises = nearbyDrivers.slice(0, 3).map(async (driver) => {
      const driverProfile = driverProfiles?.find(p => p.user_id === driver.driver_id);
      if (!driverProfile?.phone) {
        console.log(`No phone number for driver ${driver.driver_id}`);
        return null;
      }

      const cleanPhone = driverProfile.phone.replace(/^\+?91/, '').replace(/\D/g, '');
      
      if (cleanPhone.length !== 10) {
        console.log(`Invalid phone number for driver ${driver.user_id}: ${driver.phone}`);
        return null;
      }

      const message = `🚨 Emergency Alert from MedGo 🚨
Name: ${customerName}
Phone: ${customerPhone}
Location: ${pickupAddress || `${customerLat}, ${customerLng}`}
Type: ${emergencyType}
${description ? `Details: ${description}` : ''}
This user requires an ambulance immediately. Please respond ASAP.`;

      try {
        const formData = new FormData();
        formData.append('authorization', apiKey);
        formData.append('sender_id', 'FSTSMS');
        formData.append('message', message);
        formData.append('language', 'english');
        formData.append('route', 'v3');
        formData.append('numbers', cleanPhone);

        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        console.log(`SMS sent to ${cleanPhone}:`, result);

        return {
          phone: cleanPhone,
          success: response.ok && result.return,
          result
        };
      } catch (error) {
        console.error(`SMS error for ${cleanPhone}:`, error);
        return {
          phone: cleanPhone,
          success: false,
          error: error.message
        };
      }
    });

    const smsResults = await Promise.all(smsPromises);
    const successfulSMS = smsResults.filter(result => result && result.success);

    console.log(`SMS sent to ${successfulSMS.length} out of ${nearbyDrivers.length} drivers`);

    return new Response(JSON.stringify({
      success: true,
      message: `Emergency alert sent to ${successfulSMS.length} nearby drivers`,
      requestId: newRequest.id,
      driversNotified: successfulSMS.length,
      totalDriversFound: nearbyDrivers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-driver-alerts function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send driver alerts',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});