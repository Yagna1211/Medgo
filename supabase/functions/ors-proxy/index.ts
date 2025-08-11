import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const orsKey = Deno.env.get("OPENROUTESERVICE_API_KEY");
    if (!orsKey) {
      return new Response(JSON.stringify({ error: "Missing OPENROUTESERVICE_API_KEY" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, text, start, end } = await req.json();

    if (action === "geocode") {
      if (!text) throw new Error("'text' (address) is required for geocode");
      const url = `https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(text)}&size=1`;
      const res = await fetch(url, { headers: { Authorization: orsKey, Accept: "application/json" } });
      if (!res.ok) throw new Error(`ORS geocode failed: ${await res.text()}`);
      const data = await res.json();
      const feature = data.features?.[0];
      const coords = feature?.geometry?.coordinates;
      if (!coords) throw new Error("No results from geocoder");
      const [lng, lat] = coords;
      return new Response(JSON.stringify({ lat, lng, raw: feature }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "route") {
      if (!start || !end) throw new Error("'start' and 'end' [lng,lat] are required for route");
      const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: orsKey, "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [start, end] }),
      });
      if (!res.ok) throw new Error(`ORS route failed: ${await res.text()}`);
      const data = await res.json();
      const line = data.features?.[0]?.geometry?.coordinates;
      if (!line) throw new Error("No route returned");
      return new Response(JSON.stringify({ coordinates: line }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ors-proxy error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
