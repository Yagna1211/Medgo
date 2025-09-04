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

  // If user is logged in and wants to access a feature, show the dashboard
  if (user && activeView !== 'home') {
    return <Dashboard user={user} onLogout={signOut} initialView={activeView} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/90 backdrop-blur-sm sticky top-0 z-40">
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

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Comprehensive Health Tools</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Advanced AI technology combined with real-time medical data to provide accurate, 
            reliable health information and emergency services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Medicine Scanner */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-primary/10"
            onClick={() => handleFeatureClick('scanner')}
          >
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Pill className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Medicine Scanner</CardTitle>
              <CardDescription>
                Upload medicine photos for instant identification, dosage info, and safety warnings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">OpenFDA + RxNorm</span>
                <Badge variant="secondary">Free</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Symptom Analyzer */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-primary/10"
            onClick={() => handleFeatureClick('symptoms')}
          >
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Symptom Analyzer</CardTitle>
              <CardDescription>
                AI-powered symptom analysis with possible conditions and treatment recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">AI-Powered</span>
                <Badge variant="secondary">Smart</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Services */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-primary/10"
            onClick={() => handleFeatureClick('ambulance')}
          >
            <CardHeader>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Ambulance className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Emergency Services</CardTitle>
              <CardDescription>
                Voice-activated emergency calls and real-time ambulance tracking with GPS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Real-time GPS</span>
                <Badge variant="destructive">Emergency</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Health History */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-primary/10"
            onClick={() => handleFeatureClick('history')}
          >
            <CardHeader>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <History className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Health History</CardTitle>
              <CardDescription>
                Track your medicine scans, symptom analyses, and health records over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Personal Records</span>
                <Badge variant="outline">Secure</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">10K+</div>
              <div className="text-muted-foreground">Medicines Scanned</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600">95%</div>
              <div className="text-muted-foreground">Accuracy Rate</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-red-600">24/7</div>
              <div className="text-muted-foreground">Emergency Support</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-purple-600">5K+</div>
              <div className="text-muted-foreground">Happy Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-12">
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