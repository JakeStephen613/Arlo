import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 Study plan generator called')
    const requestBody = await req.json()
    console.log('📝 Request body:', JSON.stringify(requestBody, null, 2))

    // Extract parameters
    const { duration = 60, objective = '', parsed_summary = '' } = requestBody

    console.log('📊 Generating study plan with params:', { duration, objective, hasParsedSummary: !!parsed_summary })

    // Generate a study plan with diverse technique combinations
    const studyPlan = {
      session_id: `session_${Date.now().toString(36)}`,
      topic: objective || 'Study Session',
      total_duration: duration,
      pomodoro: '25-5-25-5-25-15',
      units_to_cover: ['Cell Structure', 'Cell Division', 'Genetics', 'Evolution'],
      techniques: ['flashcards', 'feynman', 'quiz', 'blurting'],
      blocks: [
        {
          id: `block_${Date.now()}_1`,
          unit: 'Cell Structure',
          technique: 'flashcards', // Legacy primary technique
          techniques: [
            {
              name: 'flashcards', // Using 'name' for backend format
              sequence: 1,
              duration: 6,
              description: 'Create flashcards for key terms and concepts'
            },
            {
              name: 'feynman', // Using 'name' for backend format
              sequence: 2,
              duration: 6,
              description: 'Explain cell structure concepts in simple terms'
            }
          ],
          phase: 'study',
          tool: 'flashcards',
          lovable_component: 'multi-technique-block',
          duration: 12,
          description: 'Cell structure is the foundation of biology, understanding the organelles and their functions is crucial.',
          position: 0,
          custom: false,
          user_notes: null
        },
        {
          id: `block_${Date.now()}_2`,
          unit: 'Cell Division',
          technique: 'quiz', // Legacy primary technique
          techniques: [
            {
              name: 'quiz', // Using 'name' for backend format
              sequence: 1,
              duration: 6,
              description: 'Test your understanding of mitosis and meiosis'
            },
            {
              name: 'blurting', // Using 'name' for backend format
              sequence: 2,
              duration: 6,
              description: 'Practice recalling cell division phases'
            }
          ],
          phase: 'test',
          tool: 'quiz',
          lovable_component: 'multi-technique-block',
          duration: 12,
          description: 'Cell division is essential for growth and repair. Understand the phases of the cell cycle: interphase, mitosis, and cytokinesis.',
          position: 1,
          custom: false,
          user_notes: null
        },
        {
          id: `block_${Date.now()}_3`,
          unit: 'Genetics',
          technique: 'feynman', // Legacy primary technique
          techniques: [
            {
              name: 'feynman', // Using 'name' for backend format
              sequence: 1,
              duration: 6,
              description: 'Explain genetic concepts in simple terms'
            },
            {
              name: 'quiz', // Using 'name' for backend format
              sequence: 2,
              duration: 6,
              description: 'Test understanding of inheritance patterns'
            }
          ],
          phase: 'review',
          tool: 'feynman',
          lovable_component: 'multi-technique-block',
          duration: 12,
          description: 'Genetics explores inheritance patterns and genetic variation. Understand Mendelian genetics with concepts like dominant and recessive traits.',
          position: 2,
          custom: false,
          user_notes: null
        },
        {
          id: `block_${Date.now()}_4`,
          unit: 'Evolution',
          technique: 'flashcards', // Legacy primary technique
          techniques: [
            {
              name: 'flashcards', // Using 'name' for backend format
              sequence: 1,
              duration: 6,
              description: 'Create flashcards for evolutionary concepts'
            },
            {
              name: 'blurting', // Using 'name' for backend format
              sequence: 2,
              duration: 6,
              description: 'Practice recalling natural selection principles'
            }
          ],
          phase: 'study',
          tool: 'flashcards',
          lovable_component: 'multi-technique-block',
          duration: 12,
          description: 'Evolution explains the diversity of life through natural selection and adaptation. Learn about Darwin\'s theory and supporting evidence.',
          position: 3,
          custom: false,
          user_notes: null
        }
      ]
    }

    console.log('✅ Generated study plan:', JSON.stringify(studyPlan, null, 2))

    return new Response(
      JSON.stringify(studyPlan),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('❌ Error generating study plan:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate study plan', 
        details: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})