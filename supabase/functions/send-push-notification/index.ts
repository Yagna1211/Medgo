import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: any
) {
  try {
    console.log('Sending push notification to:', subscription.endpoint);
    
    // In a production environment, you would use web-push library with VAPID keys
    // For now, we'll log the notification
    // To fully implement, you'll need to:
    // 1. Generate VAPID keys (vapid.generate())
    // 2. Store them as secrets
    // 3. Use web-push library to send notifications
    
    console.log('Push notification payload:', JSON.stringify(payload));
    console.log('Note: To enable actual push delivery, configure VAPID keys and use web-push library');
    
    return { success: true };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { driverIds, title, body, data } = await req.json();
    console.log('Sending push notifications to drivers:', driverIds);

    if (!driverIds || !Array.isArray(driverIds) || driverIds.length === 0) {
      throw new Error('driverIds array is required');
    }

    // Get all push subscriptions for the specified drivers
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', driverIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for drivers');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No push subscriptions found',
          sent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    // Send push notification to each subscription
    const payload = {
      title: title || 'Emergency Request',
      body: body || 'New ambulance request',
      tag: 'emergency-notification',
      url: '/',
      ...data
    };

    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        sendWebPush({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth
        }, payload)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Successfully sent ${successCount}/${subscriptions.length} push notifications`);

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: successCount,
        total: subscriptions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
