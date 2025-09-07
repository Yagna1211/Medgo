import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { imageBase64, userId, manualSearch } = await req.json()
    
    const VISION_AI_API_KEY = Deno.env.get('VISION_AI_API_KEY')
    
    if (!VISION_AI_API_KEY) {
      throw new Error('Vision API key not configured')
    }

    let extractedText = '';
    let possibleMatches: MedicineMatch[] = [];

    // Step 1: Extract text using Google Vision API (skip if manual search)
    if (!manualSearch) {
      console.log('Starting OCR with Google Vision API...');
      
      const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_AI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBase64.split(',')[1]
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1
                }
              ]
            }
          ]
        })
      });

      const visionData = await visionResponse.json();
      console.log('Vision API response status:', visionResponse.status);

      if (visionData.error) {
        throw new Error(`Vision API error: ${visionData.error.message}`);
      }

      if (!visionData.responses?.[0]?.textAnnotations?.[0]) {
        throw new Error('No text detected in the image. Please ensure the medicine label is clearly visible.');
      }

      extractedText = visionData.responses[0].textAnnotations[0].description;
      console.log('Extracted text:', extractedText);
    } else {
      extractedText = manualSearch;
    }

    // Step 2: Extract potential medicine names from text
    const medicineCandidates = extractMedicineNames(extractedText);
    console.log('Medicine candidates:', medicineCandidates);

    // Step 3: Look up each candidate in medicine databases
    for (const candidate of medicineCandidates) {
      try {
        const matches = await lookupMedicine(candidate);
        possibleMatches.push(...matches);
      } catch (error) {
        console.log(`Failed to lookup ${candidate}:`, error.message);
      }
    }

    // Step 4: Remove duplicates and sort by confidence
    const uniqueMatches = removeDuplicates(possibleMatches);
    uniqueMatches.sort((a, b) => b.confidence - a.confidence);

    // Filter results based on confidence thresholds
    const highConfidenceMatches = uniqueMatches.filter(m => m.confidence >= 80);
    const finalMatches = highConfidenceMatches.length > 0 ? 
      (highConfidenceMatches.length === 1 ? highConfidenceMatches : uniqueMatches) : 
      uniqueMatches;

    console.log(`Found ${finalMatches.length} potential matches`);

    if (finalMatches.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No medicine matches found',
          extractedText,
          suggestion: 'Try taking a clearer photo with better lighting, or use manual search'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 5: Save the best match to database
    const bestMatch = finalMatches[0];
    if (bestMatch.confidence > 0.7) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase.from('medicine_scans').insert({
        user_id: userId,
        medicine_name: bestMatch.name,
        generic_name: bestMatch.genericName,
        manufacturer: bestMatch.manufacturer,
        active_ingredients: bestMatch.activeIngredients.join(', '),
        uses: bestMatch.uses.join(', '),
        dosage: bestMatch.dosage,
        side_effects: bestMatch.sideEffects.join(', '),
        precautions: bestMatch.precautions.join(', '),
        confidence_score: bestMatch.confidence / 100
      });
    }

    return new Response(
      JSON.stringify({ 
        matches: finalMatches.slice(0, 5), // Return top 5 matches
        extractedText: extractedText,
        totalFound: finalMatches.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in analyze-medicine function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to extract potential medicine names from text
function extractMedicineNames(text: string): string[] {
  const BRAND_TO_GENERIC = {
    'paracetamol': 'acetaminophen',
    'paracemeter': 'acetaminophen',
    'tylenol': 'acetaminophen',
    'calpol': 'acetaminophen',
    'aspirin': 'acetylsalicylic acid',
    'disprin': 'acetylsalicylic acid',
    'ibuprofen': 'ibuprofen',
    'advil': 'ibuprofen',
    'motrin': 'ibuprofen',
    'nurofen': 'ibuprofen'
  };

  const STOP_WORDS = [
    'spf', 'pa+++', 'directions', 'for external use', 'powder', 'lotion', 'cream',
    'warning', 'warnings', 'usage', 'indications', 'dosage', 'ingredients', 'sunscreen',
    'tablets', 'capsules', 'mg', 'ml', 'gm', 'per', 'each', 'contains'
  ];

  const lines = text
    .split(/\n|\r/)
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !/^\d+\s*mg|^\d+\s*ml|^\d+\s*gm/i.test(l))
    .filter(l => !STOP_WORDS.some(sw => l.toLowerCase().includes(sw)))
    .slice(0, 30);

  const candidates = new Set<string>();

  // Primary extraction - look for medicine names
  for (const line of lines) {
    const cleanLine = line.replace(/[^\w\s-]/g, ' ').trim();
    const words = cleanLine.split(/\s+/).filter(w => w.length >= 3);

    // Look for single strong medicine names
    for (const word of words) {
      const normalized = word.toLowerCase();
      if (BRAND_TO_GENERIC[normalized]) {
        candidates.add(normalized);
        candidates.add(BRAND_TO_GENERIC[normalized]);
      }
      
      // Check if it looks like a medicine name
      if (/^[a-zA-Z]{4,15}$/.test(word) && 
          !STOP_WORDS.includes(normalized) &&
          !/^(tablet|capsule|syrup|cream|gel)s?$/i.test(word)) {
        candidates.add(word);
      }
    }

    // Look for compound names (up to 2 words)
    if (words.length >= 2 && words.length <= 3) {
      const compound = words.slice(0, 2).join(' ');
      if (/^[a-zA-Z\s-]{5,25}$/.test(compound)) {
        candidates.add(compound);
      }
    }
  }

  // Convert to array and prioritize known medicines
  const candidateArray = Array.from(candidates);
  const knownMedicines = candidateArray.filter(c => 
    Object.keys(BRAND_TO_GENERIC).includes(c.toLowerCase()) ||
    Object.values(BRAND_TO_GENERIC).includes(c.toLowerCase())
  );
  
  const otherCandidates = candidateArray.filter(c => 
    !knownMedicines.some(k => k.toLowerCase() === c.toLowerCase())
  );

  return [...knownMedicines, ...otherCandidates].slice(0, 8);
}

// Helper function to lookup medicine in various databases
async function lookupMedicine(medicineName: string): Promise<MedicineMatch[]> {
  const matches: MedicineMatch[] = [];

  try {
    // 1. Try OpenFDA drug database
    const fdaMatches = await searchOpenFDA(medicineName);
    matches.push(...fdaMatches);

    // 2. Try RxNorm database
    const rxMatches = await searchRxNorm(medicineName);
    matches.push(...rxMatches);

  } catch (error) {
    console.log(`Lookup failed for ${medicineName}:`, error.message);
  }

  return matches;
}

// Search OpenFDA database
async function searchOpenFDA(medicineName: string): Promise<MedicineMatch[]> {
  const matches: MedicineMatch[] = [];
  
  const queries = [
    `openfda.brand_name:"${medicineName}"`,
    `openfda.generic_name:"${medicineName}"`,
    `openfda.substance_name:"${medicineName}"`,
    `openfda.brand_name:${medicineName}`,
    `openfda.generic_name:${medicineName}`
  ];

for (const query of queries) {
  try {
    const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(query)}&limit=3`;
    console.log('Searching FDA:', url);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        for (const result of data.results) {
          const match = parseOpenFDAResult(result, medicineName);
          if (match) {
            // Check recall status via enforcement API
            try {
              const nameForRecall = match.name || match.genericName || medicineName;
              match.isRecalled = await checkRecallStatusApi(nameForRecall);
            } catch (_e) {}
            matches.push(match);
          }
        }
      }
    }
  } catch (error) {
    console.log(`FDA query failed: ${query}`, (error as any).message);
  }
}

  return matches;
}

// Search RxNorm database
async function searchRxNorm(medicineName: string): Promise<MedicineMatch[]> {
  const matches: MedicineMatch[] = [];

  try {
    // First, get RxCUI for the medicine name
    const rxcuiUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(medicineName)}`;
    const rxcuiResponse = await fetch(rxcuiUrl);
    
    if (rxcuiResponse.ok) {
      const rxcuiData = await rxcuiResponse.json();
      const rxcui = rxcuiData?.idGroup?.rxnormId?.[0];
      
      if (rxcui) {
        // Get detailed information using RxCUI
        const detailsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
        const detailsResponse = await fetch(detailsUrl);
        
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          const properties = detailsData?.properties;
          
          if (properties) {
            matches.push({
              name: properties.name || medicineName,
              genericName: properties.synonym || 'N/A',
              manufacturer: 'N/A',
              activeIngredients: [],
              uses: ['Consult healthcare provider for specific uses'],
              dosage: 'Consult healthcare provider for dosage',
              sideEffects: ['Consult healthcare provider for side effects'],
              precautions: ['Consult healthcare provider before use'],
              isRecalled: false,
              expiryStatus: 'Unknown',
              confidence: 85,
              source: 'RxNorm'
            });
          }
        }
      }
    }
  } catch (error) {
    console.log(`RxNorm search failed for ${medicineName}:`, error.message);
  }

  return matches;
}

// Parse OpenFDA result into MedicineMatch
function parseOpenFDAResult(result: any, searchTerm: string): MedicineMatch | null {
  const openfda = result.openfda || {};
  
  const brandName = openfda.brand_name?.[0] || '';
  const genericName = openfda.generic_name?.[0] || '';
  const manufacturer = openfda.manufacturer_name?.[0] || 'N/A';
  
  // Enhanced confidence calculation with brand-generic mapping
  let confidence = 60;
  const searchLower = searchTerm.toLowerCase();
  const brandLower = brandName.toLowerCase();
  const genericLower = genericName.toLowerCase();
  
  // Check for exact matches or known mappings
  const BRAND_MAPPINGS: { [key: string]: string[] } = {
    'paracetamol': ['acetaminophen', 'tylenol'],
    'paracemeter': ['acetaminophen', 'tylenol'],
    'acetaminophen': ['paracetamol', 'tylenol'],
    'aspirin': ['acetylsalicylic acid'],
    'ibuprofen': ['advil', 'motrin', 'nurofen']
  };

  // Exact match gets highest confidence
  if (brandLower === searchLower || genericLower === searchLower) {
    confidence = 95;
  } 
  // Check if search term maps to this medicine's names
  else if (BRAND_MAPPINGS[searchLower]?.some(mapped => 
    brandLower.includes(mapped) || genericLower.includes(mapped) ||
    mapped.includes(brandLower) || mapped.includes(genericLower)
  )) {
    confidence = 92;
  }
  // Partial matches
  else if (brandLower.includes(searchLower) || genericLower.includes(searchLower) ||
           searchLower.includes(brandLower) || searchLower.includes(genericLower)) {
    confidence = 85;
  }
  // Check substance names for active ingredients
  else if (openfda.substance_name?.some((substance: string) => 
    substance.toLowerCase().includes(searchLower) || searchLower.includes(substance.toLowerCase())
  )) {
    confidence = 80;
  }

  // Boost confidence for high-quality results
  if (brandName && genericName && manufacturer !== 'N/A') {
    confidence = Math.min(confidence + 5, 95);
  }

  return {
    name: brandName || genericName || searchTerm,
    genericName: genericName || 'N/A',
    manufacturer,
    activeIngredients: openfda.substance_name || [],
    uses: parseStringArray(result.indications_and_usage),
    dosage: parseStringArray(result.dosage_and_administration)?.[0] || 'Consult healthcare provider',
    sideEffects: parseStringArray(result.adverse_reactions),
    precautions: parseStringArray(result.warnings_and_precautions || result.warnings),
    isRecalled: false, // Will be set by recall check
    expiryStatus: 'Check package for expiry date',
    confidence,
    source: 'OpenFDA'
  };
}

// Helper to parse string arrays from FDA data
function parseStringArray(data: any): string[] {
  if (!data) return [];
  
  const text = Array.isArray(data) ? data[0] : data;
  if (typeof text !== 'string') return [];
  
  return text
    .split(/[.;|\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 200)
    .slice(0, 5);
}

// Simple recall keyword presence fallback (kept for compatibility)
function checkRecallStatus(_openfda: any): boolean {
  return false;
}

// Query FDA enforcement (recall) API for a product name
async function checkRecallStatusApi(name: string): Promise<boolean> {
  try {
    const url = `https://api.fda.gov/drug/enforcement.json?search=product_description:%22${encodeURIComponent(name)}%22&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.results) && data.results.length > 0;
  } catch (_e) {
    return false;
  }
}

// Remove duplicate matches
function removeDuplicates(matches: MedicineMatch[]): MedicineMatch[] {
  const seen = new Set<string>();
  const unique: MedicineMatch[] = [];
  
  for (const match of matches) {
    const key = `${match.name.toLowerCase()}_${match.genericName.toLowerCase()}_${match.manufacturer.toLowerCase()}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(match);
    }
  }
  
  return unique;
}