import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Camera, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Info,
  Pill,
  Clock,
  Zap,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MedicineInfo {
  name: string;
  genericName: string;
  manufacturer: string;
  uses: string[];
  dosage: string;
  sideEffects: string[];
  precautions: string[];
  activeIngredients: string[];
  confidence: number;
}

interface MedicineScannerProps {
  user: any;
}

export const MedicineScanner = ({ user }: MedicineScannerProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [medicineInfo, setMedicineInfo] = useState<MedicineInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        analyzeMedicine(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeMedicine = async (file: File) => {
    console.log('Starting medicine analysis...', { fileName: file.name, fileSize: file.size });
    setIsAnalyzing(true);
    setMedicineInfo(null);

    try {
      // Convert image to base64
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log('Image converted to base64, calling edge function...');

      // Call the AI analysis edge function
      const { data, error } = await supabase.functions.invoke('analyze-medicine', {
        body: {
          imageBase64,
          userId: user.id
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        throw new Error(error.message || 'Failed to analyze medicine');
      }

      // Transform the API response to match our interface
      const transformedData: MedicineInfo = {
        name: data.medicine_name || 'Unknown Medicine',
        genericName: data.generic_name || 'N/A',
        manufacturer: data.manufacturer || 'N/A',
        uses: data.uses ? data.uses.split(', ') : [],
        dosage: data.dosage || 'Consult healthcare provider',
        sideEffects: data.side_effects ? data.side_effects.split(', ') : [],
        precautions: data.precautions ? data.precautions.split(', ') : [],
        activeIngredients: data.active_ingredients ? data.active_ingredients.split(', ') : [],
        confidence: Math.round((data.confidence_score || 0) * 100)
      };

      setMedicineInfo(transformedData);
      toast("Analysis Complete! Medicine identified and saved to your history.");
    } catch (error: any) {
      toast(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          Medicine Scanner
        </h2>
        <p className="text-muted-foreground">
          Upload a clear photo of your medicine for instant identification and information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Upload Medicine Photo
            </CardTitle>
            <CardDescription>
              Take a clear photo showing the medicine name, shape, and color
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div 
              className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
              onClick={triggerFileInput}
            >
              {uploadedImage ? (
                <div className="space-y-4">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded medicine" 
                    className="max-h-48 mx-auto rounded-lg shadow-md"
                  />
                  <Button variant="outline" size="sm">
                    Upload Different Image
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports JPG, PNG, WebP files
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isAnalyzing && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Analyzing medicine... This may take a few moments.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-secondary" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Detailed information about the identified medicine
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!medicineInfo && !isAnalyzing && (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a medicine photo to see analysis results</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing medicine...</p>
              </div>
            )}

            {medicineInfo && (
              <div className="space-y-6">
                {/* Medicine Name & Confidence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-primary">{medicineInfo.name}</h3>
                    <Badge 
                      variant={medicineInfo.confidence > 90 ? "default" : "secondary"}
                      className="bg-green-100 text-green-800"
                    >
                      {medicineInfo.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Generic: {medicineInfo.genericName} | Manufacturer: {medicineInfo.manufacturer}
                  </p>
                </div>

                <Separator />

                {/* Active Ingredients */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    Active Ingredients
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {medicineInfo.activeIngredients.map((ingredient, index) => (
                      <Badge key={index} variant="outline">
                        {ingredient}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Uses */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Medical Uses
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {medicineInfo.uses.map((use, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        {use}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Dosage */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Recommended Dosage
                  </h4>
                  <p className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                    {medicineInfo.dosage}
                  </p>
                </div>

                {/* Side Effects */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Possible Side Effects
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {medicineInfo.sideEffects.map((effect, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        {effect}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Precautions */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500" />
                    Important Precautions
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {medicineInfo.precautions.map((precaution, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span>
                        {precaution}
                      </li>
                    ))}
                  </ul>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This information is for educational purposes only. Always consult a healthcare professional before taking any medication.
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