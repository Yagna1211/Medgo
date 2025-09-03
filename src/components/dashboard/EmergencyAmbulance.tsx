import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Ambulance, 
  Phone, 
  Navigation,
  Loader2,
  Heart
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceTrigger } from "@/hooks/use-voice-trigger";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
interface EmergencyBookingProps {
  user: any;
}

export const EmergencyAmbulance = ({ user }: EmergencyBookingProps) => {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    patientName: '',
    phoneNumber: '',
    emergencyType: 'Medical Emergency',
    description: '',
    pickupAddress: ''
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const radiusKm = 5;
  const [drivers, setDrivers] = useState<{ driver_id: string; lat: number; lng: number; distance_km: number }[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  // Auto-fill user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, emergency_contact_name, emergency_contact_phone')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setUserProfile(profile);
          setBookingDetails(prev => ({
            ...prev,
            patientName: profile.first_name && profile.last_name 
              ? `${profile.first_name} ${profile.last_name}`.trim()
              : profile.emergency_contact_name || '',
            phoneNumber: profile.phone || profile.emergency_contact_phone || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchUserProfile();
  }, [user?.id]);

  const sendAlerts = async () => {
    if (!userLocation) {
      toast("Please get your location first");
      return;
    }
    // Auto-fill missing data from profile if available
    const finalDetails = {
      patientName: bookingDetails.patientName || 
        (userProfile?.first_name && userProfile?.last_name 
          ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
          : userProfile?.emergency_contact_name || 'Emergency Patient'),
      phoneNumber: bookingDetails.phoneNumber || 
        userProfile?.phone || 
        userProfile?.emergency_contact_phone || 
        'Contact Emergency Services',
      emergencyType: bookingDetails.emergencyType || 'Medical Emergency'
    };
    setIsBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-ambulance', {
        body: {
          lat: userLocation[1],
          lng: userLocation[0],
          radiusKm,
          emergencyType: finalDetails.emergencyType,
          description: bookingDetails.description,
          pickupAddress: bookingDetails.pickupAddress,
        }
      });
      if (error) throw error;
      toast(`Emergency alert sent to ${data?.notified ?? 0} nearby ambulances! Help is on the way.`);
      
      // Also call emergency number automatically
      setTimeout(() => {
        if (window.confirm('Would you like to call emergency services directly as well?')) {
          callEmergency();
        }
      }, 1000);
    } catch (e) {
      console.error('Dispatch error', e);
      toast("Failed to send alerts. Calling emergency services...");
      // Fallback to direct emergency call
      setTimeout(callEmergency, 500);
    } finally {
      setIsBooking(false);
    }
  };

  const { listening, start, stop } = useVoiceTrigger({
    phrase: /(\bcall (an )?ambulance\b)/i,
    onTrigger: () => {
      if (!userLocation) {
        toast("Voice detected: Please get your location first");
        return;
      }
      toast("Voice command detected: Calling ambulance...");
      sendAlerts();
    }
  });

  const fetchNearby = async () => {
    if (!userLocation) return;
    try {
      const { data, error } = await supabase.functions.invoke('nearby-ambulances', {
        body: { lat: userLocation[1], lng: userLocation[0], radiusKm }
      });
      if (error) throw error;
      setDrivers(data?.drivers ?? []);
      toast(`Found ${data?.count ?? 0} nearby ambulances`);
    } catch (e) {
      console.error('nearby error', e);
      toast('Failed to load nearby ambulances');
    }
  };

  const drawRoute = async () => {
    if (!userLocation) return;
    if (!bookingDetails.pickupAddress) {
      toast('Enter a pickup address first');
      return;
    }
    try {
      const geo = await supabase.functions.invoke('ors-proxy', {
        body: { action: 'geocode', text: bookingDetails.pickupAddress }
      });
      const { lat, lng } = geo.data || {};
      if (!lat || !lng) throw new Error('Geocoding failed');
      const route = await supabase.functions.invoke('ors-proxy', {
        body: { action: 'route', start: [userLocation[0], userLocation[1]], end: [lng, lat] }
      });
      const coords = (route.data?.coordinates || []).map((c: [number, number]) => [c[1], c[0]] as [number, number]);
      setRouteCoords(coords);
    } catch (e) {
      console.error('route error', e);
      toast('Failed to draw route');
    }
  };

  const sendWhatsApp = async () => {
    try {
      const patientName = bookingDetails.patientName || 
        (userProfile?.first_name && userProfile?.last_name 
          ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
          : 'Emergency Patient');
      const phoneNumber = bookingDetails.phoneNumber || 
        userProfile?.phone || 
        userProfile?.emergency_contact_phone || 
        'Contact Emergency Services';
      
      const msg = `🚨 EMERGENCY ALERT 🚨\nType: ${bookingDetails.emergencyType}\nPatient: ${patientName} (${phoneNumber})\nLocation: ${userLocation?.[1]}, ${userLocation?.[0]}\nAddress: ${bookingDetails.pickupAddress}\nDetails: ${bookingDetails.description}`;
      const { error } = await supabase.functions.invoke('send-callmebot', { body: { text: msg } });
      if (error) throw error;
      toast('WhatsApp alert sent');
    } catch (e: any) {
      if (e?.message?.includes('CALLMEBOT')) {
        toast('WhatsApp not configured. Add CALLMEBOT_API_KEY and CALLMEBOT_PHONE in Supabase secrets.');
      } else {
        toast('Failed to send WhatsApp alert');
      }
    }
  };


