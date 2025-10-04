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

    console.log('Received emergency request:', { 
      customerId, 
      emergencyType, 
      location: { lat: customerLat, lng: customerLng } 
    });

    // Helper function to calculate distance using Haversine formula
    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const toRad = (x: number) => (x * Math.PI) / 180;
      const R = 6371; // Earth's radius in km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Fetch available drivers with their locations
    const { data: driverStatuses, error: statusError } = await supabase
      .from('driver_status')
      .select('user_id, location, available')
      .eq('available', true)
      .not('location', 'is', null);

    if (statusError) {
      console.error('Error fetching driver statuses:', statusError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to fetch driver statuses',
        driversNotified: 0
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!driverStatuses || driverStatuses.length === 0) {
      console.log('No available drivers found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No available drivers to notify',
        driversNotified: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter drivers within 50km radius and sort by distance
    const nearbyDrivers = driverStatuses
      .map(status => {
        // Parse location point (format: "(lat,lng)")
        const locMatch = status.location.match(/\(([-\d.]+),([-\d.]+)\)/);
        if (!locMatch) return null;
        
        const [_, driverLat, driverLng] = locMatch;
        const distance = haversineKm(
          customerLat,
          customerLng,
          parseFloat(driverLat),
          parseFloat(driverLng)
        );
        
        return { user_id: status.user_id, distance };
      })
      .filter(driver => driver !== null && driver.distance <= 50)
      .sort((a, b) => a!.distance - b!.distance)
      .slice(0, 10); // Limit to 10 nearest drivers

    if (nearbyDrivers.length === 0) {
      console.log('No drivers within 50km radius');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No drivers within range',
        driversNotified: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch driver profiles for nearby drivers only
    const nearbyDriverIds = nearbyDrivers.map(d => d!.user_id);
    const { data: allDrivers, error: driversError } = await supabase
      .from('profiles')
      .select('user_id, phone, first_name, last_name')
      .in('user_id', nearbyDriverIds)
      .not('phone', 'is', null);

    if (driversError) {
      console.error('Error fetching driver profiles:', driversError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to fetch driver profiles',
        driversNotified: 0
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!allDrivers || allDrivers.length === 0) {
      console.log('No driver profiles found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No drivers available',
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

    // Send SMS to ALL drivers with clickable links
    const googleMapsLink = `https://www.google.com/maps?q=${customerLat},${customerLng}`;
    
    const smsPromises = allDrivers.map(async (driver) => {
      if (!driver.phone) {
        console.log(`No phone number for driver ${driver.user_id}`);
        return null;
      }

      const cleanPhone = driver.phone.replace(/^\+?91/, '').replace(/\D/g, '');
      
      if (cleanPhone.length !== 10) {
        console.log(`Invalid phone number for driver ${driver.user_id}: ${driver.phone}`);
        return null;
      }

      // Format message with clickable links
      const message = `Emergency!! 🚨🚨
Patient name: ${customerName}
Patient mobile number: ${customerPhone}
Location: ${googleMapsLink}
Emergency Type: ${emergencyType}
${pickupAddress ? `Address: ${pickupAddress}` : ''}
${description ? `Details: ${description}` : ''}

Click location link to open Google Maps for directions.
Call patient directly from the number above.`;

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

    console.log(`SMS sent to ${successfulSMS.length} out of ${allDrivers.length} drivers`);

    return new Response(JSON.stringify({
      success: true,
      message: `Emergency alert sent to ${successfulSMS.length} ambulance drivers`,
      requestId: newRequest.id,
      driversNotified: successfulSMS.length,
      totalDriversFound: allDrivers.length
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