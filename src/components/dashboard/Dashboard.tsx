import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import { 
  Stethoscope, 
  Upload, 
  Search, 
  History, 
  User, 
  LogOut,
  Camera,
  FileText,
  Activity,
  Shield,
  Sun,
  Moon
} from "lucide-react";
import { MedicineScanner } from "./MedicineScanner";
import { SymptomAnalyzer } from "./SymptomAnalyzer";
import { UserHistory } from "./UserHistory";
import { UserProfile } from "./UserProfile";
import heroImage from "@/assets/hero-medical.jpg";
import medicineIcon from "@/assets/medicine-icon.jpg";
import symptomIcon from "@/assets/symptom-icon.jpg";

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export const Dashboard = ({ user, onLogout }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState("home");
  const { theme, setTheme } = useTheme();

  const features = [
    {
      title: "Medicine Scanner",
      description: "Upload a photo of any medicine to get detailed information",
      icon: Camera,
      image: medicineIcon,
      action: () => setActiveTab("scanner"),
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Symptom Analysis",
      description: "Analyze your symptoms to understand possible conditions",
      icon: Search,
      image: symptomIcon,
      action: () => setActiveTab("symptoms"),
      color: "from-green-500 to-teal-500"
    },
    {
      title: "Health History",
      description: "View your medical scanning and analysis history",
      icon: History,
      action: () => setActiveTab("history"),
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Profile Settings",
      description: "Manage your account and preferences",
      icon: User,
      action: () => setActiveTab("profile"),
      color: "from-orange-500 to-red-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-primary/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  MediScan
                </h1>
                <p className="text-sm text-muted-foreground">Health Intelligence Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">Welcome, {user.user_metadata?.first_name || user.email?.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid grid-cols-2 lg:grid-cols-5 gap-2 bg-white/50 backdrop-blur-sm p-2 rounded-xl">
            <TabsTrigger value="home" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Stethoscope className="h-4 w-4 mr-2" />
              Home
            </TabsTrigger>
            <TabsTrigger value="scanner" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Camera className="h-4 w-4 mr-2" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="symptoms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Search className="h-4 w-4 mr-2" />
              Symptoms
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl shadow-[var(--shadow-medical)]">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/90"></div>
              <img 
                src={heroImage} 
                alt="Medical Technology" 
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center text-center text-white p-8">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Advanced Health Intelligence
                  </h2>
                  <p className="text-lg opacity-90 mb-6">
                    Scan medicines and analyze symptoms with AI-powered precision
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button variant="hero" onClick={() => setActiveTab("scanner")}>
                      Start Scanning
                    </Button>
                    <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                      Learn More
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className="group cursor-pointer transition-all duration-300 hover:shadow-[var(--shadow-medical)] hover:scale-[1.02] border-primary/10 overflow-hidden"
                  onClick={feature.action}
                >
                  <div className={`h-2 bg-gradient-to-r ${feature.color}`}></div>
                  <CardHeader className="text-center pb-4">
                    {feature.image ? (
                      <div className="mx-auto mb-4">
                        <img 
                          src={feature.image} 
                          alt={feature.title}
                          className="h-16 w-16 rounded-lg object-cover shadow-md"
                        />
                      </div>
                    ) : (
                      <div className={`mx-auto h-16 w-16 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center mb-4 shadow-md`}>
                        <feature.icon className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-primary/10 shadow-[var(--shadow-card)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Medicines Scanned</CardTitle>
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">47</div>
                  <p className="text-xs text-muted-foreground">+12 this month</p>
                </CardContent>
              </Card>
              
              <Card className="border-primary/10 shadow-[var(--shadow-card)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Symptom Analyses</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-secondary">23</div>
                  <p className="text-xs text-muted-foreground">+5 this week</p>
                </CardContent>
              </Card>
              
              <Card className="border-primary/10 shadow-[var(--shadow-card)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">85%</div>
                  <p className="text-xs text-muted-foreground">Excellent health tracking</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scanner">
            <MedicineScanner user={user} />
          </TabsContent>

          <TabsContent value="symptoms">
            <SymptomAnalyzer user={user} />
          </TabsContent>

          <TabsContent value="history">
            <UserHistory user={user} />
          </TabsContent>

          <TabsContent value="profile">
            <UserProfile user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};