import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Plus, 
  X, 
  Loader2, 
  AlertTriangle,
  Info,
  Activity,
  Heart,
  Brain,
  Stethoscope,
  Mic,
  MicOff
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SymptomAnalysis {
  conditions: Array<{
    name: string;
    probability: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendations: string[];
  }>;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  generalRecommendations: string[];
}

interface SymptomAnalyzerProps {
  user: any;
}

// Common symptoms for autocomplete suggestions
const COMMON_SYMPTOMS = [
  "headache", "fever", "cough", "sore throat", "runny nose", "fatigue", "nausea", 
  "vomiting", "diarrhea", "stomach pain", "chest pain", "shortness of breath",
  "dizziness", "muscle aches", "joint pain", "back pain", "rash", "itching",
  "chills", "sweating", "loss of appetite", "weight loss", "anxiety", "depression"
];

export const SymptomAnalyzer = ({ user }: SymptomAnalyzerProps) => {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [symptomSuggestions, setSymptomSuggestions] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const symptomsArray = transcript.split(/,| and /).map(s => s.trim()).filter(Boolean);
        setSymptoms(prev => [...prev, ...symptomsArray]);
        toast(`Heard: "${transcript}"`);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast('Voice error. Try again.');
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
    return () => recognitionRef.current?.stop();
  }, []);

  const addSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms([...symptoms, currentSymptom.trim()]);
      setCurrentSymptom("");
      setSymptomSuggestions([]);
    }
  };

  const handleSymptomInputChange = (value: string) => {
    setCurrentSymptom(value);
    
    if (value.trim().length > 0) {
      const filtered = COMMON_SYMPTOMS.filter(symptom => 
        symptom.toLowerCase().includes(value.toLowerCase()) &&
        !symptoms.includes(symptom)
      ).slice(0, 5);
      setSymptomSuggestions(filtered);
    } else {
      setSymptomSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    if (!symptoms.includes(suggestion)) {
      setSymptoms([...symptoms, suggestion]);
      setCurrentSymptom("");
      setSymptomSuggestions([]);
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast('Voice not supported');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      toast('Listening... Describe symptoms');
    }
  };

  const analyzeSymptoms = async () => {
    if (symptoms.length === 0) {
      toast("Please add at least one symptom to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      // Call the AI analysis edge function
      const { data, error } = await supabase.functions.invoke('analyze-symptoms', {
        body: {
          symptoms,
          additionalInfo,
          userId: user.id
        }
      });

      if (error) {
        // Check for specific error messages
        const errorMessage = error.message || 'Failed to analyze symptoms';
        
        if (errorMessage.includes('Rate limit')) {
          toast.error('Too many requests. Please wait a moment and try again.');
        } else if (errorMessage.includes('temporarily unavailable')) {
          toast.error('Service temporarily unavailable. Please try again later or contact support.');
        } else {
          toast.error(`Analysis failed: ${errorMessage}`);
        }
        
        setIsAnalyzing(false);
        return;
      }

      // Transform the API response to match our interface - Keep only top 3 conditions
      const transformedAnalysis: SymptomAnalysis = {
        conditions: data.conditions.slice(0, 3).map((condition: any) => ({
          name: condition.name,
          probability: parseInt(condition.probability.replace(/[^\d]/g, '')) || 50,
          description: condition.description,
          severity: condition.severity.toLowerCase() as 'low' | 'medium' | 'high',
          recommendations: condition.recommendations
        })),
        urgency: data.urgency.toLowerCase() as 'low' | 'medium' | 'high' | 'emergency',
        generalRecommendations: data.generalRecommendations
      };

      setAnalysis(transformedAnalysis);
      toast.success(`Analysis Complete! Found ${transformedAnalysis.conditions.length} possible conditions.`);
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'emergency': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          Symptom Analyzer
        </h2>
        <p className="text-muted-foreground">
          Enter your symptoms to get AI-powered health insights and recommendations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Enter Your Symptoms
            </CardTitle>
            <CardDescription>
              Add symptoms you're experiencing for personalized analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Symptom */}
            <div className="space-y-2">
              <Label htmlFor="symptom">Add Symptom</Label>
              <div className="flex gap-2 relative">
                <div className="flex-1 relative">
                  <Input
                    id="symptom"
                    placeholder="e.g., headache, fever, cough"
                    value={currentSymptom}
                    onChange={(e) => handleSymptomInputChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSymptom()}
                  />
                  {symptomSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                      {symptomSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={addSymptom} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Current Symptoms */}
            {symptoms.length > 0 && (
              <div className="space-y-2">
                <Label>Current Symptoms ({symptoms.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="px-3 py-1 flex items-center gap-2"
                    >
                      {symptom}
                      <button
                        onClick={() => removeSymptom(symptom)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Information */}
            <div className="space-y-2">
              <Label htmlFor="additional">Additional Information (Optional)</Label>
              <Textarea
                id="additional"
                placeholder="Duration, severity, triggers, or any other relevant details..."
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              onClick={analyzeSymptoms} 
              className="w-full" 
              disabled={isAnalyzing || symptoms.length === 0}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Analyze Symptoms
                </>
              )}
            </Button>

            <Button 
              onClick={toggleVoiceInput}
              variant={isListening ? "destructive" : "secondary"}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isListening ? <><MicOff className="h-4 w-4 mr-2" />Stop</> : <><Mic className="h-4 w-4 mr-2" />Voice Input</>}
            </Button>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This tool provides general information only and should not replace professional medical advice.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-secondary" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              AI-powered analysis of your symptoms
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!analysis && !isAnalyzing && (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Add symptoms and click analyze to see results</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing your symptoms...</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-6">
                {/* Urgency Level */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Urgency Level</h4>
                  <Badge className={`${getUrgencyColor(analysis.urgency)} text-sm px-3 py-1`}>
                    {analysis.urgency.toUpperCase()} PRIORITY
                  </Badge>
                </div>

                <Separator />

                {/* Possible Conditions */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Possible Conditions
                  </h4>
                  {analysis.conditions.map((condition, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{condition.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(condition.severity)}>
                              {condition.severity}
                            </Badge>
                            <Badge variant="outline">
                              {condition.probability}% match
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {condition.description}
                        </p>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Recommendations:</h5>
                          <ul className="space-y-1">
                            {condition.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-green-500 mt-1">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* General Recommendations */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    General Recommendations
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {analysis.generalRecommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    If symptoms persist, worsen, or you feel unwell, please consult a healthcare professional immediately.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};