import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Heart,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceTrigger } from "@/hooks/use-voice-trigger";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import { emergencyBookingSchema } from "@/lib/validationSchemas";
import { logger } from "@/lib/logger";
import { DeliveryStatus } from "./DeliveryStatus";
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
  const [consentGiven] = useState(true); // Always consent in emergency
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const radiusKm = 5;
  const [drivers, setDrivers] = useState<{ driver_id: string; lat: number; lng: number; distance_km: number }[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  // Auto-request location on mount and fetch user profile
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
        logger.error('Error fetching profile:', error);
      }
    };

    fetchUserProfile();
    
    // Auto-request location on component mount
    getCurrentLocation();
  }, [user?.id]);

  const sendAlerts = async () => {
    if (!userLocation) {
      toast("Please get your location first");
      return;
    }
    
    // Auto-fill missing data from profile if available
    const customerName = bookingDetails.patientName || 
      (userProfile?.first_name && userProfile?.last_name 
        ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
        : userProfile?.emergency_contact_name || 'Emergency Patient');
    
    const customerPhone = bookingDetails.phoneNumber || 
      userProfile?.phone || 
      userProfile?.emergency_contact_phone || 
      '';

    // Validate input using zod schema
    try {
      emergencyBookingSchema.parse({
        patientName: customerName,
        patientPhone: customerPhone,
        emergencyType: bookingDetails.emergencyType,
        pickupAddress: bookingDetails.pickupAddress,
        additionalInfo: bookingDetails.description
      });
    } catch (validationError: any) {
      const firstError = validationError.issues?.[0]?.message || 'Please fill in all required fields correctly';
      toast(firstError);
      return;
    }

    setIsBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-driver-alerts', {
        body: {
          customerId: user.id,
          customerName,
          customerPhone,
          customerLat: userLocation[1],
          customerLng: userLocation[0],
          emergencyType: bookingDetails.emergencyType,
          description: bookingDetails.description,
          pickupAddress: bookingDetails.pickupAddress
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setLastRequestId(data.requestId); // Store request ID for delivery status
        toast.success(`🚨 Emergency alert sent to ${data.driversNotified} nearby ambulance drivers! Help is on the way.`);
      } else {
        toast.error(data?.message || "No available drivers found nearby. Please try emergency services: 108");
      }
    } catch (e) {
      logger.error('Emergency alert error:', e);
      toast.error("Failed to send emergency alerts. Please call 108 immediately!");
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
      logger.error('nearby error', e);
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
      logger.error('route error', e);
      toast('Failed to draw route');
    }
  };

  const sendSMS = async () => {
    try {
      const patientName = bookingDetails.patientName || 
        (userProfile?.first_name && userProfile?.last_name 
          ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
          : 'Emergency Patient');
      const phoneNumber = bookingDetails.phoneNumber || 
        userProfile?.phone || 
        userProfile?.emergency_contact_phone;
      
      if (!phoneNumber) {
        toast('No phone number available for SMS');
        return;
      }
      
      const msg = `🚨 EMERGENCY ALERT 🚨\nType: ${bookingDetails.emergencyType}\nPatient: ${patientName}\nLocation: ${userLocation?.[1]}, ${userLocation?.[0]}\nAddress: ${bookingDetails.pickupAddress}\nDetails: ${bookingDetails.description}`;
      const { error } = await supabase.functions.invoke('send-sms', { 
        body: { phoneNumber, message: msg } 
      });
      if (error) throw error;
      toast('Emergency SMS sent successfully');
    } catch (e: any) {
      if (e?.message?.includes('FAST2SMS')) {
        toast('SMS service not configured. Please contact support.');
      } else {
        toast('Failed to send SMS: ' + (e.message || 'Unknown error'));
      }
    }
  };


const getCurrentLocation = () => {
  setIsLoadingLocation(true);
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([longitude, latitude]);
        setIsLoadingLocation(false);
        toast("Location found successfully!");
        
        // Auto-fill pickup address using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (data.display_name) {
            setBookingDetails(prev => ({
              ...prev,
              pickupAddress: data.display_name
            }));
          }
        } catch (error) {
          logger.error("Error reverse geocoding:", error);
        }
      },
      (error) => {
        logger.error("Error getting location:", error);
        setIsLoadingLocation(false);
        toast("Please enable location access for accurate results.");
      }
    );
  } else {
    setIsLoadingLocation(false);
    toast("Geolocation not supported.");
  }
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

      {/* Show delivery status if request was sent */}
      {lastRequestId && (
        <DeliveryStatus requestId={lastRequestId} />
      )}

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
            <Button onClick={sendAlerts} disabled={isBooking} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {isBooking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Emergency Alert...
                </>
              ) : (
                <>
                  <Ambulance className="h-4 w-4 mr-2" />
                  🚨 Call Ambulance Now
                </>
              )}
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
          Open location in Google Maps
        </a>
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
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          🚨 Emergency mode: Location auto-requested, profile auto-filled, and your information will be shared with all ambulance drivers for immediate assistance.
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
      </div>
    </div>
  </CardContent>
</Card>
      </div>
    </div>
  );
};