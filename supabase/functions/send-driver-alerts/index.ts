import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Email API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
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

    // Fetch ALL drivers (not just available ones)
    const { data: driverRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'driver');

    if (rolesError) {
      console.error('Error fetching driver roles:', rolesError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to fetch drivers',
        driversNotified: 0
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!driverRoles || driverRoles.length === 0) {
      console.log('No drivers registered');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No drivers registered',
        driversNotified: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allDriverIds = driverRoles.map(d => d.user_id);

    // Fetch driver profiles for all drivers with email and phone
    const { data: allDrivers, error: driversError } = await supabase
      .from('profiles')
      .select('user_id, email, phone, first_name, last_name')
      .in('user_id', allDriverIds);

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

    // Send email alerts to all drivers
    const googleMapsLink = `https://www.google.com/maps?q=${customerLat},${customerLng}`;
    
    const emailPromises = allDrivers.map(async (driver) => {
      if (!driver.email) {
        console.log(`No email for driver ${driver.user_id}`);
        return null;
      }

      const driverName = driver.first_name && driver.last_name 
        ? `${driver.first_name} ${driver.last_name}`.trim()
        : 'Driver';

      try {
        const { error: emailError } = await resend.emails.send({
          from: 'MEDGO Emergency <onboarding@resend.dev>',
          to: [driver.email],
          subject: `🚨 URGENT: ${emergencyType} - Emergency Alert`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Emergency Alert</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px;">🚨 EMERGENCY ALERT 🚨</h1>
                </div>
                
                <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">Dear ${driverName},</p>
                  
                  <p style="font-size: 16px; font-weight: bold; color: #dc2626; margin-bottom: 20px;">
                    An emergency ambulance request requires immediate attention!
                  </p>
                  
                  <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
                    <h2 style="margin-top: 0; color: #dc2626; font-size: 20px;">Emergency Details:</h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Emergency Type:</td>
                        <td style="padding: 8px 0;">${emergencyType}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Patient Name:</td>
                        <td style="padding: 8px 0;">${customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Contact Phone:</td>
                        <td style="padding: 8px 0;">${customerPhone}</td>
                      </tr>
                      ${pickupAddress ? `
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Pickup Address:</td>
                        <td style="padding: 8px 0;">${pickupAddress}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">GPS Location:</td>
                        <td style="padding: 8px 0;">Lat: ${customerLat}, Lng: ${customerLng}</td>
                      </tr>
                      ${description ? `
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Additional Info:</td>
                        <td style="padding: 8px 0;">${description}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${googleMapsLink}" 
                       style="display: inline-block; background-color: #16a34a; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                      📍 Open Location in Google Maps
                    </a>
                  </div>
                  
                  <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                      <strong>⚠️ Action Required:</strong> Please respond immediately if you can assist with this emergency.
                    </p>
                  </div>
                  
                  <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                    Best regards,<br>
                    <strong>MEDGO Emergency Response System</strong>
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 20px; padding: 15px; color: #6b7280; font-size: 12px;">
                  <p>This is an automated emergency alert. Please do not reply to this email.</p>
                  <p>For support, contact the MEDGO dispatch center.</p>
                </div>
              </body>
            </html>
          `,
        });

        if (emailError) {
          console.error(`Email error for ${driver.email}:`, emailError);
          return {
            email: driver.email,
            success: false,
            error: emailError
          };
        }

        console.log(`Email sent successfully to ${driver.email}`);
        return {
          email: driver.email,
          success: true
        };
      } catch (error) {
        console.error(`Email error for ${driver.email}:`, error);
        return {
          email: driver.email,
          success: false,
          error: error.message
        };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result && result.success);

    console.log(`Emails sent to ${successfulEmails.length} out of ${allDrivers.length} drivers`);

    // Send SMS to all drivers with phone numbers
    const smsMessage = `🚨 EMERGENCY ALERT 🚨
Type: ${emergencyType}
Patient: ${customerName}
Phone: ${customerPhone}
Location: ${pickupAddress || `Lat: ${customerLat}, Lng: ${customerLng}`}
${description ? `Details: ${description}` : ''}
View location: https://www.google.com/maps?q=${customerLat},${customerLng}`;

    const smsPromises = allDrivers
      .filter(driver => driver.phone)
      .map(async (driver) => {
        try {
          const { error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              phoneNumber: driver.phone,
              message: smsMessage
            }
          });

          if (smsError) {
            console.error(`SMS error for ${driver.phone}:`, smsError);
            return { phone: driver.phone, success: false };
          }

          console.log(`SMS sent successfully to ${driver.phone}`);
          return { phone: driver.phone, success: true };
        } catch (error) {
          console.error(`SMS error for ${driver.phone}:`, error);
          return { phone: driver.phone, success: false };
        }
      });

    const smsResults = await Promise.all(smsPromises);
    const successfulSMS = smsResults.filter(result => result && result.success);
    
    console.log(`SMS sent to ${successfulSMS.length} out of ${allDrivers.filter(d => d.phone).length} drivers with phone numbers`);

    // Insert notifications into ambulance_notifications table for in-app alerts (for all drivers)
    const notificationInserts = allDrivers.map(driver => ({
      user_id: customerId,
      driver_id: driver.user_id,
      pickup_location: `(${customerLng},${customerLat})`,
      pickup_address: pickupAddress,
      emergency_type: emergencyType,
      description: description,
      customer_name: customerName,
      customer_phone: customerPhone,
      distance_km: null, // No distance filtering anymore
      status: 'pending'
    }));

    const { error: notificationError } = await supabase
      .from('ambulance_notifications')
      .insert(notificationInserts);

    if (notificationError) {
      console.error('Error inserting notifications:', notificationError);
    } else {
      console.log(`Inserted ${notificationInserts.length} in-app notifications`);
    }

    // Audit log the email dispatch
    await supabase
      .from('sms_audit_log')
      .insert({
        user_id: customerId,
        recipient_count: successfulEmails.length,
        emergency_type: emergencyType,
        consent_given: true
      });

    return new Response(JSON.stringify({
      success: true,
      message: `Emergency alert sent to ${allDrivers.length} ambulance drivers`,
      requestId: newRequest.id,
      driversNotified: allDrivers.length,
      emailsDelivered: successfulEmails.length,
      smsDelivered: successfulSMS.length
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