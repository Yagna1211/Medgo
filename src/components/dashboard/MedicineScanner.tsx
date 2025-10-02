import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Shield,
  Search,
  AlertCircle,
  Star,
  Database,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Tesseract from "tesseract.js";

interface MedicineMatch {
  name: string;
  genericName: string;
  manufacturer: string;
  activeIngredients: string[];
  uses: string[];
  dosage: string;
  sideEffects: string[];
  precautions: string[];
  isRecalled: boolean;
  expiryStatus: string;
  confidence: number;
  source: string;
}

interface MedicineScannerProps {
  user: any;
}

export const MedicineScanner = ({ user }: MedicineScannerProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [medicineMatches, setMedicineMatches] = useState<MedicineMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MedicineMatch | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [manualSearchTerm, setManualSearchTerm] = useState<string>('');
  const [showManualSearch, setShowManualSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

// On-device OCR using Tesseract.js (tuned for labels)
const ocrWithTesseract = async (file: File): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    logger: m => console.log(m)
  });
  return result.data.text;
};

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setSelectedFile(file);
        // Reset previous results
        setMedicineMatches([]);
        setSelectedMatch(null);
        setExtractedText('');
        setShowManualSearch(false);
      };
      reader.readAsDataURL(file);
    }
  };

const startAnalysis = async () => {
  if (!selectedFile) {
    toast("Please upload an image first.");
    return;
  }
  // Prefer on-device OCR to avoid server OCR billing issues
  setIsAnalyzing(true);
  try {
    const text = await ocrWithTesseract(selectedFile);
    if (text && text.length > 3) {
      await analyzeMedicine(null, text);
    } else {
      throw new Error('Could not read text from image');
    }
  } catch (e: any) {
    toast(`OCR failed: ${e.message}. Falling back to server...`);
    await analyzeMedicine(selectedFile);
  } finally {
    setIsAnalyzing(false);
  }
};

  const startManualSearch = async () => {
    if (!manualSearchTerm.trim()) {
      toast("Please enter a medicine name to search.");
      return;
    }
    await analyzeMedicine(null, manualSearchTerm.trim());
  };

  const analyzeMedicine = async (file: File | null, manualSearch?: string) => {
    setIsAnalyzing(true);
    setMedicineMatches([]);
    setSelectedMatch(null);

    try {
      let imageBase64 = '';
      
      if (file && !manualSearch) {
        // Convert file to base64
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const { data, error } = await supabase.functions.invoke('analyze-medicine', {
        body: { 
          imageBase64: imageBase64,
          userId: user.id,
          manualSearch: manualSearch || null
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.matches && data.matches.length > 0) {
        // Filter matches - only show if confidence is reasonable (>40%) or if it's manual search
        const validMatches = manualSearch 
          ? data.matches.filter((m: MedicineMatch) => m.confidence > 40)
          : data.matches.filter((m: MedicineMatch) => m.confidence > 50);

        if (validMatches.length === 0) {
          setMedicineMatches([]);
          setSelectedMatch(null);
          toast.error("Medicine not found in database. Please try a different image or search manually.");
          setShowManualSearch(true);
          return;
        }

        setMedicineMatches(validMatches);
        setSelectedMatch(validMatches[0]); // Select the highest confidence match
        setExtractedText(data.extractedText || '');
        
        if (validMatches[0].confidence > 90) {
          toast.success("High confidence match found! Medicine identified successfully.");
        } else if (validMatches[0].confidence > 70) {
          toast("Medicine identified with good confidence. Please verify the match.");
        } else {
          toast("Possible matches found. Please verify the information carefully.");
        }
      } else {
        setMedicineMatches([]);
        setSelectedMatch(null);
        toast.error("Medicine not found in database. Please try manual search or upload a clearer image.");
        setShowManualSearch(true);
      }

    } catch (error: any) {
      console.error('Analysis error (Vision):', error);

      // Fallback to client-side OCR with Tesseract if we have a file
      if (file) {
        try {
          toast("Server OCR failed. Trying on-device OCR...");
          const tesseractText = await ocrWithTesseract(file);

          if (tesseractText && tesseractText.length > 3) {
            const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('analyze-medicine', {
              body: {
                imageBase64: '',
                userId: user.id,
                manualSearch: tesseractText
              }
            });

            if (fallbackError) throw fallbackError;

            if (fallbackData?.matches?.length) {
              setMedicineMatches(fallbackData.matches);
              setSelectedMatch(fallbackData.matches[0]);
              setExtractedText(fallbackData.extractedText || tesseractText);
              toast("On-device OCR succeeded. Please verify the match.");
              return;
            } else {
              throw new Error(fallbackData?.suggestion || 'No matches found after OCR');
            }
          }
        } catch (fallbackErr: any) {
          console.error('Fallback OCR error:', fallbackErr);
          toast(`OCR fallback failed: ${fallbackErr.message}`);
        }
      }

      toast(`Analysis failed: ${error.message}`);
      setShowManualSearch(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectMatch = (match: MedicineMatch) => {
    setSelectedMatch(match);
    toast(`Selected: ${match.name} (${match.confidence}% confidence)`);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 90) return "default";
    if (confidence >= 70) return "secondary";
    return "outline";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          Medicine Scanner
        </h2>
        <p className="text-muted-foreground">
          Upload a clear photo of your medicine or search manually for accurate identification
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload & Search Section */}
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Medicine Photo & Search
            </CardTitle>
            <CardDescription>
              Upload a medicine photo or search manually if scanning fails
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
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button 
                      onClick={startAnalysis}
                      disabled={isAnalyzing}
                      className="flex items-center gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Scan Medicine
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={triggerFileInput}>
                      Upload Different Image
                    </Button>
                  </div>
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

            {/* Manual Search Section */}
            <div className="space-y-3">
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="manual-search">Manual Search</Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-search"
                    placeholder="Enter medicine name (e.g., Aspirin, Paracetamol)"
                    value={manualSearchTerm}
                    onChange={(e) => setManualSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && startManualSearch()}
                  />
                  <Button 
                    onClick={startManualSearch}
                    disabled={isAnalyzing || !manualSearchTerm.trim()}
                    variant="outline"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {extractedText && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Text detected:</strong> {extractedText.substring(0, 100)}...
                </AlertDescription>
              </Alert>
            )}

            {isAnalyzing && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  {uploadedImage ? "Analyzing medicine photo..." : "Searching medicine database..."}
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
              Medicine Information
            </CardTitle>
            <CardDescription>
              Accurate medicine details from FDA and medical databases
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!medicineMatches.length && !isAnalyzing && (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a medicine photo or search manually to see results</p>
                {showManualSearch && (
                  <p className="text-sm mt-2 text-orange-600">
                    Photo scanning failed. Try manual search above.
                  </p>
                )}
              </div>
            )}

            {isAnalyzing && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  {uploadedImage ? "Scanning medicine photo..." : "Searching database..."}
                </p>
              </div>
            )}

            {/* Multiple Matches */}
            {medicineMatches.length > 1 && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">Multiple matches found - Select the correct one:</span>
                </div>
                <div className="space-y-2">
                  {medicineMatches.map((match, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedMatch === match 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 hover:border-primary/50'
                      }`}
                      onClick={() => selectMatch(match)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{match.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {match.genericName} • {match.manufacturer}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getConfidenceBadgeVariant(match.confidence)}>
                            {match.confidence}%
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Database className="h-3 w-3 mr-1" />
                            {match.source}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
              </div>
            )}

            {/* Selected Medicine Details */}
            {selectedMatch && (
              <div className="space-y-6">
                {/* Medicine Name & Confidence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xl font-bold text-primary">{selectedMatch.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={getConfidenceBadgeVariant(selectedMatch.confidence)}>
                        <Star className="h-3 w-3 mr-1" />
                        {selectedMatch.confidence}% confidence
                      </Badge>
                      <Badge variant="outline">
                        <Database className="h-3 w-3 mr-1" />
                        {selectedMatch.source}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    <strong>Generic:</strong> {selectedMatch.genericName} • <strong>Manufacturer:</strong> {selectedMatch.manufacturer}
                  </p>
                  
                  {selectedMatch.isRecalled && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>WARNING:</strong> This medicine may have been recalled. Please verify with your healthcare provider.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Expiry Status:</strong> {selectedMatch.expiryStatus}
                    </AlertDescription>
                  </Alert>
                </div>

                <Separator />

                {/* Active Ingredients */}
                {selectedMatch.activeIngredients.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      Active Ingredients
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedMatch.activeIngredients.map((ingredient, index) => (
                        <Badge key={index} variant="outline">
                          {ingredient}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uses */}
                {selectedMatch.uses.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Medical Uses
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {selectedMatch.uses.map((use, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {use}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dosage */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Recommended Dosage
                  </h4>
                  <p className="text-sm bg-secondary/20 text-foreground p-3 rounded-lg border border-border">
                    {selectedMatch.dosage}
                  </p>
                </div>

                {/* Side Effects */}
                {selectedMatch.sideEffects.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Possible Side Effects
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {selectedMatch.sideEffects.map((effect, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-orange-500 mt-1">•</span>
                          {effect}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Precautions */}
                {selectedMatch.precautions.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      Important Precautions
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {selectedMatch.precautions.map((precaution, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          {precaution}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>This information is sourced from official medical databases and is for educational purposes only.</p>
                    <p><strong>Always consult a healthcare professional before taking any medication.</strong></p>
                    <div className="flex items-center gap-1 text-xs">
                      <ExternalLink className="h-3 w-3" />
                      <span>Data from: FDA OpenFDA, RxNorm, NIH</span>
                    </div>
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