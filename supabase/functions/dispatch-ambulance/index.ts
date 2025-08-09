// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toRad(x: number) { return (x * Math.PI) / 180; }
function haversineKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const requesterId = userData.user.id;

    const body = await req.json();
    const { lat, lng, radiusKm = 5, emergencyType, description = "", pickupAddress = "" } = body || {};

    if (typeof lat !== "number" || typeof lng !== "number" || !emergencyType) {
      return new Response(JSON.stringify({ error: "lat, lng and emergencyType are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get all available drivers with a location
    const { data: drivers, error: driversError } = await admin
      .from("driver_status")
      .select("user_id, available, location")
      .eq("available", true)
      .not("location", "is", null);

    if (driversError) {
      console.error("Error fetching drivers", driversError);
      return new Response(JSON.stringify({ error: "Failed to fetch drivers" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin: [number, number] = [Number(lng), Number(lat)];

    const nearby = (drivers || []).map((d: any) => {
      const [dlng, dlat] = d.location as [number, number];
      const distance = haversineKm(origin, [dlng, dlat]);
      return { driver_id: d.user_id as string, distance };
    }).filter(d => d.distance <= Number(radiusKm));

    // Insert notifications per driver
    let notified = 0;
    if (nearby.length > 0) {
      const payload = nearby.map(n => ({
        user_id: requesterId,
        driver_id: n.driver_id,
        pickup_location: `(${lng},${lat})`,
        pickup_address: pickupAddress,
        emergency_type: emergencyType,
        description,
        status: 'pending',
        distance_km: n.distance
      }));

      const { error: insertErr } = await admin.from("ambulance_notifications").insert(payload);
      if (insertErr) {
        console.error("Insert notifications error", insertErr);
        return new Response(JSON.stringify({ error: "Failed to notify drivers" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      notified = payload.length;
    }

    return new Response(JSON.stringify({ notified, radiusKm, driversChecked: drivers?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unhandled error in dispatch-ambulance", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
