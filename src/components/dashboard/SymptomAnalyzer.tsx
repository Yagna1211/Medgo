import { useState } from "react";
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
  Stethoscope
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

export const SymptomAnalyzer = ({ user }: SymptomAnalyzerProps) => {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);

  const addSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms([...symptoms, currentSymptom.trim()]);
      setCurrentSymptom("");
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const analyzeSymptoms = async () => {
    if (symptoms.length === 0) {
      toast("Please add at least one symptom to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Mock analysis data
      const mockAnalysis: SymptomAnalysis = {
        conditions: [
          {
            name: "Common Cold",
            probability: 75,
            description: "A viral infection of the upper respiratory tract, typically mild and self-limiting.",
            severity: 'low',
            recommendations: [
              "Rest and stay hydrated",
              "Use over-the-counter pain relievers",
              "Gargle with warm salt water",
              "Consider throat lozenges"
            ]
          },
          {
            name: "Seasonal Allergies",
            probability: 45,
            description: "Allergic reaction to airborne substances like pollen, dust, or pet dander.",
            severity: 'low',
            recommendations: [
              "Avoid known allergens",
              "Use antihistamines",
              "Keep windows closed during high pollen days",
              "Consider nasal rinses"
            ]
          },
          {
            name: "Viral Upper Respiratory Infection",
            probability: 35,
            description: "Infection affecting the nose, throat, and upper airways.",
            severity: 'medium',
            recommendations: [
              "Monitor symptoms closely",
              "Increase fluid intake",
              "Use humidifier",
              "Consult doctor if symptoms worsen"
            ]
          }
        ],
        urgency: 'low',
        generalRecommendations: [
          "Monitor symptoms for 3-5 days",
          "Seek medical attention if symptoms worsen",
          "Maintain good hygiene to prevent spread",
          "Get adequate rest and nutrition"
        ]
      };

      // Store analysis in database
      const { error } = await supabase
        .from('symptom_analyses')
        .insert({
          user_id: user.id,
          symptoms: symptoms,
          additional_info: additionalInfo,
          urgency_level: mockAnalysis.urgency,
          possible_conditions: mockAnalysis.conditions,
          general_recommendations: mockAnalysis.generalRecommendations.join(', ')
        });

      if (error) {
        throw error;
      }

      setAnalysis(mockAnalysis);
      toast(`Analysis Complete! Found ${mockAnalysis.conditions.length} possible conditions and saved to your history.`);
    } catch (error: any) {
      toast(`Analysis failed: ${error.message}`);
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
              <div className="flex gap-2">
                <Input
                  id="symptom"
                  placeholder="e.g., headache, fever, cough"
                  value={currentSymptom}
                  onChange={(e) => setCurrentSymptom(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSymptom()}
                />
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
              variant="medical"
              disabled={isAnalyzing || symptoms.length === 0}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Symptoms...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Analyze Symptoms
                </>
              )}
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