const getCurrentLocation = () => {
  setIsLoadingLocation(true);
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([longitude, latitude]);
        setIsLoadingLocation(false);
        toast("Location found successfully!");
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsLoadingLocation(false);
        toast("Please enable location access for accurate results.");
      }
    );
  } else {
    setIsLoadingLocation(false);
    toast("Geolocation not supported.");
  }
};



  const callEmergency = () => {
    window.open('tel:108', '_self'); // 108 is India's emergency ambulance number
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-destructive to-primary bg-clip-text text-transparent mb-2">
          Emergency Ambulance
        </h2>
        <p className="text-muted-foreground">
          Find and book nearby ambulances for immediate medical assistance
        </p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
<Card className="border-primary/10">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <MapPin className="h-5 w-5 text-red-500" />
      Nearby Ambulances
    </CardTitle>
    <CardDescription>
      Share your GPS and send alerts to drivers within {radiusKm} km
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {!userLocation ? (
      <div className="text-center py-8">
        <Navigation className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">
          Enable location access to notify nearby ambulances
        </p>
        <Button onClick={getCurrentLocation} disabled={isLoadingLocation}>
          {isLoadingLocation ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Getting Location...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" />
              Get My Location
            </>
          )}
        </Button>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Location detected:
              <div className="font-medium text-foreground">Lat {userLocation[1].toFixed(5)}, Lng {userLocation[0].toFixed(5)}</div>
            </div>
            <div className="flex items-center gap-2">
              {!listening ? (
                <Button variant="outline" size="sm" onClick={start}>
                  <Navigation className="h-4 w-4 mr-2" />
                  Enable Voice: "Call Ambulance"
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={stop}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Voice Listening...
                  </div>
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={fetchNearby}>
              <MapPin className="h-4 w-4 mr-2" />
              Show nearby
            </Button>
            <Button variant="outline" size="sm" onClick={drawRoute}>
              <Navigation className="h-4 w-4 mr-2" />
              Draw route
            </Button>
            <Button variant="outline" size="sm" onClick={sendWhatsApp}>
              <Phone className="h-4 w-4 mr-2" />
              WhatsApp alert
            </Button>
            <Button onClick={sendAlerts} disabled={isBooking} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {isBooking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Ambulance className="h-4 w-4 mr-2" />
                  🚨 Call Ambulance Now
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={callEmergency} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Phone className="h-4 w-4 mr-2" />
              📞 Emergency Call (108)
            </Button>
          </div>
        </div>

        <div className="h-64 w-full rounded-md overflow-hidden">
          <MapContainer center={[userLocation[1], userLocation[0]]} zoom={14} className="h-full w-full">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker center={[userLocation[1], userLocation[0]]} radius={10}>
              <Popup>You are here</Popup>
            </CircleMarker>
            {drivers.map((d) => (
              <CircleMarker key={d.driver_id} center={[d.lat, d.lng]} radius={8} pathOptions={{ color: '#ef4444' }}>
                <Popup>Ambulance • {d.distance_km.toFixed(1)} km away</Popup>
              </CircleMarker>
            ))}
            {routeCoords.length > 0 && (
              <Polyline positions={routeCoords} pathOptions={{ color: '#16a34a' }} />
            )}
          </MapContainer>
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${userLocation[1]},${userLocation[0]}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center text-sm underline"
        >
          Open destination in Google Maps
        </a>
        <div>
          <Button variant="outline" onClick={sendWhatsApp}>Send WhatsApp alert (optional)</Button>
        </div>
      </div>
    )}
  </CardContent>
</Card>

        {/* Booking Form */}
<Card className="border-primary/10">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Ambulance className="h-5 w-5 text-blue-500" />
      Send Ambulance Alerts
    </CardTitle>
    <CardDescription>
      Fill in details and send real-time notifications to nearby drivers
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-4">
        <div className="space-y-2">
        <Label htmlFor="patientName">Patient Name (Auto-filled from profile)</Label>
        <Input
          id="patientName"
          placeholder="Will use profile name if empty"
          value={bookingDetails.patientName}
          onChange={(e) => setBookingDetails({...bookingDetails, patientName: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number (Auto-filled from profile)</Label>
        <Input
          id="phoneNumber"
          placeholder="Will use profile phone if empty"
          value={bookingDetails.phoneNumber}
          onChange={(e) => setBookingDetails({...bookingDetails, phoneNumber: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyType">Emergency Type</Label>
        <Input
          id="emergencyType"
          placeholder="e.g., Heart Attack, Accident, etc."
          value={bookingDetails.emergencyType}
          onChange={(e) => setBookingDetails({...bookingDetails, emergencyType: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pickupAddress">Pickup Address</Label>
        <Input
          id="pickupAddress"
          placeholder="Enter pickup address"
          value={bookingDetails.pickupAddress}
          onChange={(e) => setBookingDetails({...bookingDetails, pickupAddress: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Additional Details</Label>
        <Textarea
          id="description"
          placeholder="Any additional information for the medical team..."
          value={bookingDetails.description}
          onChange={(e) => setBookingDetails({...bookingDetails, description: e.target.value})}
          rows={3}
        />
      </div>

      <Alert>
        <Heart className="h-4 w-4" />
        <AlertDescription>
          ⚡ One-click emergency: Auto-fills your profile data and sends instant alerts to nearby drivers.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button onClick={sendAlerts} disabled={isBooking || !userLocation} className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
          {isBooking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Alerting Ambulances...
            </>
          ) : (
            <>🚨 Send Emergency Alert</>
          )}
        </Button>
        <Button onClick={callEmergency} variant="outline" disabled={isBooking} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
          📞 Call 108
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
      </div>
    </div>
  );
};