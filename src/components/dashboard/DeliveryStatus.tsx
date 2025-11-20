import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";
import { CheckCircle2, XCircle, Clock, Mail, MessageSquare, Eye } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DeliveryStatusProps {
  requestId: string;
}

export const DeliveryStatus = ({ requestId }: DeliveryStatusProps) => {
  const [smsStatuses, setSmsStatuses] = useState<any[]>([]);
  const [notificationStatuses, setNotificationStatuses] = useState<any[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!requestId) return;

    const fetchStatuses = async () => {
      // Fetch SMS delivery statuses
      const { data: smsData } = await supabase
        .from('sms_delivery_status')
        .select('*')
        .eq('ambulance_request_id', requestId);

      if (smsData) setSmsStatuses(smsData);

      // Fetch notification statuses - get all notifications for this request's customer
      const { data: requestData } = await supabase
        .from('ambulance_requests')
        .select('customer_id, emergency_type')
        .eq('id', requestId)
        .single();

      if (requestData) {
        const { data: notifData } = await supabase
          .from('ambulance_notifications')
          .select('id, driver_id, status, read_at, delivered_at')
          .eq('user_id', requestData.customer_id)
          .eq('emergency_type', requestData.emergency_type);

        if (notifData) {
          setNotificationStatuses(notifData);

          // Fetch driver names
          const driverIds = notifData.map((n: any) => n.driver_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', driverIds);

          if (profiles) {
            const names: Record<string, string> = {};
            profiles.forEach((p: any) => {
              names[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Driver';
            });
            setDriverNames(names);
          }
        }
      }
    };

    fetchStatuses();

    // Subscribe to real-time updates
    const smsChannel = supabase
      .channel('sms-delivery-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'sms_delivery_status',
          filter: `ambulance_request_id=eq.${requestId}`
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setSmsStatuses(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setSmsStatuses(prev => prev.map((s: any) => 
              s.id === payload.new.id ? payload.new : s
            ));
          }
        }
      )
      .subscribe();

    const notifChannel = supabase
      .channel('notification-changes')
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ambulance_notifications'
        },
        (payload: any) => {
          setNotificationStatuses(prev => prev.map((n: any) => 
            n.id === payload.new.id ? payload.new : n
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(smsChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [requestId]);

  const getStatusIcon = (status: string, readAt: string | null) => {
    if (readAt) return <Eye className="h-4 w-4 text-blue-500" />;
    if (status === 'delivered') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (status: string, readAt: string | null) => {
    if (readAt) return <Badge className="bg-blue-500">Read</Badge>;
    if (status === 'delivered') return <Badge className="bg-green-500">Delivered</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Alert Delivery Status
        </CardTitle>
        <CardDescription>
          Track which drivers received your emergency alert
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SMS Delivery Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" />
            SMS Messages
          </div>
          {smsStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No SMS messages sent</p>
          ) : (
            <div className="space-y-2">
              {smsStatuses.map((sms: any) => (
                <div key={sms.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(sms.delivery_status, null)}
                    <div>
                      <div className="text-sm font-medium">{sms.driver_phone}</div>
                      {sms.error_message && (
                        <div className="text-xs text-red-500">{sms.error_message}</div>
                      )}
                      {sms.delivered_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(sms.delivered_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(sms.delivery_status, null)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* In-App Notification Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4" />
            In-App Notifications
          </div>
          {notificationStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications sent</p>
          ) : (
            <div className="space-y-2">
              {notificationStatuses.map((notif: any) => (
                <div key={notif.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(notif.status, notif.read_at)}
                    <div>
                      <div className="text-sm font-medium">
                        {driverNames[notif.driver_id] || 'Loading...'}
                      </div>
                      {notif.read_at && (
                        <div className="text-xs text-muted-foreground">
                          Read: {new Date(notif.read_at).toLocaleString()}
                        </div>
                      )}
                      {notif.delivered_at && !notif.read_at && (
                        <div className="text-xs text-muted-foreground">
                          Delivered: {new Date(notif.delivered_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(notif.status, notif.read_at)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="pt-3 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">SMS Delivered:</span>
            <span className="font-medium">
              {smsStatuses.filter((s: any) => s.delivery_status === 'delivered').length} / {smsStatuses.length}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Notifications Read:</span>
            <span className="font-medium">
              {notificationStatuses.filter((n: any) => n.read_at).length} / {notificationStatuses.length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
