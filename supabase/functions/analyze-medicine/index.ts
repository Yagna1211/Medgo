import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { imageBase64, userId } = await req.json()
    
    const VISION_AI_API_KEY = Deno.env.get('VISION_AI_API_KEY')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!VISION_AI_API_KEY || !GEMINI_API_KEY) {
      throw new Error('API keys not configured')
    }

    // Step 1: Extract text from image using Google Vision API
    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageBase64.split(',')[1] // Remove data:image/jpeg;base64, prefix
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
    })

    const visionData = await visionResponse.json()
    console.log('Vision API response:', visionData)

    if (!visionData.responses?.[0]?.textAnnotations?.[0]) {
      throw new Error('No text detected in the image')
    }

    const extractedText = visionData.responses[0].textAnnotations[0].description

    // Step 2: Analyze the extracted text using Gemini
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this text extracted from a medicine package/label and provide detailed medicine information in JSON format. Text: "${extractedText}"

Please provide the response in this exact JSON structure:
{
  "medicine_name": "Name of the medicine",
  "generic_name": "Generic/scientific name",
  "manufacturer": "Manufacturer name",
  "active_ingredients": "Active ingredients",
  "uses": "Medical uses and indications",
  "dosage": "Dosage information",
  "side_effects": "Common side effects",
  "precautions": "Important precautions",
  "confidence_score": 0.95
}

If you cannot identify the medicine clearly, set confidence_score below 0.7 and indicate uncertainty in the fields.`
          }]
        }]
      })
    })

    const geminiData = await geminiResponse.json()
    console.log('Gemini API response:', geminiData)

    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to analyze medicine information')
    }

    const analysisText = geminiData.candidates[0].content.parts[0].text
    
    // Extract JSON from the response (handle markdown code blocks)
    let medicineInfo
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        medicineInfo = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      throw new Error('Failed to parse medicine analysis')
    }

    // Step 3: Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: dbError } = await supabase
      .from('medicine_scans')
      .insert({
        user_id: userId,
        medicine_name: medicineInfo.medicine_name,
        generic_name: medicineInfo.generic_name,
        manufacturer: medicineInfo.manufacturer,
        active_ingredients: medicineInfo.active_ingredients,
        uses: medicineInfo.uses,
        dosage: medicineInfo.dosage,
        side_effects: medicineInfo.side_effects,
        precautions: medicineInfo.precautions,
        confidence_score: medicineInfo.confidence_score
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to save scan result')
    }

    return new Response(
      JSON.stringify(medicineInfo),
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