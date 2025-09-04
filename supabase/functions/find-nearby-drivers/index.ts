import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two points
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customerLat, customerLng, radiusKm = 10 } = await req.json();

    if (!customerLat || !customerLng) {
      return new Response(JSON.stringify({ error: 'Customer location required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all available drivers with their locations
    const { data: drivers, error } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, phone, ambulance_number, service_area')
      .eq('role', 'driver')
      .eq('is_available', true);

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch drivers' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For demo purposes, we'll simulate driver locations near the customer
    // In a real app, you'd have actual GPS coordinates stored for each driver
    const nearbyDrivers = drivers
      ?.filter(driver => driver.phone) // Only drivers with phone numbers
      .slice(0, 5) // Limit to 5 nearest drivers
      .map(driver => ({
        ...driver,
        // Simulate location within radius (this would be real GPS data in production)
        distance: Math.random() * radiusKm,
      }))
      .sort((a, b) => a.distance - b.distance) || [];

    console.log(`Found ${nearbyDrivers.length} available drivers near customer location`);

    return new Response(JSON.stringify({ 
      drivers: nearbyDrivers,
      count: nearbyDrivers.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in find-nearby-drivers function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});