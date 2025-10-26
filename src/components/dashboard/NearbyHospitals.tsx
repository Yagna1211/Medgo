import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Phone, Clock, Star, Navigation } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Hospital {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
  phone?: string;
  opening_hours?: string;
  address?: string;
  rating?: number;
  isOpen?: boolean;
}

interface NearbyHospitalsProps {
  user: any;
}

export const NearbyHospitals = ({ user }: NearbyHospitalsProps) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const getUserLocation = () => {
    setIsLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          fetchNearbyHospitals(latitude, longitude);
        },
        (error) => {
          logger.error("Error getting location:", error);
          setIsLoading(false);
          toast("Please enable location access to find nearby hospitals.");
        }
      );
    } else {
      setIsLoading(false);
      toast("Geolocation not supported by your browser.");
    }
  };

  const fetchNearbyHospitals = async (lat: number, lng: number) => {
    try {
      // Using Overpass API to fetch real hospital data from OpenStreetMap
      const radius = 5000; // 5km radius
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:${radius},${lat},${lng});
          way["amenity"="hospital"](around:${radius},${lat},${lng});
          relation["amenity"="hospital"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery,
      });

      if (!response.ok) throw new Error('Failed to fetch hospitals');

      const data = await response.json();
      
      const hospitalData: Hospital[] = data.elements
        .filter((element: any) => element.tags?.name)
        .map((element: any) => {
          const hospitalLat = element.lat || element.center?.lat;
          const hospitalLon = element.lon || element.center?.lon;
          
          if (!hospitalLat || !hospitalLon) return null;

          // Calculate distance using Haversine formula
          const distance = calculateDistance(lat, lng, hospitalLat, hospitalLon);

          return {
            id: element.id.toString(),
            name: element.tags.name,
            lat: hospitalLat,
            lon: hospitalLon,
            distance: distance,
            phone: element.tags.phone || element.tags['contact:phone'],
            opening_hours: element.tags.opening_hours,
            address: [
              element.tags['addr:street'],
              element.tags['addr:city'],
              element.tags['addr:postcode']
            ].filter(Boolean).join(', ') || 'Address not available',
            rating: element.tags.stars ? parseFloat(element.tags.stars) : undefined,
            isOpen: checkIfOpen(element.tags.opening_hours)
          };
        })
        .filter((hospital: Hospital | null) => hospital !== null)
        .sort((a: Hospital, b: Hospital) => a.distance - b.distance)
        .slice(0, 10);

      setHospitals(hospitalData);
      toast(`Found ${hospitalData.length} hospitals nearby`);
    } catch (error) {
      logger.error('Error fetching hospitals:', error);
      toast('Failed to fetch nearby hospitals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (value: number): number => {
    return value * Math.PI / 180;
  };

  const checkIfOpen = (openingHours?: string): boolean | undefined => {
    if (!openingHours) return undefined;
    if (openingHours === '24/7') return true;
    
    // Basic check - this is simplified
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    const currentHour = now.getHours();
    
    // Very basic parsing - in production, use a proper library
    if (openingHours.toLowerCase().includes(currentDay)) {
      return true; // Simplified - assume open if day matches
    }
    
    return undefined;
  };

  const openInMaps = (lat: number, lon: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
  };

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-500" />
          Nearby Hospitals
        </CardTitle>
        <CardDescription>
          Find hospitals near your location with contact information and hours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!userLocation ? (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Enable location to find hospitals near you
            </p>
            <Button onClick={getUserLocation} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finding Hospitals...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4 mr-2" />
                  Find Nearby Hospitals
                </>
              )}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading hospitals...</p>
          </div>
        ) : hospitals.length === 0 ? (
          <Alert>
            <AlertDescription>
              No hospitals found nearby. Try increasing your search radius or check your location settings.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {hospitals.map((hospital) => (
              <Card key={hospital.id} className="border-l-4 border-l-primary/50">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{hospital.name}</h3>
                        <p className="text-sm text-muted-foreground">{hospital.address}</p>
                      </div>
                      {hospital.isOpen !== undefined && (
                        <Badge variant={hospital.isOpen ? "default" : "secondary"}>
                          {hospital.isOpen ? "Open" : "Closed"}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{hospital.distance.toFixed(1)} km away</span>
                      </div>

                      {hospital.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${hospital.phone}`} className="hover:underline">
                            {hospital.phone}
                          </a>
                        </div>
                      )}

                      {hospital.opening_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{hospital.opening_hours}</span>
                        </div>
                      )}

                      {hospital.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span>{hospital.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={() => openInMaps(hospital.lat, hospital.lon, hospital.name)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Get Directions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button onClick={getUserLocation} variant="outline" className="w-full">
              <Navigation className="h-4 w-4 mr-2" />
              Refresh Hospital List
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};