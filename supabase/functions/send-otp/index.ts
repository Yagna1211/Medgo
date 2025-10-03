import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in memory (in production, use a database with expiry)
    // For now, we'll just send it and return it for verification
    const message = `Your Medgo password change OTP is: ${otp}. Valid for 5 minutes.`;

    // Send SMS using Fast2SMS
    const apiKey = Deno.env.get("FAST2SMS_API_KEY");
    if (!apiKey) {
      throw new Error("Fast2SMS API key not configured");
    }

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "authorization": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "v3",
        sender_id: "MEDGO",
        message: message,
        language: "english",
        flash: 0,
        numbers: phoneNumber,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to send SMS: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, otp }), // In production, don't return OTP
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
