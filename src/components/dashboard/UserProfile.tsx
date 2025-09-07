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
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { TwoFactorModal } from "@/components/auth/TwoFactorModal";

interface UserProfileProps {
  user: any;
}

export const UserProfile = ({ user }: UserProfileProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
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
  const { downloadUserData } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, [user]);

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

  const handlePreferenceChange = (preference: string, value: boolean) => {
    setProfileData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          email: profileData.email,
          phone: profileData.phone,
          date_of_birth: profileData.dateOfBirth || null,
          allergies: profileData.allergies,
          current_medications: profileData.currentMedications,
          medical_conditions: profileData.medicalConditions,
          notification_preferences: profileData.preferences.emailNotifications,
          data_sharing_consent: profileData.preferences.dataSharing,
          emergency_contact_name: profileData.emergencyContact.split(' - ')[0] || null,
          emergency_contact_phone: profileData.emergencyContact.split(' - ')[1] || null,
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
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const accountStats = [
    { label: "Member Since", value: "January 2024", icon: Calendar },
    { label: "Total Scans", value: "47", icon: Camera },
    { label: "Account Status", value: "Active", icon: Shield },
    { label: "Last Activity", value: "Today", icon: User }
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
              <div className="h-16 w-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white text-xl font-bold">
                {profileData.firstName[0]}{profileData.lastName[0]}
              </div>
              {isEditing && (
                <Button variant="outline" size="sm">
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
                    toast({
                      title: "Download Started",
                      description: "Your data export will download shortly"
                    });
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download My Data
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
      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
      <TwoFactorModal 
        isOpen={showTwoFactor} 
        onClose={() => setShowTwoFactor(false)} 
      />
    </div>
  );
};