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
    const { symptoms, additionalInfo, userId } = await req.json()
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured')
    }

    const symptomsText = symptoms.join(', ')
    
    const prompt = `As a medical AI assistant, analyze these symptoms and provide a comprehensive health assessment. 

Symptoms: ${symptomsText}
Additional Information: ${additionalInfo || 'None provided'}

IMPORTANT DISCLAIMERS TO INCLUDE:
- This is not a substitute for professional medical advice
- Always consult healthcare professionals for proper diagnosis
- In case of emergency, seek immediate medical attention

Please provide the response in this exact JSON structure:
{
  "conditions": [
    {
      "name": "Condition name",
      "probability": "High/Medium/Low",
      "description": "Brief description of the condition",
      "severity": "Mild/Moderate/Severe",
      "recommendations": ["Recommendation 1", "Recommendation 2"]
    }
  ],
  "urgency": "Low/Medium/High/Emergency",
  "generalRecommendations": [
    "General recommendation 1",
    "General recommendation 2",
    "Always consult a healthcare professional",
    "This analysis is not a substitute for medical diagnosis"
  ]
}

Provide 2-4 possible conditions based on the symptoms. Focus on common conditions but also mention when serious conditions should be ruled out.`

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    })

    const geminiData = await geminiResponse.json()
    console.log('Gemini API response:', geminiData)

    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to analyze symptoms')
    }

    const analysisText = geminiData.candidates[0].content.parts[0].text
    
    // Extract JSON from the response
    let analysis
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      throw new Error('Failed to parse symptom analysis')
    }

    // Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: dbError } = await supabase
      .from('symptom_analyses')
      .insert({
        user_id: userId,
        symptoms: symptoms,
        additional_info: additionalInfo,
        possible_conditions: analysis.conditions,
        urgency_level: analysis.urgency,
        general_recommendations: analysis.generalRecommendations
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to save analysis result')
    }

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in analyze-symptoms function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})