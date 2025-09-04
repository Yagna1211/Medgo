import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  User,
  Bell,
  Car,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Navigation,
  AlertTriangle
} from "lucide-react";
import { UserProfile } from "./UserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DriverDashboardProps {
  user: any;
}

interface AmbulanceRequest {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_address?: string;
  emergency_type: string;
  description?: string;
  created_at: string;
  status: string;
  customer_location: string; // This will be a PostGIS POINT string
}

export const DriverDashboard = ({ user }: DriverDashboardProps) => {
  const [activeTab, setActiveTab] = useState("requests");
  const [isAvailable, setIsAvailable] = useState(true);
  const [requests, setRequests] = useState<AmbulanceRequest[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch driver profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setProfile(profile);
          setIsAvailable(profile.is_available || false);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [user?.id]);

  // Fetch ambulance requests for this driver
  useEffect(() => {
    const fetchRequests = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('ambulance_requests')
          .select('*')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setRequests((data || []).map(req => ({
          ...req,
          customer_location: req.customer_location as string
        })));
      } catch (error) {
        console.error('Error fetching requests:', error);
        toast('Failed to load requests');
      }
    };

    fetchRequests();
  }, [user?.id]);

  const toggleAvailability = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_available: !isAvailable })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setIsAvailable(!isAvailable);
      toast(isAvailable ? 'You are now offline' : 'You are now online and available for requests');
    } catch (error) {
      console.error('Error updating availability:', error);
      toast('Failed to update availability');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('ambulance_requests')
        .update({ 
          status: newStatus,
          driver_id: newStatus === 'accepted' ? user.id : null 
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      // Update local state
      setRequests(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, status: newStatus }
          : req
      ));
      
      toast(`Request ${newStatus}`);
    } catch (error) {
      console.error('Error updating request:', error);
      toast('Failed to update request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'accepted': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                Driver Dashboard
              </h1>
              <p className="text-muted-foreground">
                Manage your ambulance requests and availability
              </p>
            </div>
            
            <Card className="p-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="availability" className="font-medium">
                  {isAvailable ? 'Online' : 'Offline'}
                </Label>
                <Switch
                  id="availability"
                  checked={isAvailable}
                  onCheckedChange={toggleAvailability}
                  disabled={isLoading}
                />
                <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </Card>
          </div>

          {profile && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span className="font-medium">Ambulance:</span> {profile.ambulance_number}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">Service Area:</span> {profile.service_area}
                  </div>
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="font-medium">Status:</span>
                    <Badge variant={isAvailable ? "default" : "secondary"}>
                      {isAvailable ? 'Available' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              My Requests
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="space-y-4">
              {requests.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Requests Yet</h3>
                    <p className="text-muted-foreground">
                      {isAvailable 
                        ? "You're online and ready to receive emergency requests."
                        : "Turn on availability to start receiving requests."
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                requests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Emergency Request
                          </CardTitle>
                          <CardDescription>
                            {formatDate(request.created_at)}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Patient</Label>
                            <p className="text-sm">{request.customer_name}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Contact</Label>
                            <p className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {request.customer_phone}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Emergency Type</Label>
                            <p className="text-sm">{request.emergency_type}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Location</Label>
                            <p className="text-sm">{request.pickup_address || 'GPS coordinates provided'}</p>
                          </div>
                        </div>
                        
                        {request.description && (
                          <div>
                            <Label className="text-sm font-medium">Additional Details</Label>
                            <p className="text-sm text-muted-foreground">{request.description}</p>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {request.status === 'pending' && (
                            <>
                              <Button 
                                onClick={() => updateRequestStatus(request.id, 'accepted')}
                                className="flex items-center gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Accept Request
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => updateRequestStatus(request.id, 'cancelled')}
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Decline
                              </Button>
                            </>
                          )}
                          
                          {request.status === 'accepted' && (
                            <Button 
                              onClick={() => updateRequestStatus(request.id, 'completed')}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Mark Complete
                            </Button>
                          )}
                          
                          <Button
                            variant="outline"
                            asChild
                          >
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${request.pickup_address || 'Emergency Location'}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <Navigation className="h-4 w-4" />
                              Get Directions
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <UserProfile user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};