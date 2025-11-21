import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Stethoscope, 
  Pill, 
  Ambulance, 
  History, 
  Shield, 
  Heart, 
  Brain,
  Zap,
  MapPin,
  Clock,
  Star,
  ChevronRight,
  Menu,
  User,
  LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Dashboard } from "@/components/dashboard/Dashboard";

const Index = () => {
  const { user, loading, signOut, incrementInteraction } = useAuth();
  const [activeView, setActiveView] = useState('home');

  const handleFeatureClick = (feature: string) => {
    incrementInteraction();
    
    if (user) {
      setActiveView(feature);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

// If user is logged in, take them to their dashboard (role-based)
if (user) {
  return <Dashboard user={user} onLogout={signOut} initialView={activeView !== 'home' ? activeView : undefined} />;
}

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                MedGo
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    {user.user_metadata?.first_name || user.email}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Browse freely • Sign in for full access
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent">
              Your Health,
              <br />
              Our Priority
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              AI-powered medicine scanner, symptom analyzer, and emergency services. 
              Get instant health insights and connect with medical help when you need it most.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="px-8" onClick={() => handleFeatureClick('scanner')}>
              <Pill className="h-5 w-5 mr-2" />
              Scan Medicine
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="px-8" onClick={() => handleFeatureClick('symptoms')}>
              <Brain className="h-5 w-5 mr-2" />
              Analyze Symptoms
            </Button>
            <Button variant="outline" size="lg" className="px-8" onClick={() => handleFeatureClick('ambulance')}>
              <Ambulance className="h-5 w-5 mr-2" />
              Emergency Help
            </Button>
          </div>

          {!user && (
            <p className="text-sm text-muted-foreground">
              Try any feature above • You'll be prompted to create an account for full access
            </p>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-card py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Stethoscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">MedGo</span>
          </div>
          <p className="text-muted-foreground">
            All rights reserved by MedGo
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;