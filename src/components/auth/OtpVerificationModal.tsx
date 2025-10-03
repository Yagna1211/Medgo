import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  onVerified: () => void;
}

export const OtpVerificationModal = ({ isOpen, onClose, phoneNumber, onVerified }: OtpVerificationModalProps) => {
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Please add a phone number to your profile first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "https://pregaycgmaejwdgxetsd.supabase.co/functions/v1/send-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phoneNumber }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setSentOtp(data.otp); // In production, this would be stored server-side
      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: `Verification code sent to ${phoneNumber}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = () => {
    if (otp === sentOtp) {
      toast({
        title: "Verified",
        description: "OTP verified successfully",
      });
      onVerified();
    } else {
      toast({
        title: "Invalid OTP",
        description: "Please enter the correct OTP",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setOtp("");
    setSentOtp("");
    setOtpSent(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Your Identity</DialogTitle>
          <DialogDescription>
            {!otpSent 
              ? "We'll send a verification code to your phone number"
              : `Enter the 6-digit code sent to ${phoneNumber}`
            }
          </DialogDescription>
        </DialogHeader>

        {!otpSent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={phoneNumber} disabled />
            </div>
            <Button 
              onClick={sendOtp} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send OTP"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyOtp} className="flex-1">
                Verify
              </Button>
              <Button variant="outline" onClick={sendOtp} disabled={loading}>
                Resend
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
