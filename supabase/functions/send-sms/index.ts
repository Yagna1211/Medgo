import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FAST2SMS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing FAST2SMS_API_KEY' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phoneNumber, message } = await req.json();
    
    if (!phoneNumber || !message) {
      return new Response(JSON.stringify({ error: 'Phone number and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone number (remove +91 if present, ensure 10 digits)
    const cleanPhone = phoneNumber.replace(/^\+?91/, '').replace(/\D/g, '');
    
    if (cleanPhone.length !== 10) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fast2SMS API call
    const url = 'https://www.fast2sms.com/dev/bulkV2';
    const formData = new FormData();
    formData.append('authorization', apiKey);
    formData.append('sender_id', 'FSTSMS');
    formData.append('message', message);  
    formData.append('language', 'english');
    formData.append('route', 'v3');
    formData.append('numbers', cleanPhone);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    console.log('SMS API Response:', result);

    if (!response.ok || !result.return) {
      throw new Error(result.message || 'Failed to send SMS');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'SMS sent successfully',
      response: result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (e) {
    console.error('SMS sending error:', e);
    return new Response(JSON.stringify({ 
      error: e.message || 'Failed to send SMS',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});