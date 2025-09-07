import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Smartphone, Copy, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoFactorModal = ({ isOpen, onClose }: TwoFactorModalProps) => {
  const [step, setStep] = useState<"setup" | "verify">("setup");
  const [verificationCode, setVerificationCode] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Mock TOTP secret - in real app this would come from backend
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const qrCodeUrl = `otpauth://totp/MedicalApp?secret=${totpSecret}&issuer=MedicalApp`;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(totpSecret);
    toast({
      title: "Copied!",
      description: "Secret key copied to clipboard"
    });
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    // Mock verification - in real app this would verify against backend
    setTimeout(() => {
      setIsEnabled(true);
      setLoading(false);
      toast({
        title: "Success!",
        description: "Two-factor authentication has been enabled"
      });
      setStep("setup");
      onClose();
    }, 1000);
  };

  const handleDisable = () => {
    setIsEnabled(false);
    toast({
      title: "Disabled",
      description: "Two-factor authentication has been disabled"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Add an extra layer of security to your account
          </DialogDescription>
        </DialogHeader>

        {!isEnabled ? (
          step === "setup" ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center space-y-4">
                    <Smartphone className="h-12 w-12 text-primary mx-auto" />
                    <div>
                      <h3 className="font-medium">Setup Authenticator App</h3>
                      <p className="text-sm text-muted-foreground">
                        Scan the QR code or enter the secret key manually
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Secret Key</Label>
                <div className="flex gap-2">
                  <Input value={totpSecret} readOnly className="font-mono" />
                  <Button variant="outline" size="sm" onClick={handleCopySecret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter this key in your authenticator app if you can't scan the QR code
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="w-full">
                  Cancel
                </Button>
                <Button onClick={() => setStep("verify")} className="w-full">
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep("setup")} className="w-full">
                  Back
                </Button>
                <Button onClick={handleVerify} disabled={loading} className="w-full">
                  {loading ? "Verifying..." : "Verify & Enable"}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <div>
                    <h3 className="font-medium text-green-600">2FA Enabled</h3>
                    <p className="text-sm text-muted-foreground">
                      Your account is protected with two-factor authentication
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
              <Button variant="destructive" onClick={handleDisable} className="w-full">
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};