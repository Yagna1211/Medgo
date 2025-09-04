import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setTimeout(onComplete, 300); // Small delay for smooth transition
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-primary to-secondary flex items-center justify-center z-50 animate-fade-out">
        <div className="text-center space-y-8 animate-scale-out">
          <div className="relative">
            <div className="h-20 w-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-sm">
              <div className="text-6xl font-bold text-white opacity-90">M</div>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">MedGo</h1>
            <p className="text-white/80">Your Health Companion</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary to-secondary flex items-center justify-center z-50">
      <div className="text-center space-y-8">
        <div className="relative">
          <div className="h-20 w-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-sm animate-pulse">
            <div className="text-6xl font-bold text-white animate-[color-change_2s_infinite]">M</div>
          </div>
          <div className="absolute -inset-4 bg-white/10 rounded-3xl animate-pulse opacity-50"></div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white animate-fade-in">MedGo</h1>
          <p className="text-white/80 animate-fade-in animation-delay-300">Your Health Companion</p>
        </div>
        <div className="flex justify-center">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce animation-delay-200"></div>
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce animation-delay-400"></div>
          </div>
        </div>
      </div>
    </div>
  );
};