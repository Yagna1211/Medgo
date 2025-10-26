import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Pill, 
  Stethoscope, 
  Ambulance, 
  History, 
  User
} from "lucide-react";
import { MedicineScanner } from "./MedicineScanner";
import { SymptomAnalyzer } from "./SymptomAnalyzer";
import { EmergencyAmbulance } from "./EmergencyAmbulance";
import { NearbyHospitals } from "./NearbyHospitals";
import { UserHistory } from "./UserHistory";
import { UserProfile } from "./UserProfile";

interface CustomerDashboardProps {
  user: any;
}

export const CustomerDashboard = ({ user }: CustomerDashboardProps) => {
  const [activeTab, setActiveTab] = useState("scanner");

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            MedGo Dashboard
          </h1>
          <p className="text-muted-foreground">
            Your complete health companion and emergency services
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="symptoms" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Symptoms
            </TabsTrigger>
            <TabsTrigger value="ambulance" className="flex items-center gap-2">
              <Ambulance className="h-4 w-4" />
              Ambulance
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <MedicineScanner user={user} />
          </TabsContent>

          <TabsContent value="symptoms">
            <SymptomAnalyzer user={user} />
          </TabsContent>

          <TabsContent value="ambulance">
            <EmergencyAmbulance user={user} />
            <div className="mt-6">
              <NearbyHospitals user={user} />
            </div>
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