import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerDashboard } from "./CustomerDashboard";
import { DriverDashboard } from "./DriverDashboard";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface DashboardProps {
  user: any;
  onLogout: () => void;
  initialView?: string;
}

export const Dashboard = ({ user, onLogout, initialView }: DashboardProps) => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch user role from user_roles table (security best practice)
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user role:', error);
          // Default to customer if no role found
          setUserProfile({ role: 'customer' });
        } else {
          setUserProfile({ role: roleData.role });
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserProfile({ role: 'customer' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [user?.id]);

  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }

  // Default to customer if no profile or role found
  const userRole = userProfile?.role || 'customer';

  if (userRole === 'driver') {
    return <DriverDashboard user={user} />;
  }

  return <CustomerDashboard user={user} />;
};