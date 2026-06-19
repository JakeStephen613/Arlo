
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { generateStudyPlan, StudyPlan, ApiError } from '@/services/api';
import { PlanInputData } from '@/components/FastSessionPlanner';
import { validateAndFixStudyPlan } from '@/utils/studyPlanValidation';
import { fetchTeachingContent } from '@/services/teachingApi';
import { saveStudySessionData } from '@/services/sessionApi';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { AppState } from '@/types';
export type StudyMode = 'flashcards' | 'quiz' | 'feynman' | 'blurting' | null;

interface SessionData {
  flashcards: any[];
  quiz: {
    incorrect_questions: any[];
  };
  feynman: {
    feedback: string;
    follow_up_question?: string;
  };
  blurting: {
    feedback: string;
    missed_concepts: string[];
  };
  phases_used: string[];
  topic: string;
  duration: number;
}

interface PreloadedTeachingContent {
  [blockId: string]: {
    lessons: any[];
    technique: string;
    description: string;
  };
}

export const useStudySession = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appState, setAppState] = useState<AppState>('planning');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentMode, setCurrentMode] = useState<StudyMode>(null);
  const [isChatbotExpanded, setIsChatbotExpanded] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [preloadedTeachingContent, setPreloadedTeachingContent] = useState<PreloadedTeachingContent>({});
  const [sessionData, setSessionData] = useState<SessionData>({
    flashcards: [],
    quiz: { incorrect_questions: [] },
    feynman: { feedback: '' },
    blurting: { feedback: '', missed_concepts: [] },
    phases_used: [],
    topic: '',
    duration: 0
  });

  const { toast } = useToast();

  const handleGeneratePlan = async (planData: PlanInputData) => {
    setIsGenerating(true);
    
    try {
      const rawPlan = await generateStudyPlan(planData);
      
      // Validate and fix common typos like "blurring" -> "blurting"
      const plan = validateAndFixStudyPlan(rawPlan);
      
      setCurrentPlan(plan);
      setCurrentBlockIndex(0);
      setAppState('editing-plan');
      
      toast({
        title: "Study plan generated!",
        description: `Created a ${plan.total_duration}-minute plan with ${plan.blocks.length} blocks`,
      });
    } catch (error) {
      console.error('Failed to generate plan:', error);
      
      let errorMessage = "Unable to generate study plan. Please try again.";
      
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
          errorMessage = "Authentication failed. Please sign out and sign in again.";
        } else if (error.status >= 500) {
          errorMessage = "Server error occurred. Please try again in a moment.";
        } else {
          errorMessage = `API Error: ${error.message}`;
        }
      } else if (error.message.includes('authenticated')) {
        errorMessage = "Please sign out and sign in again to continue.";
      }
      
      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const preloadTeachingContentForBreak = async (currentBlockIndex: number) => {
    if (!currentPlan) return;
    
    
    // Get the next two blocks after current
    const nextBlocks = [];
    if (currentBlockIndex + 1 < currentPlan.blocks.length) {
      nextBlocks.push(currentPlan.blocks[currentBlockIndex + 1]);
    }
    if (currentBlockIndex + 2 < currentPlan.blocks.length) {
      nextBlocks.push(currentPlan.blocks[currentBlockIndex + 2]);
    }
    
    // Preload teaching content for each upcoming block
    for (const block of nextBlocks) {
      // Skip if already preloaded
      if (preloadedTeachingContent[block.id]) {
        continue;
      }
      
      try {
        
        const response = await fetchTeachingContent(block.description);
        
        let lessonData: any[] = [];
        if (response.lesson && Array.isArray(response.lesson)) {
          lessonData = response.lesson;
        } else if (response.lessons && Array.isArray(response.lessons)) {
          lessonData = response.lessons;
        } else if (Array.isArray(response)) {
          lessonData = response;
        }
        
        if (lessonData && lessonData.length > 0) {
          setPreloadedTeachingContent(prev => ({
            ...prev,
            [block.id]: {
              lessons: lessonData,
              technique: block.technique,
              description: block.description
            }
          }));
          
        } else {
        }
      } catch (error) {
        console.error(`❌ Failed to preload teaching content for block ${block.id}:`, error);
        // Continue with other blocks even if one fails
      }
    }
    
  };

  const getPreloadedTeachingContent = (blockId: string) => {
    return preloadedTeachingContent[blockId] || null;
  };

  const clearPreloadedTeachingContent = () => {
    setPreloadedTeachingContent({});
  };

  const getCurrentBlock = () => {
    if (!currentPlan || currentBlockIndex >= currentPlan.blocks.length) {
      return null;
    }
    return currentPlan.blocks[currentBlockIndex];
  };

  const isLastBlock = () => {
    if (!currentPlan) return false;
    return currentBlockIndex >= currentPlan.blocks.length - 1;
  };

  const addQuizMistakes = (mistakes: any[]) => {
    
    // Helper function to safely convert any value to string
    const safeStringify = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'object') {
        if (value.text) return String(value.text);
        if (value.content) return String(value.content);
        if (value.value) return String(value.value);
        return JSON.stringify(value);
      }
      return String(value);
    };

    // Convert quiz mistake objects to clean strings
    const processedMistakes = mistakes.map(mistake => ({
      question: safeStringify(mistake.question),
      user_answer: safeStringify(mistake.userAnswer),
      correct_answer: safeStringify(mistake.correctAnswer), 
      explanation: safeStringify(mistake.explanation)
    }));
    
    
    setSessionData(prev => ({
      ...prev,
      quiz: { incorrect_questions: processedMistakes }
    }));
  };

  const addFlashcards = (flashcards: any[]) => {
    setSessionData(prev => ({
      ...prev,
      flashcards: [...prev.flashcards, ...flashcards]
    }));
  };

  const addFeynmanData = (feedback: string, followUp?: string) => {
    setSessionData(prev => ({
      ...prev,
      feynman: {
        feedback,
        follow_up_question: followUp
      }
    }));
  };

  const addBlurtingData = (feedback: string, missedConcepts: string[]) => {
    setSessionData(prev => ({
      ...prev,
      blurting: {
        feedback,
        missed_concepts: missedConcepts
      }
    }));
  };

  const addPhaseUsed = (phase: string) => {
    setSessionData(prev => ({
      ...prev,
      phases_used: [...prev.phases_used, phase]
    }));
  };

  const saveSession = async () => {
    if (!user || !currentPlan) return;

    try {
      
      await saveStudySessionData({
        topic: currentPlan.topic,
        duration_minutes: currentPlan.total_duration,
        review_sheet: sessionData.quiz.incorrect_questions.length > 0 ? {
          mistakes: sessionData.quiz.incorrect_questions,
          feynman_feedback: sessionData.feynman.feedback,
          blurting_feedback: sessionData.blurting.feedback
        } : null,
        quiz_mistakes: sessionData.quiz.incorrect_questions,
        flashcards: sessionData.flashcards,
        user_id: user.id
      });

      toast({
        title: "Session Saved!",
        description: "Your study session data has been saved successfully.",
      });
    } catch (error) {
      console.error('Failed to save session:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save session data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const pauseSession = async () => {
    if (!user || !currentPlan) return;

    try {
      
      const { error } = await supabase
        .from('paused_sessions')
        .insert({
          user_id: user.id,
          title: currentPlan.topic,
          session_plan: currentPlan as any,
          current_block_index: currentBlockIndex,
          progress_data: sessionData as any
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Session Paused!",
        description: "Your progress has been saved. You can resume later from the dashboard.",
      });

      // Reset to planning state
      setAppState('planning');
      setCurrentPlan(null);
      setCurrentBlockIndex(0);
      setSessionData({
        flashcards: [],
        quiz: { incorrect_questions: [] },
        feynman: { feedback: '' },
        blurting: { feedback: '', missed_concepts: [] },
        phases_used: [],
        topic: '',
        duration: 0
      });

      // Navigate to dashboard
      navigate('/');
    } catch (error) {
      console.error('Failed to pause session:', error);
      toast({
        title: "Pause Failed",
        description: "Failed to save session progress. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resumeSession = async (pausedSessionId: string) => {
    if (!user) return;

    try {
      // Fetch the paused session
      const { data, error } = await supabase
        .from('paused_sessions')
        .select('*')
        .eq('id', pausedSessionId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Paused session not found');
      }

      // Restore the session state
      setCurrentPlan(data.session_plan as unknown as StudyPlan);
      setCurrentBlockIndex(data.current_block_index);
      setSessionData((data.progress_data as unknown as SessionData) || {
        flashcards: [],
        quiz: { incorrect_questions: [] },
        feynman: { feedback: '' },
        blurting: { feedback: '', missed_concepts: [] },
        phases_used: [],
        topic: '',
        duration: 0
      });
      setAppState('study-session');

      // Delete the paused session
      await supabase
        .from('paused_sessions')
        .delete()
        .eq('id', pausedSessionId);

      toast({
        title: "Session Resumed!",
        description: "Continuing from where you left off.",
      });
    } catch (error) {
      console.error('Failed to resume session:', error);
      toast({
        title: "Resume Failed",
        description: "Failed to resume session. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    appState,
    setAppState,
    isGenerating,
    currentMode,
    setCurrentMode,
    isChatbotExpanded,
    setIsChatbotExpanded,
    currentPlan,
    setCurrentPlan,
    currentBlockIndex,
    setCurrentBlockIndex,
    isSessionRunning,
    setIsSessionRunning,
    sessionData,
    setSessionData,
    handleGeneratePlan,
    getCurrentBlock,
    isLastBlock,
    addQuizMistakes,
    addFlashcards,
    addFeynmanData,
    addBlurtingData,
    addPhaseUsed,
    preloadTeachingContentForBreak,
    getPreloadedTeachingContent,
    clearPreloadedTeachingContent,
    saveSession,
    pauseSession,
    resumeSession,
  };
};
