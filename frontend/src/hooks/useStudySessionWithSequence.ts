import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateStudyPlan, StudyPlan, ApiError } from '@/services/api';
import { PlanInputData } from '@/components/FastSessionPlanner';
import { validateAndFixStudyPlan } from '@/utils/studyPlanValidation';
import { fetchTeachingContent } from '@/services/teachingApi';
import { saveStudySessionData } from '@/services/sessionApi';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { expandStudyBlocks, ExpandedBlock, getOriginalBlockNavigation } from '@/utils/blockExpansion';
import type { AppState } from '@/types';
export type StudyMode = 'flashcards' | 'quiz' | 'feynman' | 'blurting' | 'teaching' | 'arlo_teaching' | null;

interface TechniquePhase {
  blockId: string;
  blockIndex: number;
  techniqueIndex: number;
  phase: 'teaching' | 'technique';
  techniqueName: string;
  duration: number;
}

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

interface PreloadedContent {
  [key: string]: {
    lessons?: any[];
    teachingLessons?: any[];
    technique?: string;
    description?: string;
    flashcards?: any[];
    quiz?: any[];
    exercises?: any[];
  };
}

export const useStudySessionWithSequence = () => {
  const { user } = useAuth();
  const [appState, setAppState] = useState<AppState>('planning');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentMode, setCurrentMode] = useState<StudyMode>(null);
  const [isChatbotExpanded, setIsChatbotExpanded] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<ExpandedBlock[]>([]);
  const [currentExpandedIndex, setCurrentExpandedIndex] = useState(0);
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [preloadedContent, setPreloadedContent] = useState<PreloadedContent>({});
  const [isPreloadingNext, setIsPreloadingNext] = useState(false);
  const [isBreakActive, setIsBreakActive] = useState(false);

  // Track completed main blocks for break functionality
  const completedBlocks = useRef(0);
  const completedBlockIds = useRef(new Set<string>());
  const nextButtonClicks = useRef(0);

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

  // Auto-preload next block when current block changes
  useEffect(() => {
    if (expandedBlocks.length > 0 && currentExpandedIndex >= 0) {
      // Preload immediately, no delay
      preloadNextBlock();

      // Also preload the block after next for better UX
      if (currentExpandedIndex + 2 < expandedBlocks.length) {
        const blockAfterNext = expandedBlocks[currentExpandedIndex + 2];
        setTimeout(() => {
          preloadTeachingContent(blockAfterNext.id, blockAfterNext.description);
        }, 1000);
      }
    }
  }, [currentExpandedIndex, expandedBlocks.length]);

  // Get current expanded block
  const getCurrentBlock = () => {
    return expandedBlocks[currentExpandedIndex] || null;
  };

  // Check if current block is the last
  const isLastBlock = () => {
    return currentExpandedIndex >= expandedBlocks.length - 1;
  };

  // Get navigation info for main blocks display
  const getNavigation = () => {
    return getOriginalBlockNavigation(expandedBlocks, currentExpandedIndex);
  };

  // Next Technique function for within-block progression
  const nextTechnique = () => {
    if (!expandedBlocks) return;

    // Increment next button click counter for break tracking
    nextButtonClicks.current += 1;

    // Check for break every 5 clicks
    if (nextButtonClicks.current % 5 === 0) {
      triggerStudyBreak();
      return;
    }

    const currentBlock = expandedBlocks[currentExpandedIndex];
    if (!currentBlock) return;

    // Check if this is a sub-block progression or main block progression
    if (!currentBlock.isLastSubBlock) {
      // Moving to next sub-block within the same main block
      const nextSubBlockIndex = currentExpandedIndex + 1;
      const nextSubBlock = expandedBlocks[nextSubBlockIndex];

      // SAFEGUARD 1: Don't allow progression until teaching content is generated
      const currentBlockContentKey = `block-${currentBlock.id}`;
      const currentBlockContent = preloadedContent[currentBlockContentKey];

      // Only allow progression if teaching content exists (except for non-teaching blocks)
      if (currentBlock.technique === 'teaching' && (!currentBlockContent || !currentBlockContent.teachingLessons?.length)) {
        toast({
          title: "Teaching Content Required",
          description: "Please complete the teaching session before proceeding to other modules.",
          variant: "destructive",
        });
        return;
      }

      setCurrentExpandedIndex(nextSubBlockIndex);

      // Get preloaded content for the next sub-block before starting the technique
      const nextBlockContentKey = `block-${nextSubBlock.id}`;
      const nextBlockPreloadedContent = preloadedContent[nextBlockContentKey];

      // Directly start the next technique mode - NO intro screen for sub-blocks
      const nextMode = getTechniqueMode(nextSubBlock.technique);
      setCurrentMode(nextMode);

      // Show toast notification that we're advancing to next technique
      toast({
        title: nextBlockPreloadedContent ? "Next Technique Ready!" : "Loading Next Technique...",
        description: `Moving to ${nextSubBlock.technique} for ${nextSubBlock.unit}`,
      });

      // Only preload the immediate next sub-block, not blocks beyond that
      if (nextSubBlockIndex + 1 < expandedBlocks.length) {
        const blockToPreload = expandedBlocks[nextSubBlockIndex + 1];
        // Only preload if it's still within the same main block OR it's the very next main block
        const isStillInSameMainBlock = currentBlock.originalBlockIndex === blockToPreload.originalBlockIndex;
        const isImmediateNextMainBlock = !isStillInSameMainBlock && nextSubBlockIndex + 1 === currentExpandedIndex + 2;

        if (isStillInSameMainBlock || isImmediateNextMainBlock) {
          preloadTeachingContent(blockToPreload.id, blockToPreload.description);
        }
      }
    } else {
      // This is the last sub-block, moving to next main block (use regular nextBlock logic)
      nextBlock();
    }
  };

  // Preload teaching content function
  const preloadTeachingContent = async (blockId: string, description: string) => {
    const contentKey = `block-${blockId}`;

    if (preloadedContent[contentKey]) {
      return;
    }

    try {
      const response = await fetchTeachingContent(description);

      let lessonData: any[] = [];
      if (response.lesson && Array.isArray(response.lesson)) {
        lessonData = response.lesson;
      } else if (response.lessons && Array.isArray(response.lessons)) {
        lessonData = response.lessons;
      } else if (Array.isArray(response)) {
        lessonData = response;
      }

      setPreloadedContent(prev => ({
        ...prev,
        [contentKey]: {
          lessons: lessonData,
          technique: description,
          description: description
        }
      }));

    } catch (error) {
      console.error(`❌ Failed to preload content for ${contentKey}:`, error);
    }
  };

  // Enhanced preload logic - preload all sub-blocks ahead of time
  const preloadNextBlock = async () => {
    if (isLastBlock()) return;

    const currentBlock = getCurrentBlock();
    const nextBlock = expandedBlocks[currentExpandedIndex + 1];
    if (!nextBlock || !currentBlock) return;

    const contentKey = `block-${nextBlock.id}`;

    if (preloadedContent[contentKey]) {
      return;
    }

    try {
      setIsPreloadingNext(true);

      const response = await fetchTeachingContent(nextBlock.description);

      let lessonData: any[] = [];
      if (response.lesson && Array.isArray(response.lesson)) {
        lessonData = response.lesson;
      } else if (response.lessons && Array.isArray(response.lessons)) {
        lessonData = response.lessons;
      } else if (Array.isArray(response)) {
        lessonData = response;
      }

      setPreloadedContent(prev => {
        const updated = {
          ...prev,
          [contentKey]: {
            lessons: lessonData,
            technique: nextBlock.technique,
            description: nextBlock.description
          }
        };

        return updated;
      });

    } catch (error) {
      console.error(`❌ Failed to preload content for ${contentKey}:`, error);
    } finally {
      setIsPreloadingNext(false);
    }
  };

  // Move to next block (with preloading requirement)
  const nextBlock = async () => {
    if (isLastBlock()) {
      setAppState('session-complete');
      return;
    }

    // Don't allow progression until next block is preloaded
    if (isPreloadingNext) {
      toast({
        title: "Loading next block...",
        description: "Please wait while we prepare the next section.",
      });
      return;
    }

    const currentBlock = expandedBlocks[currentExpandedIndex];
    const newIndex = currentExpandedIndex + 1;
    const nextBlock = expandedBlocks[newIndex];

    // Check if we're moving to a new main block (not just next technique)
    const isMovingToNewMainBlock = currentBlock.originalBlockIndex !== nextBlock.originalBlockIndex;

    if (isMovingToNewMainBlock) {
      // This is a main block completion - check for break
      const shouldTriggerBreak = handleMainBlockCompletion();
      if (shouldTriggerBreak) {
        return; // Break triggered, don't continue to next block
      }

      // If no break triggered, advance to next main block
      setCurrentExpandedIndex(newIndex);
      setCurrentMode(null); // Go to intro for new main block
      return;
    }

    // Moving within same main block (next technique)
    setCurrentExpandedIndex(newIndex);

    // Get the next block and start its technique directly
    const nextBlockData = expandedBlocks[newIndex];
    if (nextBlockData) {
      const mode = getTechniqueMode(nextBlockData.technique);
      setCurrentMode(mode);
    }
  };


  // Move to previous block (enhanced to handle teaching blocks)
  const previousBlock = async () => {
    if (currentExpandedIndex <= 0) return;

    const currentBlock = expandedBlocks[currentExpandedIndex];

    // Special case: If we're on a teaching block (subBlockIndex: -1),
    // we need to find the last technique of the previous main block
    if (currentBlock?.technique === 'teaching' && currentBlock?.subBlockIndex === -1) {
      // Find the last technique block of the previous main block
      const currentOriginalIndex = currentBlock.originalBlockIndex;
      const previousMainBlockIndex = currentOriginalIndex - 1;

      if (previousMainBlockIndex >= 0) {
        // Find all blocks belonging to the previous main block
        const previousMainBlockTechniques = expandedBlocks.filter(
          (block, index) => block.originalBlockIndex === previousMainBlockIndex &&
                           block.technique !== 'teaching' &&
                           index < currentExpandedIndex // Only consider blocks before current
        );

        if (previousMainBlockTechniques.length > 0) {
          // Get the last technique of the previous main block
          const lastTechniqueBlock = previousMainBlockTechniques[previousMainBlockTechniques.length - 1];
          const targetIndex = expandedBlocks.findIndex(b => b.id === lastTechniqueBlock.id);

          setCurrentExpandedIndex(targetIndex);
          const mode = getTechniqueMode(lastTechniqueBlock.technique);
          setCurrentMode(mode);
          return;
        }
      }
    }

    // Default behavior: go to the immediately previous block
    const newIndex = currentExpandedIndex - 1;
    const previousBlock = expandedBlocks[newIndex];

    // Check if we're moving to a different main block
    const isMovingToNewMainBlock = currentBlock.originalBlockIndex !== previousBlock.originalBlockIndex;

    if (isMovingToNewMainBlock) {
      setCurrentExpandedIndex(newIndex);
      setCurrentMode(null); // Go to intro for previous main block
      return;
    }

    // Moving within same main block (previous technique)

    // If the previous block is a teaching block, ensure content is preloaded
    if (previousBlock?.technique === 'teaching') {
      const contentKey = `block-${previousBlock.id}`;

      // Check if content is already preloaded
      if (!preloadedContent[contentKey]) {
        try {
          const response = await fetchTeachingContent(previousBlock.description);

          let lessonData: any[] = [];
          if (response.lesson && Array.isArray(response.lesson)) {
            lessonData = response.lesson;
          } else if (response.lessons && Array.isArray(response.lessons)) {
            lessonData = response.lessons;
          } else if (Array.isArray(response)) {
            lessonData = response;
          }

          setPreloadedContent(prev => ({
            ...prev,
            [contentKey]: {
              lessons: lessonData,
              technique: previousBlock.technique,
              description: previousBlock.description
            }
          }));

        } catch (error) {
          console.error(`❌ Failed to load teaching content for previous block ${contentKey}:`, error);
          toast({
            title: "Loading Error",
            description: "Failed to load teaching content for previous block.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Update the index first
    setCurrentExpandedIndex(newIndex);

    // Set the correct mode for the previous block
    if (previousBlock) {
      const mode = getTechniqueMode(previousBlock.technique);
      setCurrentMode(mode);
    }

    toast({
      title: "Previous Block",
      description: `Moved to ${previousBlock.technique} for ${previousBlock.unit}`,
    });
  };


  // Handle main block completion and break logic
  const handleMainBlockCompletion = (): boolean => {
    const currentBlock = expandedBlocks[currentExpandedIndex];
    const nextBlock = expandedBlocks[currentExpandedIndex + 1];

    // Mark this main block as completed
    if (currentBlock?.originalBlockId && !completedBlockIds.current.has(currentBlock.originalBlockId)) {
      completedBlockIds.current.add(currentBlock.originalBlockId);
      completedBlocks.current += 1;

      // Manual break insertion after the second main block (before third)
      if (completedBlocks.current === 2 && nextBlock) {
        triggerStudyBreak();
        return true; // Break triggered
      }
    }

    return false; // No break triggered, will advance in nextBlock()
  };

  const triggerStudyBreak = async () => {
    setIsBreakActive(true);
    setCurrentMode(null);
    setIsSessionRunning(false);

    toast({
      title: "Break time!",
      description: `Take a 5-minute break after ${nextButtonClicks.current} study phases.`,
    });
  };

  const resumeFromBreak = () => {
    setIsBreakActive(false);
    setIsSessionRunning(true);

    // Reset break counter
    nextButtonClicks.current = 0;

    toast({
      title: "Welcome back!",
      description: "Let's continue with your study session.",
    });
  };

  // Get technique mode
  const getTechniqueMode = (technique: string): StudyMode => {
    const correctedTechnique = technique === 'blurring' ? 'blurting' : technique;

    switch (correctedTechnique.toLowerCase()) {
      case 'flashcards':
        return 'flashcards';
      case 'quiz':
        return 'quiz';
      case 'feynman':
        return 'feynman';
      case 'blurting':
        return 'blurting';
      case 'teaching':
        return 'teaching';
      case 'arlo_teaching':
        return 'arlo_teaching';
      default:
        return 'flashcards';
    }
  };


  // Get preloaded content for current block
  const getPreloadedContent = () => {
    const currentBlock = getCurrentBlock();
    if (!currentBlock) return null;

    const contentKey = `block-${currentBlock.id}`;
    return preloadedContent[contentKey] || null;
  };

  // Get preloaded content for next block (for technique transitions)
  const getPreloadedContentForNext = () => {
    if (currentExpandedIndex + 1 >= expandedBlocks.length) return null;

    const nextBlock = expandedBlocks[currentExpandedIndex + 1];
    if (!nextBlock) return null;

    const contentKey = `block-${nextBlock.id}`;
    const preloaded = preloadedContent[contentKey];

    return preloaded || null;
  };

  // Get preloaded content for the current block - ensures all techniques get teaching content
  const getPreloadedContentForCurrentBlock = () => {
    const currentBlock = getCurrentBlock();
    if (!currentBlock) return null;

    const contentKey = `block-${currentBlock.id}`;
    const blockContent = preloadedContent[contentKey];

    // If current block doesn't have content, try to find content from the original block
    if (!blockContent && currentBlock.originalBlockId) {
      const originalContentKey = `block-${currentBlock.originalBlockId}`;
      const originalContent = preloadedContent[originalContentKey];

      // Also check for teaching block content from the same original block
      const teachingBlockKey = `block-${currentBlock.originalBlockId}-teaching`;
      const teachingContent = preloadedContent[teachingBlockKey];

      // Return the most appropriate content (teaching content takes priority for techniques)
      return teachingContent || originalContent || blockContent;
    }

    return blockContent;
  };

  // Clear irrelevant preloaded content when navigating to prevent stale data
  const clearIrrelevantPreloadedContent = (targetExpandedIndex: number) => {
    const targetBlock = expandedBlocks[targetExpandedIndex];
    if (!targetBlock) return;

    // Keep content for current block, next block, and previous block only
    const keepContentForIndices = [
      targetExpandedIndex - 1, // Previous block
      targetExpandedIndex,     // Current block
      targetExpandedIndex + 1  // Next block
    ].filter(index => index >= 0 && index < expandedBlocks.length);

    const keepContentKeys = new Set<string>();
    keepContentForIndices.forEach(index => {
      const block = expandedBlocks[index];
      if (block) {
        keepContentKeys.add(`block-${block.id}`);
        // Also keep original block content keys
        keepContentKeys.add(`block-${block.originalBlockId}`);
        keepContentKeys.add(`block-${block.originalBlockId}-teaching`);
      }
    });

    // Remove content that's not in the keep list
    const currentKeys = Object.keys(preloadedContent);
    const keysToRemove = currentKeys.filter(key => !keepContentKeys.has(key));

    if (keysToRemove.length > 0) {
      setPreloadedContent(prev => {
        const cleaned = { ...prev };
        keysToRemove.forEach(key => {
          delete cleaned[key];
        });
        return cleaned;
      });
    }
  };

  // Start session with block expansion
  const startSession = (planOverride?: any) => {
    // Use the passed plan if provided, otherwise fall back to currentPlan
    const planToUse = planOverride || currentPlan;

    if (!planToUse) {
      console.error('❌ No plan available to start session');
      return;
    }

    // Reset break tracking
    completedBlocks.current = 0;
    completedBlockIds.current.clear();
    nextButtonClicks.current = 0;

    const expanded = expandStudyBlocks(planToUse);
    setExpandedBlocks(expanded);
    setCurrentExpandedIndex(0);
    setIsSessionRunning(true);
    setAppState('study-session');

    // Update currentPlan if we used an override (to sync state)
    if (planOverride && planOverride !== currentPlan) {
      setCurrentPlan(planOverride);
    }
    setCurrentMode(null);
    setIsBreakActive(false);

    // Note: preloading will be triggered by useEffect when currentExpandedIndex is set
  };

  // Handle generate plan (existing functionality)
  const handleGeneratePlan = async (planData: PlanInputData) => {
    setIsGenerating(true);

    try {
      const rawPlan = await generateStudyPlan(planData);

      const plan = validateAndFixStudyPlan(rawPlan);

      setCurrentPlan(plan);
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

  // Session data management functions (existing)
  const addQuizMistakes = (mistakes: any[]) => {
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
      // The issue: we need to save currentExpandedIndex as-is, no conversion
      const stepToSave = currentExpandedIndex;

      const insertData = {
        user_id: user.id,
        title: currentPlan.topic,
        session_plan: currentPlan as any,
        current_block_index: stepToSave,
        progress_data: JSON.parse(JSON.stringify({
          currentMode,
          isBreakActive,
          isSessionRunning,
          nextButtonClicks: nextButtonClicks.current,
          expandedBlocksLength: expandedBlocks.length
        })) as any
      };

      const { error } = await supabase
        .from('paused_sessions')
        .insert(insertData);

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
      setCurrentMode(null);
      setCurrentExpandedIndex(0);
      setIsSessionRunning(false);
        setSessionData({
        quiz: { incorrect_questions: [] },
        flashcards: [],
        feynman: { feedback: '', follow_up_question: '' },
        blurting: { feedback: '', missed_concepts: [] },
        phases_used: [],
        topic: '',
        duration: 0
      });

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

      // Restore the session state and expand blocks
      const plan = data.session_plan as any;
      setCurrentPlan(plan);

      // Expand blocks again for consistency
      const expanded = expandStudyBlocks(plan);
      setExpandedBlocks(expanded);

      // Simple: just restore the step number
      const stepNumber = data.current_block_index; // This is the step number the navigator uses

      setCurrentExpandedIndex(stepNumber);
      setIsSessionRunning(true);

      // Restore simple progress data if available
      if (data.progress_data) {
        const progressData = data.progress_data as any;
        if (progressData.currentMode) {
          setCurrentMode(progressData.currentMode);
        }
        if (progressData.isBreakActive !== undefined) {
          setIsBreakActive(progressData.isBreakActive);
        }
        if (progressData.nextButtonClicks !== undefined) {
          nextButtonClicks.current = progressData.nextButtonClicks;
        }
      }

      setAppState('study-session');

      // If no mode was restored, determine it from current block
      if (!(data.progress_data as any)?.currentMode) {
        const currentBlock = expanded[stepNumber];
        if (currentBlock && currentBlock.technique !== 'teaching') {
          const mode = getTechniqueMode(currentBlock.technique);
          setCurrentMode(mode);
        }
      }

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
    expandedBlocks,
    currentExpandedIndex,
    setCurrentExpandedIndex,
    isSessionRunning,
    setIsSessionRunning,
    sessionData,
    setSessionData,
    handleGeneratePlan,
    startSession,
    getCurrentBlock,
    isLastBlock,
    getNavigation,
    nextBlock,
    nextTechnique,
    previousBlock,
    getPreloadedContent,
    getPreloadedContentForNext,
    getPreloadedContentForCurrentBlock,
    clearIrrelevantPreloadedContent,
    preloadTeachingContent,
    addQuizMistakes,
    addFlashcards,
    addFeynmanData,
    addBlurtingData,
    addPhaseUsed,
    saveSession,
    pauseSession,
    resumeSession,
    isPreloadingNext,
    isBreakActive,
    setIsBreakActive,
    resumeFromBreak,
    handleResumeSession: resumeSession,
    handlePauseSession: pauseSession,
  };
};
