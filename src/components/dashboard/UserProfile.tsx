import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  MapPin,
  Bell,
  Shield,
  Save,
  Camera,
  Edit3,
  Download,
  Key
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { profileUpdateSchema } from "@/lib/validationSchemas";
import { logger } from "@/lib/logger";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { TwoFactorModal } from "@/components/auth/TwoFactorModal";
import { OtpVerificationModal } from "@/components/auth/OtpVerificationModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";
import jsPDF from "jspdf";

interface UserProfileProps {
  user: any;
}

export const UserProfile = ({ user }: UserProfileProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [stats, setStats] = useState({
    memberSince: "",
    totalScans: 0,
    lastActivity: ""
  });
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    emergencyContact: "",
    medicalHistory: "",
    allergies: "",
    currentMedications: "",
    medicalConditions: "",
    preferences: {
      emailNotifications: true,
      smsNotifications: false,
      reminderNotifications: true,
      dataSharing: false
    }
  });
  const { toast } = useToast();
  const { signOut } = useAuth();

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch total scans
      const { data: medicineScans } = await supabase
        .from('medicine_scans')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      const { data: symptomAnalyses } = await supabase
        .from('symptom_analyses')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      const totalScans = (medicineScans?.length || 0) + (symptomAnalyses?.length || 0);

      // Get member since date
      const memberSince = new Date(user.created_at).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });

      // Get last activity
      const allScans = [
        ...(medicineScans || []),
        ...(symptomAnalyses || [])
      ];
      
      const lastActivity = allScans.length > 0 ? "Today" : "No activity";

      setStats({
        memberSince,
        totalScans,
        lastActivity
      });
    } catch (error) {
      logger.error("Error fetching stats:", error);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (profile) {
        setProfileData({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: profile.email || user.email || "",
          phone: profile.phone || "",
          dateOfBirth: profile.date_of_birth || "",
          address: "",
          emergencyContact: profile.emergency_contact_name && profile.emergency_contact_phone 
            ? `${profile.emergency_contact_name} - ${profile.emergency_contact_phone}`
            : "",
          medicalHistory: "",
          allergies: profile.allergies || "",
          currentMedications: profile.current_medications || "",
          medicalConditions: profile.medical_conditions || "",
          preferences: {
            emailNotifications: profile.notification_preferences ?? true,
            smsNotifications: false,
            reminderNotifications: true,
            dataSharing: profile.data_sharing_consent ?? false
          }
        });
      } else {
        // Set default values with user data
        setProfileData(prev => ({
          ...prev,
          firstName: user.user_metadata?.first_name || "",
          lastName: user.user_metadata?.last_name || "",
          email: user.email || ""
        }));
      }
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceChange = async (preference: string, value: boolean) => {
    setProfileData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value
      }
    }));

    // Auto-save preferences to database
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          notification_preferences: preference === 'emailNotifications' ? value : profileData.preferences.emailNotifications,
          data_sharing_consent: preference === 'dataSharing' ? value : profileData.preferences.dataSharing,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Preference Updated",
        description: "Your preference has been saved.",
      });
    } catch (error: any) {
      logger.error("Error saving preference:", error);
      toast({
        title: "Error",
        description: "Failed to save preference",
        variant: "destructive"
      });
      // Revert the change
      setProfileData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [preference]: !value
        }
      }));
    }
  };

  const handleSave = async () => {
    try {
      // Validate profile data using zod schema
      const emergencyContactParts = profileData.emergencyContact.split(' - ');
      const validationData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone || undefined,
        emergencyContactName: emergencyContactParts[0] || undefined,
        emergencyContactPhone: emergencyContactParts[1] || undefined
      };

      try {
        profileUpdateSchema.parse(validationData);
      } catch (validationError: any) {
        const errorMessages = validationError.issues.map((issue: any) => issue.message).join(', ');
        toast({
          title: "Validation Error",
          description: errorMessages,
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          email: profileData.email,
          phone: profileData.phone || null,
          date_of_birth: profileData.dateOfBirth || null,
          allergies: profileData.allergies,
          current_medications: profileData.currentMedications,
          medical_conditions: profileData.medicalConditions,
          notification_preferences: profileData.preferences.emailNotifications,
          data_sharing_consent: profileData.preferences.dataSharing,
          emergency_contact_name: emergencyContactParts[0] || null,
          emergency_contact_phone: emergencyContactParts[1] || null,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      setIsEditing(false);
    } catch (error: any) {
      logger.error("Error saving profile:", error);
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const downloadUserData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const { data: medicineScans } = await supabase
        .from('medicine_scans')
        .select('*')
        .eq('user_id', user.id);

      const { data: symptomAnalyses } = await supabase
        .from('symptom_analyses')
        .select('*')
        .eq('user_id', user.id);

      const { data: ambulanceBookings } = await supabase
        .from('ambulance_bookings')
        .select('*')
        .eq('user_id', user.id);

      // Check if user is a driver and fetch history
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      let driverHistory = null;
      if (userRole?.role === 'driver') {
        const { data } = await supabase
          .from('driver_request_history')
          .select('*')
          .eq('driver_id', user.id);
        driverHistory = data;
      }

      // Create PDF
      const pdf = new jsPDF();
      
      // Add logo/header
      pdf.setFontSize(20);
      pdf.setTextColor(0, 123, 255);
      pdf.text("MEDGO", 170, 20);
      
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text("User Data Export", 20, 20);
      
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Export Date: ${new Date().toLocaleDateString()}`, 20, 30);
      
      // Profile Information
      let yPos = 45;
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Profile Information", 20, yPos);
      
      yPos += 10;
      pdf.setFontSize(10);
      pdf.text(`Name: ${profile?.first_name} ${profile?.last_name}`, 20, yPos);
      yPos += 7;
      pdf.text(`Email: ${profile?.email}`, 20, yPos);
      yPos += 7;
      pdf.text(`Phone: ${profile?.phone || 'N/A'}`, 20, yPos);
      yPos += 7;
      pdf.text(`Member Since: ${stats.memberSince}`, 20, yPos);
      
      // Medicine Scans
      yPos += 15;
      pdf.setFontSize(14);
      pdf.text(`Medicine Scans (${medicineScans?.length || 0})`, 20, yPos);
      yPos += 10;
      pdf.setFontSize(10);
      
      medicineScans?.slice(0, 5).forEach((scan: any) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`- ${scan.medicine_name || 'Unknown'} (${new Date(scan.created_at).toLocaleDateString()})`, 25, yPos);
        yPos += 7;
      });
      
      // Symptom Analyses
      yPos += 10;
      pdf.setFontSize(14);
      pdf.text(`Symptom Analyses (${symptomAnalyses?.length || 0})`, 20, yPos);
      yPos += 10;
      pdf.setFontSize(10);
      
      symptomAnalyses?.slice(0, 5).forEach((analysis: any) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`- ${analysis.symptoms?.join(', ') || 'N/A'} (${new Date(analysis.created_at).toLocaleDateString()})`, 25, yPos);
        yPos += 7;
      });

      // Driver History (if applicable)
      if (driverHistory && driverHistory.length > 0) {
        yPos += 15;
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(14);
        pdf.text(`Driver Request History`, 20, yPos);
        yPos += 10;
        pdf.setFontSize(10);
        
        const accepted = driverHistory.filter(h => h.action === 'accepted').length;
        const rejected = driverHistory.filter(h => h.action === 'rejected').length;
        
        pdf.text(`Total Requests: ${driverHistory.length}`, 25, yPos);
        yPos += 7;
        pdf.setTextColor(0, 128, 0);
        pdf.text(`Accepted: ${accepted}`, 25, yPos);
        yPos += 7;
        pdf.setTextColor(255, 0, 0);
        pdf.text(`Rejected: ${rejected}`, 25, yPos);
        yPos += 10;
        pdf.setTextColor(0, 0, 0);
        
        driverHistory.slice(0, 5).forEach((record: any) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          const actionColor = record.action === 'accepted' ? '(Accepted)' : '(Rejected)';
          pdf.text(`- ${record.emergency_type} ${actionColor} - ${new Date(record.created_at).toLocaleDateString()}`, 25, yPos);
          yPos += 7;
        });
      }

      // Save PDF
      pdf.save(`medgo-user-data-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "Data Downloaded",
        description: "Your data has been downloaded as PDF",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const accountStats = [
    { label: "Member Since", value: stats.memberSince, icon: Calendar },
    { label: "Total Scans", value: stats.totalScans.toString(), icon: Camera },
    { label: "Account Status", value: "Active", icon: Shield },
    { label: "Last Activity", value: stats.lastActivity, icon: User }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          User Profile
        </h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Account Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {accountStats.map((stat, index) => (
          <Card key={index} className="border-primary/10 shadow-[var(--shadow-card)]">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and contact information
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {isEditing ? "Cancel" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Picture */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="" alt="Profile" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xl">
                  {profileData.firstName[0]}{profileData.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button variant="outline" size="sm" onClick={() => {
                  toast({
                    title: "Coming Soon",
                    description: "Photo upload feature will be available soon",
                  });
                }}>
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={profileData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={profileData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profileData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={profileData.dateOfBirth}
                  onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  value={profileData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  disabled={!isEditing}
                  className="pl-10 min-h-[60px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                value={profileData.emergencyContact}
                onChange={(e) => handleInputChange("emergencyContact", e.target.value)}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                value={profileData.allergies}
                onChange={(e) => handleInputChange("allergies", e.target.value)}
                disabled={!isEditing}
                rows={2}
                placeholder="Enter any known allergies..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentMedications">Current Medications</Label>
              <Textarea
                id="currentMedications"
                value={profileData.currentMedications}
                onChange={(e) => handleInputChange("currentMedications", e.target.value)}
                disabled={!isEditing}
                rows={2}
                placeholder="List current medications..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medicalConditions">Medical Conditions</Label>
              <Textarea
                id="medicalConditions"
                value={profileData.medicalConditions}
                onChange={(e) => handleInputChange("medicalConditions", e.target.value)}
                disabled={!isEditing}
                rows={2}
                placeholder="List any medical conditions..."
              />
            </div>

            {isEditing && (
              <Button onClick={handleSave} className="w-full" variant="medical">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Preferences & Settings */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-secondary" />
              Preferences & Settings
            </CardTitle>
            <CardDescription>
              Customize your notification and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Notification Settings */}
            <div>
              <h4 className="font-semibold mb-4">Notification Preferences</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications" className="font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={profileData.preferences.emailNotifications}
                    onCheckedChange={(checked) => handlePreferenceChange("emailNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="smsNotifications" className="font-medium">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive text message alerts</p>
                  </div>
                  <Switch
                    id="smsNotifications"
                    checked={profileData.preferences.smsNotifications}
                    onCheckedChange={(checked) => handlePreferenceChange("smsNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="reminderNotifications" className="font-medium">Health Reminders</Label>
                    <p className="text-sm text-muted-foreground">Medication and checkup reminders</p>
                  </div>
                  <Switch
                    id="reminderNotifications"
                    checked={profileData.preferences.reminderNotifications}
                    onCheckedChange={(checked) => handlePreferenceChange("reminderNotifications", checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Privacy Settings */}
            <div>
              <h4 className="font-semibold mb-4">Privacy Settings</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dataSharing" className="font-medium">Data Sharing</Label>
                    <p className="text-sm text-muted-foreground">Share anonymized data for research</p>
                  </div>
                  <Switch
                    id="dataSharing"
                    checked={profileData.preferences.dataSharing}
                    onCheckedChange={(checked) => handlePreferenceChange("dataSharing", checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Account Security */}
            <div>
              <h4 className="font-semibold mb-4">Account Security</h4>
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowChangePassword(true)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowTwoFactor(true)}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Two-Factor Authentication
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    downloadUserData();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download My Data (PDF)
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => setShowSignOutDialog(true)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>

            <Separator />

            {/* Account Status */}
            <div>
              <h4 className="font-semibold mb-4">Account Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Account Type</span>
                  <Badge className="bg-green-100 text-green-800">Free Plan</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Verification Status</span>
                  <Badge className="bg-blue-100 text-blue-800">Verified</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Data Usage</span>
                  <span className="text-sm text-muted-foreground">47/100 scans</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <OtpVerificationModal 
        isOpen={showOtpVerification}
        onClose={() => setShowOtpVerification(false)}
        phoneNumber={profileData.phone}
        onVerified={() => {
          setShowOtpVerification(false);
          setShowChangePassword(true);
        }}
      />

      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
      <TwoFactorModal 
        isOpen={showTwoFactor} 
        onClose={() => setShowTwoFactor(false)} 
      />

      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};