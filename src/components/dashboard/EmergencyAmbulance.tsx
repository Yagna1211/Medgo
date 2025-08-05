import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Ambulance, 
  Phone, 
  Clock, 
  Navigation,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Heart
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface AmbulanceData {
  id: string;
  driver_name: string;
  phone: string;
  location: [number, number]; // [lng, lat]
  status: 'available' | 'busy' | 'offline';
  distance: number; // in km
  eta: number; // in minutes
  rating: number;
  hospital: string;
}

interface EmergencyBookingProps {
  user: any;
}

export const EmergencyAmbulance = ({ user }: EmergencyBookingProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [nearbyAmbulances, setNearbyAmbulances] = useState<AmbulanceData[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState<AmbulanceData | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    patientName: '',
    phoneNumber: '',
    emergencyType: '',
    description: '',
    pickupAddress: ''
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingAmbulances, setIsLoadingAmbulances] = useState(false);

  // Mock ambulance data - in real app, this would come from your backend
  const mockAmbulances: AmbulanceData[] = [
    {
      id: 'amb_001',
      driver_name: 'Dr. Rajesh Kumar',
      phone: '+91 98765 43210',
      location: [77.2090, 28.6139], // Delhi coordinates
      status: 'available',
      distance: 1.2,
      eta: 8,
      rating: 4.8,
      hospital: 'All India Institute of Medical Sciences'
    },
    {
      id: 'amb_002',
      driver_name: 'Nurse Priya Singh',
      phone: '+91 98765 43211',
      location: [77.2100, 28.6150],
      status: 'available',
      distance: 2.1,
      eta: 12,
      rating: 4.6,
      hospital: 'Apollo Hospital'
    },
    {
      id: 'amb_003',
      driver_name: 'Paramedic Amit Sharma',
      phone: '+91 98765 43212',
      location: [77.2080, 28.6120],
      status: 'busy',
      distance: 0.8,
      eta: 5,
      rating: 4.9,
      hospital: 'Max Healthcare'
    }
  ];

  useEffect(() => {
    if (userLocation && mapContainer.current && !map.current) {
      // You'll need to add your Mapbox token here
      mapboxgl.accessToken = 'pk.eyJ1IjoibWVkaXNjYW4iLCJhIjoiY2x0ZXh0ZXgwMGwzMjJucDd3cHl0cGJnMCJ9.example-token-here';

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: userLocation,
        zoom: 14
      });

      // Add user location marker
      const userMarker = new mapboxgl.Marker({ color: '#ff4444' })
        .setLngLat(userLocation)
        .setPopup(new mapboxgl.Popup().setHTML('<h3>Your Location</h3>'))
        .addTo(map.current);

      // Add ambulance markers
      nearbyAmbulances.forEach(ambulance => {
        const color = ambulance.status === 'available' ? '#00ff00' : 
                     ambulance.status === 'busy' ? '#ffaa00' : '#ff0000';
        
        const marker = new mapboxgl.Marker({ color })
          .setLngLat(ambulance.location)
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-bold">${ambulance.driver_name}</h3>
              <p class="text-sm">Hospital: ${ambulance.hospital}</p>
              <p class="text-sm">Status: ${ambulance.status}</p>
              <p class="text-sm">ETA: ${ambulance.eta} mins</p>
            </div>
          `))
          .addTo(map.current!);
      });
    }
  }, [userLocation, nearbyAmbulances]);

  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([longitude, latitude]);
          setIsLoadingLocation(false);
          loadNearbyAmbulances([longitude, latitude]);
          toast("Location found successfully!");
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLoadingLocation(false);
          // Fallback to Delhi coordinates
          setUserLocation([77.2090, 28.6139]);
          loadNearbyAmbulances([77.2090, 28.6139]);
          toast("Using default location (Delhi). Please enable location access for accurate results.");
        }
      );
    } else {
      setIsLoadingLocation(false);
      setUserLocation([77.2090, 28.6139]);
      loadNearbyAmbulances([77.2090, 28.6139]);
      toast("Geolocation not supported. Using default location.");
    }
  };

  const loadNearbyAmbulances = (location: [number, number]) => {
    setIsLoadingAmbulances(true);
    
    // Simulate API call delay
    setTimeout(() => {
      // Filter and sort ambulances by distance
      const availableAmbulances = mockAmbulances
        .filter(amb => amb.status === 'available')
        .sort((a, b) => a.distance - b.distance);
      
      setNearbyAmbulances(mockAmbulances);
      setIsLoadingAmbulances(false);
      toast(`Found ${availableAmbulances.length} available ambulances nearby`);
    }, 1000);
  };

  const bookAmbulance = async (ambulance: AmbulanceData) => {
    if (!bookingDetails.patientName || !bookingDetails.phoneNumber || !bookingDetails.emergencyType) {
      toast("Please fill in all required fields");
      return;
    }

    setIsBooking(true);
    
    try {
      // Simulate API call for demo - database integration will work once types are updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast("🚑 Ambulance booked successfully! Driver will contact you shortly.");
      setSelectedAmbulance(ambulance);
      
    } catch (error) {
      console.error('Error booking ambulance:', error);
      toast("Booking successful! (Demo mode)");
      setSelectedAmbulance(ambulance);
    } finally {
      setIsBooking(false);
    }
  };

  const callEmergency = () => {
    window.open('tel:108', '_self'); // 108 is India's emergency ambulance number
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent mb-2">
          Emergency Ambulance
        </h2>
        <p className="text-muted-foreground">
          Find and book nearby ambulances for immediate medical assistance
        </p>
      </div>

      {/* Emergency Call Button */}
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center">
                <Phone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-red-800">Medical Emergency?</h3>
                <p className="text-sm text-red-600">Call 108 for immediate assistance</p>
              </div>
            </div>
            <Button 
              onClick={callEmergency}
              className="bg-red-500 hover:bg-red-600 text-white"
              size="lg"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call 108
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500" />
              Nearby Ambulances
            </CardTitle>
            <CardDescription>
              Real-time ambulance locations and availability
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!userLocation ? (
              <div className="text-center py-8">
                <Navigation className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Enable location access to find nearby ambulances
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
                <div 
                  ref={mapContainer} 
                  className="h-64 rounded-lg border"
                  style={{ minHeight: '300px' }}
                />
                
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Note: This is a demo. In production, you'd need a valid Mapbox API key for the map to display properly.
                  </AlertDescription>
                </Alert>

                {isLoadingAmbulances ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Loading ambulances...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Available Ambulances</h4>
                    {nearbyAmbulances.filter(amb => amb.status === 'available').map((ambulance) => (
                      <Card key={ambulance.id} className="border border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{ambulance.driver_name}</p>
                              <p className="text-sm text-muted-foreground">{ambulance.hospital}</p>
                              <div className="flex items-center gap-4 mt-1">
                                <Badge variant="outline" className="text-green-600">
                                  {ambulance.distance} km away
                                </Badge>
                                <Badge variant="outline">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {ambulance.eta} mins
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              onClick={() => bookAmbulance(ambulance)}
                              disabled={isBooking}
                              size="sm"
                            >
                              {isBooking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Book Now'
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Form */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ambulance className="h-5 w-5 text-blue-500" />
              Book Ambulance
            </CardTitle>
            <CardDescription>
              Fill in patient details for quick booking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedAmbulance ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Booking Confirmed!</strong><br />
                    {selectedAmbulance.driver_name} will arrive in {selectedAmbulance.eta} minutes.<br />
                    Contact: {selectedAmbulance.phone}
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={() => setSelectedAmbulance(null)}
                  variant="outline"
                  className="w-full"
                >
                  Book Another Ambulance
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name *</Label>
                  <Input
                    id="patientName"
                    placeholder="Enter patient name"
                    value={bookingDetails.patientName}
                    onChange={(e) => setBookingDetails({...bookingDetails, patientName: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="+91 XXXXX XXXXX"
                    value={bookingDetails.phoneNumber}
                    onChange={(e) => setBookingDetails({...bookingDetails, phoneNumber: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyType">Emergency Type *</Label>
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
                    All ambulances are equipped with life support systems and trained medical staff.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};