import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

export const AuthModal = () => {
  const { showAuthModal, setShowAuthModal, signIn, signUp, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Sign In Form State
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

// Sign Up Form State
const [signUpData, setSignUpData] = useState({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'customer',
  ambulanceNumber: '',
  vehicleDetails: '',
  serviceArea: ''
});

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await signIn(signInData.email, signInData.password);
      
      if (error) {
        if (error.message.includes('email_not_confirmed')) {
          setError('Please check your email and click the confirmation link to verify your account.');
        } else if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else {
          setError(error.message);
        }
      } else {
        toast('Successfully signed in!');
        setShowAuthModal(false);
        resetForms();
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  if (signUpData.password !== signUpData.confirmPassword) {
    setError('Passwords do not match.');
    return;
  }
  if (signUpData.password.length < 6) {
    setError('Password must be at least 6 characters long.');
    return;
  }

  setIsLoading(true);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: signUpData.email,
      password: signUpData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: signUpData.firstName,
          last_name: signUpData.lastName,
          role: signUpData.role,
          ambulance_number: signUpData.ambulanceNumber,
          vehicle_details: signUpData.vehicleDetails,
          service_area: signUpData.serviceArea,
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please try signing in instead.');
      } else if (error.message.includes('email_not_confirmed')) {
        setError('Please verify your email from the link we just sent, then sign in.');
      } else {
        setError(error.message);
      }
      return;
    }

    if (data?.user) {
      toast('Account created! Please verify your email to finish signup.');
      setActiveTab('signin');
      resetForms();
    }
  } catch (err: any) {
    setError('An unexpected error occurred. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

const resetForms = () => {
  setSignInData({ email: '', password: '' });
  setSignUpData({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    password: '', 
    confirmPassword: '', 
    role: 'customer', 
    ambulanceNumber: '', 
    vehicleDetails: '', 
    serviceArea: '' 
  });
  setError('');
};

  const handleResend = async () => {
    if (!signInData.email) {
      setError('Enter your email to resend verification.');
      return;
    }
    const { error } = await supabase.auth.resend({ type: 'signup', email: signInData.email });
    if (error) {
      setError(error.message);
    } else {
      toast('Verification email sent. Please check your inbox.');
    }
  };

  const handleReset = async () => {
    if (!signInData.email) {
      setError('Enter your email to reset your password.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(signInData.email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) {
      setError(error.message);
    } else {
      toast('Password reset email sent. Please check your inbox.');
    }
  };

  const handleClose = () => {
    setShowAuthModal(false);
    resetForms();
  };

  if (loading) return null;

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { setShowAuthModal(open); if (!open) resetForms(); }}>
      <DialogContent className="sm:max-w-md max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Welcome to MedGo
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-sm">
            Sign in to unlock all features and access your health history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <button type="button" className="underline" onClick={handleResend}>Resend verification email</button>
                  <button type="button" className="underline" onClick={handleReset}>Forgot password?</button>
                </div>
              </form>
            </TabsContent>

{/* Sign Up Tab */}
<TabsContent value="signup">
  <form onSubmit={handleSignUp} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="signup-firstname" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          First Name
        </Label>
        <Input
          id="signup-firstname"
          type="text"
          placeholder="First name"
          value={signUpData.firstName}
          onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-lastname">Last Name</Label>
        <Input
          id="signup-lastname"
          type="text"
          placeholder="Last name"
          value={signUpData.lastName}
          onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
          required
          disabled={isLoading}
        />
      </div>
    </div>

    {/* Role Selection */}
    <div className="space-y-2">
      <Label>Account Type</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={signUpData.role === 'customer' ? 'default' : 'outline'} onClick={() => setSignUpData({ ...signUpData, role: 'customer' })}>Customer</Button>
        <Button type="button" variant={signUpData.role === 'driver' ? 'default' : 'outline'} onClick={() => setSignUpData({ ...signUpData, role: 'driver' })}>Ambulance Driver</Button>
      </div>
    </div>

    {signUpData.role === 'driver' && (
      <div className="space-y-3 p-3 border rounded-md">
        <div className="space-y-1">
          <Label htmlFor="signup-ambno">Ambulance Number</Label>
          <Input id="signup-ambno" value={signUpData.ambulanceNumber} onChange={(e)=>setSignUpData({...signUpData, ambulanceNumber: e.target.value})} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signup-veh">Vehicle Details</Label>
          <Input id="signup-veh" value={signUpData.vehicleDetails} onChange={(e)=>setSignUpData({...signUpData, vehicleDetails: e.target.value})} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signup-area">Service Area</Label>
          <Input id="signup-area" value={signUpData.serviceArea} onChange={(e)=>setSignUpData({...signUpData, serviceArea: e.target.value})} required />
        </div>
      </div>
    )}

    <div className="space-y-2">
      <Label htmlFor="signup-email" className="flex items-center gap-2">
        <Mail className="h-4 w-4" />
        Email Address
      </Label>
      <Input
        id="signup-email"
        type="email"
        placeholder="Enter your email"
        value={signUpData.email}
        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
        required
        disabled={isLoading}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="signup-password" className="flex items-center gap-2">
        <Lock className="h-4 w-4" />
        Password
      </Label>
      <div className="relative">
        <Input
          id="signup-password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Create a password"
          value={signUpData.password}
          onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
          required
          disabled={isLoading}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3"
          onClick={() => setShowPassword(!showPassword)}
          disabled={isLoading}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="signup-confirm">Confirm Password</Label>
      <Input
        id="signup-confirm"
        type="password"
        placeholder="Confirm your password"
        value={signUpData.confirmPassword}
        onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
        required
        disabled={isLoading}
      />
    </div>

    <Button type="submit" className="w-full" disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Creating Account...
        </>
      ) : (
        'Create Account'
      )}
    </Button>
  </form>
</TabsContent>
          </Tabs>

          <div className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};