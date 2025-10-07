import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  AlertTriangle,
  Info
} from "lucide-react";
import { UserProfile } from "./UserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

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
  customer_location: unknown;
}

interface NotificationAlert {
  id: string;
  pickup_location: string;
  emergency_type: string;
  pickup_address?: string;
  description?: string;
  distance_km?: number;
  created_at: string;
  status: string;
}

export const DriverDashboard = ({ user }: DriverDashboardProps) => {
  const [activeTab, setActiveTab] = useState("requests");
  const [requests, setRequests] = useState<AmbulanceRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationAlert[]>([]);
  const [profile, setProfile] = useState<any>(null);

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
        }
      } catch (error) {
        logger.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [user?.id]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('ambulance-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ambulance_notifications',
          filter: `driver_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as NotificationAlert;
          setNotifications(prev => [newNotification, ...prev]);
          toast(`🚨 NEW EMERGENCY REQUEST: ${newNotification.emergency_type}`);
          
          // Play notification sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(err => logger.error('Audio play failed:', err));
          } catch (err) {
            logger.error('Audio creation failed:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        if (data) setRequests(data);
      } catch (error) {
        logger.error('Error fetching requests:', error);
      }
    };

    fetchRequests();
  }, [user?.id]);

  const acceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('ambulance_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;
      
      toast.success('Request accepted!');
      
      // Refresh requests
      const { data } = await supabase
        .from('ambulance_requests')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setRequests(data);
    } catch (error) {
      logger.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Driver Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your ambulance requests and availability
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant="default" className="bg-green-500">Always Online</Badge>
          </div>
        </div>

        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            You are <strong>ALWAYS ONLINE</strong> and will receive all emergency alerts from patients.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests">
              <Car className="mr-2 h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
              {notifications.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No requests yet</p>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{request.emergency_type}</CardTitle>
                        <CardDescription>
                          Request ID: {request.id.slice(0, 8)}...
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          request.status === 'accepted' ? 'default' :
                          request.status === 'pending' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center text-sm">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{request.customer_name}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{request.customer_phone}</span>
                    </div>
                    {request.pickup_address && (
                      <div className="flex items-center text-sm">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{request.pickup_address}</span>
                      </div>
                    )}
                    {request.description && (
                      <div className="flex items-start text-sm">
                        <Info className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{request.description}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>{new Date(request.created_at).toLocaleString()}</span>
                    </div>
                    
                    {request.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={() => acceptRequest(request.id)}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Accept Request
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications</p>
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card key={notification.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-red-600">
                          🚨 {notification.emergency_type}
                        </CardTitle>
                        <CardDescription>
                          {notification.distance_km && 
                            `${notification.distance_km.toFixed(1)} km away`
                          }
                        </CardDescription>
                      </div>
                      <Badge variant="destructive">
                        {notification.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {notification.pickup_address && (
                      <div className="flex items-center text-sm">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{notification.pickup_address}</span>
                      </div>
                    )}
                    {notification.description && (
                      <div className="flex items-start text-sm">
                        <Info className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{notification.description}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="profile">
            <UserProfile user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
