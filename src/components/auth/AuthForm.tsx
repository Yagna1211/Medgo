import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, Eye, EyeOff, Mail, Lock, User, Users, PhoneCall, Bell, MapPin, Navigation, Car, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuthFormProps {
  onAuthSuccess: (user: any) => void;
}

export const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "customer",
    ambulanceNumber: "",
    vehicleDetails: "",
    serviceArea: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      if (error) {
        throw error;
      }
      
      if (data.user) {
        onAuthSuccess(data.user);
        toast("Welcome back! You have successfully signed in.");
      }
    } catch (error: any) {
      toast(`Authentication failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: formData.role,
            ambulance_number: formData.ambulanceNumber,
            vehicle_details: formData.vehicleDetails,
            service_area: formData.serviceArea,
          }
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (data.user) {
        onAuthSuccess(data.user);
        toast("Account created! Welcome to MediScan.");
      }
    } catch (error: any) {
      toast(`Registration failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-medical)] border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-[var(--shadow-glow)]">
              <Stethoscope className="h-8 w-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              MediScan
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your intelligent health companion
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="signin" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                
                <Button type="submit" className="w-full" variant="medical" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        name="firstName"
                        placeholder="First name"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Last name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Customer
                        </div>
                      </SelectItem>
                      <SelectItem value="driver">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          Ambulance Driver
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role === "driver" && (
                  <div className="space-y-4 p-4 border rounded-lg bg-secondary/5">
                    <h3 className="font-semibold text-sm">Driver Information</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="ambulanceNumber">Ambulance Number</Label>
                      <Input
                        id="ambulanceNumber"
                        name="ambulanceNumber"
                        placeholder="e.g., AMB-001"
                        value={formData.ambulanceNumber}
                        onChange={handleInputChange}
                        required={formData.role === "driver"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicleDetails">Vehicle Details</Label>
                      <Textarea
                        id="vehicleDetails"
                        name="vehicleDetails"
                        placeholder="Vehicle model, equipment, capacity, etc."
                        value={formData.vehicleDetails}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleDetails: e.target.value }))}
                        rows={2}
                        required={formData.role === "driver"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="serviceArea">Service Area</Label>
                      <Input
                        id="serviceArea"
                        name="serviceArea"
                        placeholder="e.g., Downtown, North District, etc."
                        value={formData.serviceArea}
                        onChange={handleInputChange}
                        required={formData.role === "driver"}
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                
                <Button type="submit" className="w-full" variant="medical" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* How it works Section */}
      <section aria-labelledby="how-it-works" className="mt-8 w-full max-w-3xl bg-background/60 supports-[backdrop-filter]:bg-background/60 backdrop-blur rounded-xl border border-primary/10 p-6 shadow-[var(--shadow-card)]">
        <header className="mb-4">
          <h1 id="how-it-works" className="text-2xl font-bold text-foreground">
            Rapido-style ambulance dispatch: how it works
          </h1>
          <p className="text-muted-foreground mt-2">
            Separate logins for Users and Ambulance Drivers enable rapid emergency response and real-time navigation.
          </p>
        </header>

        <div className="space-y-6">
          <article className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Two login systems</h3>
              <p className="text-sm text-muted-foreground">
                Users log in to request help; ambulance drivers log in to receive jobs and manage availability.
              </p>
            </div>
          </article>

          <article className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Voice trigger: “Call ambulance”</h3>
              <p className="text-sm text-muted-foreground">
                Saying or tapping “Call ambulance” broadcasts a real-time alert to nearby drivers within the GPS range.
              </p>
            </div>
          </article>

          <article className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Driver alerts with precise location</h3>
              <p className="text-sm text-muted-foreground">
                Drivers receive the user’s location <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />GPS</span> and can open Google Maps <span className="inline-flex items-center gap-1"><Navigation className="h-4 w-4" />Directions</span> for immediate response.
              </p>
            </div>
          </article>

          <article className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Rapido-like dispatch logic</h3>
              <p className="text-sm text-muted-foreground">
                Requests route to available, nearby drivers first to minimize ETA and ensure fast assistance.
              </p>
            </div>
          </article>
        </div>

        <aside className="mt-6 rounded-lg bg-primary/5 border border-primary/10 p-4 text-sm text-muted-foreground">
          This explains the intended workflow. Driver app, voice detection, realtime dispatch, and Google Maps integration are part of the full platform setup.
        </aside>
      </section>
    </div>
  );
};