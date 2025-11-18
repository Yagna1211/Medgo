import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Bell, Car, Phone, MapPin, Clock, CheckCircle, XCircle, Navigation, AlertTriangle, Info } from "lucide-react";
import { UserProfile } from "./UserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { 
  registerServiceWorker, 
  requestNotificationPermission, 
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  checkPushSubscription 
} from "@/utils/pushNotifications";
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
  customer_location?: unknown;
  user_id?: string;
}

interface DriverHistory {
  id: string;
  customer_name: string;
  customer_phone: string;
  emergency_type: string;
  pickup_address?: string;
  action: 'accepted' | 'rejected';
  created_at: string;
  completed_at?: string;
}
interface NotificationAlert {
  id: string;
  pickup_location: unknown;
  emergency_type: string;
  pickup_address?: string;
  description?: string;
  distance_km?: number;
  created_at: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  user_id: string;
}
export const DriverDashboard = ({
  user
}: DriverDashboardProps) => {
  const [activeTab, setActiveTab] = useState("requests");
  const [isAvailable, setIsAvailable] = useState(false);
  const [requests, setRequests] = useState<AmbulanceRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationAlert[]>([]);
  const [history, setHistory] = useState<DriverHistory[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Check location permission on mount
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({
        name: 'geolocation'
      }).then(result => {
        setLocationPermission(result.state);
      });
    }
  }, []);

  // Initialize push notifications
  useEffect(() => {
    const initPushNotifications = async () => {
      if (!user?.id) return;

      // Register service worker
      await registerServiceWorker();

      // Check notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
        
        // Check if already subscribed
        const isSubscribed = await checkPushSubscription();
        setPushNotificationsEnabled(isSubscribed);
      }
    };

    initPushNotifications();
  }, [user?.id]);

  const handleTogglePushNotifications = async () => {
    if (!user?.id) return;

    try {
      if (!pushNotificationsEnabled) {
        // Request permission and subscribe
        const hasPermission = await requestNotificationPermission();
        
        if (!hasPermission) {
          toast.error('Notification permission denied. Please enable notifications in your browser settings.');
          return;
        }

        await subscribeToPushNotifications(user.id);
        setPushNotificationsEnabled(true);
        setNotificationPermission('granted');
        toast.success('Push notifications enabled! You\'ll receive alerts even when the app is in the background.');
      } else {
        // Unsubscribe
        await unsubscribeFromPushNotifications(user.id);
        setPushNotificationsEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch (error) {
      logger.error('Error toggling push notifications:', error);
      toast.error('Failed to update push notification settings');
    }
  };

  // Fetch driver profile and driver_status
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      try {
        const {
          data: profile
        } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
        if (profile) {
          setProfile(profile);
        }

        // Check driver_status for availability
        const {
          data: status
        } = await supabase.from('driver_status').select('available').eq('user_id', user.id).maybeSingle();
        if (status) {
          setIsAvailable(status.available);
        }
      } catch (error) {
        logger.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, [user?.id]);

  // Subscribe to realtime notifications (both INSERT and UPDATE)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('ambulance-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ambulance_notifications',
        filter: `driver_id=eq.${user.id}`
      }, payload => {
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
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ambulance_notifications',
        filter: `driver_id=eq.${user.id}`
      }, payload => {
        const updatedNotification = payload.new as NotificationAlert;
        console.log('Received UPDATE event:', updatedNotification);
        
        // If status changed to 'accepted', update the UI to show "Already accepted"
        if (updatedNotification.status === 'accepted') {
          console.log('Notification accepted by another driver:', updatedNotification.id);
          toast.info('⚠️ Request already accepted by another driver');
        }
        
        setNotifications(prev => 
          prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
        );
      })
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
        const {
          data,
          error
        } = await supabase.from('ambulance_requests').select('*').eq('driver_id', user.id).order('created_at', {
          ascending: false
        });
        if (error) throw error;
        if (data) setRequests(data);
      } catch (error) {
        logger.error('Error fetching requests:', error);
      }
    };
    fetchRequests();
  }, [user?.id]);

  // Fetch existing notifications for this driver (only pending)
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('ambulance_notifications')
          .select('*')
          .eq('driver_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) setNotifications(data as NotificationAlert[]);
      } catch (error) {
        logger.error('Error fetching notifications:', error);
      }
    };
    fetchNotifications();
  }, [user?.id]);

  // Fetch driver history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('driver_request_history')
          .select('*')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) setHistory(data as DriverHistory[]);
      } catch (error) {
        logger.error('Error fetching history:', error);
      }
    };
    fetchHistory();
  }, [user?.id]);
  const toggleAvailability = async () => {
    console.log('Toggle clicked, user:', user?.id);
    if (!user?.id) {
      console.error('No user ID found');
      toast.error('User not authenticated');
      return;
    }
    setIsLoading(true);
    console.log('Requesting geolocation...');
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      // Get current location (will prompt for permission if needed)
      navigator.geolocation.getCurrentPosition(async position => {
        console.log('Geolocation success:', position.coords);
        const {
          latitude,
          longitude
        } = position.coords;
        const location = `POINT(${longitude} ${latitude})`;

        // Update permission state
        setLocationPermission('granted');
        const newAvailability = !isAvailable;
        console.log('Updating driver status to:', newAvailability);

        // Upsert driver_status
        const {
          data,
          error
        } = await supabase.from('driver_status').upsert({
          user_id: user.id,
          available: newAvailability,
          location: location,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        }).select();
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        console.log('Status updated successfully:', data);
        setIsAvailable(newAvailability);
        toast.success(newAvailability ? '✅ You are now ONLINE' : '⚫ You are now OFFLINE');
        setIsLoading(false);
      }, error => {
        console.error('Geolocation error:', error);
        setLocationPermission('denied');
        let errorMessage = 'Location access denied. ';
        if (error.code === 1) {
          errorMessage += 'Please enable location permission in your browser settings.';
        } else if (error.code === 2) {
          errorMessage += 'Location unavailable. Please try again.';
        } else if (error.code === 3) {
          errorMessage += 'Location request timed out. Please try again.';
        }
        toast.error(errorMessage);
        setIsLoading(false);
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } catch (error) {
      console.error('Error toggling availability:', error);
      logger.error('Error toggling availability:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update availability');
      setIsLoading(false);
    }
  };
  const acceptNotification = async (notification: NotificationAlert) => {
    try {
      // Extract location coordinates
      const locationStr = notification.pickup_location as any;
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (typeof locationStr === 'string') {
        const match = locationStr.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      }

      // Use database function to update ALL notifications for this emergency
      // This bypasses RLS to ensure all drivers see the update
      const { error: rpcError } = await supabase.rpc('accept_emergency_request', {
        p_user_id: notification.user_id,
        p_emergency_type: notification.emergency_type,
        p_accepting_driver_id: user.id
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }

      // Add to history with actual customer details
      await supabase
        .from('driver_request_history')
        .insert({
          driver_id: user.id,
          customer_name: notification.customer_name || 'Emergency Request',
          customer_phone: notification.customer_phone || 'N/A',
          emergency_type: notification.emergency_type,
          pickup_address: notification.pickup_address,
          action: 'accepted'
        });

      // Update UI - mark this notification as accepted instead of removing
      setNotifications(prev => 
        prev.map(n => 
          n.user_id === notification.user_id && n.emergency_type === notification.emergency_type
            ? { ...n, status: 'accepted' }
            : n
        )
      );
      
      // Refresh history
      const { data: historyData } = await supabase
        .from('driver_request_history')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });
      if (historyData) setHistory(historyData as DriverHistory[]);

      toast.success('Request accepted! Opening directions...');

      // Open Google Maps with directions
      if (lat && lng) {
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        window.open(mapsUrl, '_blank');
      }
    } catch (error) {
      logger.error('Error accepting notification:', error);
      toast.error('Failed to accept request');
    }
  };

  const rejectNotification = async (notification: NotificationAlert) => {
    try {
      // Delete notification
      await supabase
        .from('ambulance_notifications')
        .delete()
        .eq('id', notification.id);

      // Add to history with actual customer details
      await supabase
        .from('driver_request_history')
        .insert({
          driver_id: user.id,
          customer_name: notification.customer_name || 'Emergency Request',
          customer_phone: notification.customer_phone || 'N/A',
          emergency_type: notification.emergency_type,
          pickup_address: notification.pickup_address,
          action: 'rejected'
        });

      // Remove from notifications
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      
      // Refresh history
      const { data: historyData } = await supabase
        .from('driver_request_history')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });
      if (historyData) setHistory(historyData as DriverHistory[]);

      toast.success('Request rejected');
    } catch (error) {
      logger.error('Error rejecting notification:', error);
      toast.error('Failed to reject request');
    }
  };
  return <div className="min-h-screen bg-background p-6">
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

        {/* Push Notifications Card */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <Label htmlFor="push-notifications" className="text-base font-medium cursor-pointer">
                    Push Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get alerts even when the app is in background
                  </p>
                </div>
              </div>
              <Switch
                id="push-notifications"
                checked={pushNotificationsEnabled}
                onCheckedChange={handleTogglePushNotifications}
                disabled={notificationPermission === 'denied'}
              />
            </div>
            {notificationPermission === 'denied' && (
              <Alert className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Notifications are blocked. Please enable them in your browser settings.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requests">
              <Car className="mr-2 h-4 w-4" />
              Requests
              {notifications.length > 0 && <Badge variant="destructive" className="ml-2">
                  {notifications.length}
                </Badge>}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            {notifications.length === 0 ? <Card>
                <CardContent className="p-12 text-center">
                  <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No emergency requests</p>
                </CardContent>
              </Card> : notifications.map(notification => {
                const isAccepted = notification.status === 'accepted';
                
                return (
                  <Card key={notification.id} className="border-red-500">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-red-600">
                            🚨 {notification.emergency_type}
                          </CardTitle>
                          <CardDescription>
                            {notification.distance_km && `${notification.distance_km.toFixed(1)} km away`}
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">
                          URGENT
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {notification.customer_name && (
                        <div className="flex items-center text-sm">
                          <User className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Patient: {notification.customer_name}</span>
                        </div>
                      )}
                      {notification.customer_phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>Contact: {notification.customer_phone}</span>
                        </div>
                      )}
                      {notification.pickup_address && <div className="flex items-center text-sm">
                          <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{notification.pickup_address}</span>
                        </div>}
                      {notification.description && <div className="flex items-start text-sm">
                          <Info className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
                          <span>{notification.description}</span>
                        </div>}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                      </div>
                      
                      {isAccepted ? (
                        <Alert className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Already accepted by another ambulance driver
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            onClick={() => acceptNotification(notification)} 
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                          <Button 
                            onClick={() => rejectNotification(notification)} 
                            variant="destructive"
                            className="flex-1"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Notifications</CardTitle>
                <CardDescription>View all emergency notifications sent to you</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Active emergency requests appear in the Requests tab. Use Accept/Reject buttons to respond.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request History</CardTitle>
                <CardDescription>
                  Track your accepted and rejected requests
                </CardDescription>
              </CardHeader>
            </Card>

            {history.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No history yet</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{history.length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-600">Accepted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {history.filter(h => h.action === 'accepted').length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-600">Rejected</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {history.filter(h => h.action === 'rejected').length}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  {history.map(record => (
                    <Card key={record.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{record.emergency_type}</CardTitle>
                          <Badge variant={record.action === 'accepted' ? 'default' : 'destructive'}>
                            {record.action}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {record.pickup_address && (
                          <div className="flex items-center text-sm">
                            <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>{record.pickup_address}</span>
                          </div>
                        )}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>{new Date(record.created_at).toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="profile">
            <UserProfile user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};