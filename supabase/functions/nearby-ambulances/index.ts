import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toRad(x: number) { return (x * Math.PI) / 180; }
function haversineKm(p1: [number, number], p2: [number, number]) {
  const R = 6371;
  const dLat = toRad(p2[0] - p1[0]);
  const dLon = toRad(p2[1] - p1[1]);
  const lat1 = toRad(p1[0]);
  const lat2 = toRad(p2[0]);
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const { lat, lng, radiusKm = 5 } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('lat and lng are required numbers');
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from('driver_status')
      .select('user_id, location, available, updated_at');

    if (error) throw error;

    const drivers = (data || [])
      .filter((d: any) => d.available && d.location)
      .map((d: any) => {
        const [x, y] = d.location.coordinates || [null, null]; // point as (x,y) = (lng,lat) in PostGIS, but Supabase returns {x,y}? Guard both
        const lngLat = Array.isArray(d.location) ? d.location : [d.location?.x ?? x, d.location?.y ?? y];
        const dlng = Array.isArray(lngLat) ? lngLat[0] : lngLat?.x;
        const dlat = Array.isArray(lngLat) ? lngLat[1] : lngLat?.y;
        const dist = haversineKm([lat, lng], [dlat, dlng]);
        return { driver_id: d.user_id, lat: dlat, lng: dlng, distance_km: dist, updated_at: d.updated_at };
      })
      .filter((d: any) => isFinite(d.distance_km) && d.distance_km <= radiusKm)
      .sort((a: any, b: any) => a.distance_km - b.distance_km);

    return new Response(JSON.stringify({ count: drivers.length, drivers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('nearby-ambulances error', e);
    return new Response(JSON.stringify({ error: e.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
