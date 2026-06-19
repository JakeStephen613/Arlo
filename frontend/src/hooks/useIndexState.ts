import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudySessionWithSequence } from '@/hooks/useStudySessionWithSequence';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePreloader } from '@/hooks/usePreloader';
import { supabase } from '@/integrations/supabase/client';
import type { StudyPlan } from '@/types';

export const useIndexState = () => {
  const session = useStudySessionWithSequence();
  const { user, signOut, userProfile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const preloader = usePreloader();

  const [connectTutorOpen, setConnectTutorOpen] = useState(false);
  const [showStudentDashboard, setShowStudentDashboard] = useState(false);
  const [hasConnectedTutor, setHasConnectedTutor] = useState(false);

  const completedBlocks = useRef(0);
  const completedBlockIds = useRef(new Set<string>());
  const sessionId = useRef('');

  // Redirect tutors to their dashboard
  useEffect(() => {
    if (!loading && user && userProfile?.account_mode === 'tutor') {
      navigate('/tutor');
    }
  }, [user, userProfile, loading, navigate]);

  // Initialize session ID when a session starts
  useEffect(() => {
    if (session.appState === 'study-session' && !sessionId.current) {
      sessionId.current = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else if (session.appState === 'planning') {
      sessionId.current = '';
    }
  }, [session.appState]);

  // Preload critical components when user logs in
  useEffect(() => {
    if (!user) return;
    Promise.all([
      import('@/components/FastSessionPlanner'),
      import('@/components/StudyPlanEditor'),
      import('@/components/StudyWorkspaceWithSequence'),
      import('@/components/ArloChatbot'),
    ]).catch(() => {});
  }, [user]);

  // Check if student has a connected tutor
  useEffect(() => {
    if (!user || userProfile?.account_mode !== 'arlo_tutoring') return;
    supabase
      .from('tutor_student_links')
      .select('id')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setHasConnectedTutor(true);
          setShowStudentDashboard(true);
        }
      });
  }, [user, userProfile]);

  const handleStartSession = (sessionOrPlan: unknown) => {
    const raw = sessionOrPlan as Record<string, unknown>;
    const plan = (raw.session_plan ?? raw) as Record<string, unknown>;
    if (raw.assigned_session_id) plan.assigned_session_id = raw.assigned_session_id;
    if (raw.id && !plan.assigned_session_id) plan.assigned_session_id = raw.id;
    session.setCurrentPlan(plan as unknown as StudyPlan);
    session.setAppState('study-session');
    session.startSession(plan as unknown as StudyPlan);
  };

  const handleResumeSessionFromHook = async (id: string) => {
    await session.resumeSession(id);
  };

  const savePlan = async (updatedPlan: StudyPlan) => {
    session.setCurrentPlan(updatedPlan);
    toast({ title: 'Plan saved', description: 'Your study plan has been updated successfully' });
  };

  const startStudySession = async (plan: StudyPlan) => {
    session.setCurrentPlan(plan);
    session.startSession();
    session.setIsBreakActive(false);
    session.setAppState('study-session');
    completedBlocks.current = 0;
    completedBlockIds.current.clear();
    session.setSessionData(prev => ({ ...prev, topic: plan.topic, duration: plan.total_duration, phases_used: [] }));
    if (plan.blocks[0]?.technique === 'arlo_teaching') session.setIsChatbotExpanded(true);
    await preloader.preloadFirstStudyMode();
    toast({ title: 'Study session started!', description: `Ready to begin with ${plan.blocks[0]?.technique} for ${plan.blocks[0]?.unit}` });
  };

  const handleSkipToNext = async () => {
    if (!session.currentPlan || session.isBreakActive) return;
    if (!session.isLastBlock()) {
      await session.nextBlock();
    } else {
      handleCompleteSession();
    }
  };

  const handleSkipToPrevious = async () => {
    if (session.currentPlan && session.currentExpandedIndex > 0 && !session.isBreakActive) {
      await session.previousBlock();
    }
  };

  const handleBlockClick = (blockIndex: number) => {
    if (!session.currentPlan) return;
    const targetIdx = session.expandedBlocks.findIndex(eb => eb.originalBlockIndex === blockIndex);
    if (targetIdx < 0) return;
    const targetBlock = session.expandedBlocks[targetIdx];
    session.clearIrrelevantPreloadedContent(targetIdx);
    if (targetBlock?.technique === 'teaching' && !session.getPreloadedContent()) {
      session.preloadTeachingContent(targetBlock.id, targetBlock.description);
    }
    session.setCurrentExpandedIndex(targetIdx);
    session.setCurrentMode(null);
    const selectedBlock = session.currentPlan.blocks[blockIndex];
    toast({ title: 'Navigated to block', description: `Now studying: ${selectedBlock?.unit} with ${selectedBlock?.technique}` });
  };

  const handleCompleteSession = () => {
    session.setAppState('session-complete');
    if (session.currentPlan) {
      session.setSessionData({
        topic: session.currentPlan.topic,
        duration: session.currentPlan.total_duration,
        phases_used: session.currentPlan.blocks.map(b => b.technique),
        flashcards: session.sessionData.flashcards,
        quiz: session.sessionData.quiz,
        feynman: session.sessionData.feynman,
        blurting: session.sessionData.blurting,
      });
    }
  };

  const handleEndSession = () => {
    session.setAppState('planning');
    session.setCurrentPlan(null);
    session.setCurrentMode(null);
    session.setIsSessionRunning(false);
    session.setIsChatbotExpanded(false);
    session.setIsBreakActive(false);
    completedBlocks.current = 0;
    completedBlockIds.current.clear();
    sessionId.current = '';
    preloader.clearPreloadedData();
    session.setSessionData({ flashcards: [], quiz: { incorrect_questions: [] }, feynman: { feedback: '' }, blurting: { feedback: '', missed_concepts: [] }, phases_used: [], topic: '', duration: 0 });
  };

  const handlePauseSession = async () => {
    if (!user || !session.currentPlan) return;
    const { error } = await supabase.from('paused_sessions').insert({
      user_id: user.id,
      title: session.currentPlan.topic,
      session_plan: session.currentPlan as unknown as Record<string, unknown>,
      current_block_index: session.currentExpandedIndex,
      progress_data: session.sessionData as unknown as Record<string, unknown>,
    });
    if (error) {
      toast({ title: 'Pause Failed', description: 'Failed to save session progress.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Session Paused!', description: 'Your progress has been saved. You can resume later.' });
    session.setAppState('planning');
    navigate('/');
  };

  const handleTriggerBreak = () => {
    session.setIsBreakActive(true);
    session.setIsSessionRunning(false);
  };

  const handleBreakComplete = async () => {
    session.setIsBreakActive(false);
    session.setIsSessionRunning(true);
    session.resumeFromBreak();
    if (session.currentPlan && !session.isLastBlock()) {
      await session.nextTechnique();
      const currentBlock = session.getCurrentBlock();
      if (currentBlock?.technique === 'arlo_teaching') session.setIsChatbotExpanded(true);
      toast({ title: 'Break finished!', description: `Continuing with: ${currentBlock?.unit} using ${currentBlock?.technique}` });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleConnectTutor = () => setConnectTutorOpen(true);

  const handleTutorConnected = () => {
    setHasConnectedTutor(true);
    setShowStudentDashboard(true);
    toast({ title: 'Dashboard Updated', description: 'You can now see your assigned study sessions in the dashboard below.' });
  };

  return {
    session,
    user,
    userProfile,
    sessionId,
    connectTutorOpen,
    setConnectTutorOpen,
    showStudentDashboard,
    hasConnectedTutor,
    handleStartSession,
    handleResumeSessionFromHook,
    savePlan,
    startStudySession,
    handleSkipToNext,
    handleSkipToPrevious,
    handleBlockClick,
    handleCompleteSession,
    handleEndSession,
    handlePauseSession,
    handleTriggerBreak,
    handleBreakComplete,
    handleSignOut,
    handleConnectTutor,
    handleTutorConnected,
  };
};
