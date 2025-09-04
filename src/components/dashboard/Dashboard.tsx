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
    const fetchUserProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        setUserProfile(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
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