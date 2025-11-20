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
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    if (!LOVABLE_API_KEY) {
      throw new Error('Lovable API key not configured')
    }

    const symptomsText = symptoms.join(', ')
    
    const prompt = `As a medical AI assistant, analyze these symptoms and provide a comprehensive health assessment.

Symptoms: ${symptomsText}
Additional Information: ${additionalInfo || 'None provided'}

Analyze these symptoms and provide 2-4 possible conditions. Focus on common conditions but also mention when serious conditions should be ruled out.

IMPORTANT: Include disclaimers that this is not a substitute for professional medical advice, always consult healthcare professionals, and seek immediate medical attention in emergencies.`

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a medical AI assistant that provides health assessments based on symptoms.' },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_symptoms',
            description: 'Analyze symptoms and return structured health assessment',
            parameters: {
              type: 'object',
              properties: {
                conditions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Name of the condition' },
                      probability: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                      description: { type: 'string', description: 'Brief description of the condition' },
                      severity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'] },
                      recommendations: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'probability', 'description', 'severity', 'recommendations']
                  }
                },
                urgency: { type: 'string', enum: ['Low', 'Medium', 'High', 'Emergency'] },
                generalRecommendations: { type: 'array', items: { type: 'string' } }
              },
              required: ['conditions', 'urgency', 'generalRecommendations']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_symptoms' } }
      })
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('AI Gateway error:', aiResponse.status, errorText)
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error('Failed to analyze symptoms')
    }

    const aiData = await aiResponse.json()
    console.log('AI Gateway response:', JSON.stringify(aiData))

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall) {
      throw new Error('No tool call in AI response')
    }

    const analysis = JSON.parse(toolCall.function.arguments)

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