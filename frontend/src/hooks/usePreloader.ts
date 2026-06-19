
import { useState, useEffect, useRef } from 'react';
import { StudyPlan } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface PreloadState {
  sessionPlannerUI: boolean;
  studyWorkspaceUI: boolean;
  arloUI: boolean;
}

export const usePreloader = () => {
  const { user } = useAuth();
  const [preloadState, setPreloadState] = useState<PreloadState>({
    sessionPlannerUI: false,
    studyWorkspaceUI: false,
    arloUI: false
  });

  const preloadingRef = useRef({
    uiComponents: false
  });

  // Preload all UI components immediately on login - NO CONTENT GENERATION
  useEffect(() => {
    if (user && !preloadingRef.current.uiComponents) {
      preloadingRef.current.uiComponents = true;

      // Preload UI components in background
      Promise.all([
        import('@/components/FastSessionPlanner'),
        import('@/components/StudyWorkspaceWithSequence'),
        import('@/components/ArloChatbot'),
        import('@/components/StudyPlanEditor')
      ]).then(() => {
        setPreloadState(prev => ({
          ...prev,
          sessionPlannerUI: true,
          studyWorkspaceUI: true,
          arloUI: true
        }));
      }).catch(_error => {
        // UI preload failed (non-critical)
      });
    }
  }, [user]);

  return {
    preloadState,
    // All content preloading functions removed - handled by individual modes now
    getPreloadedFlashcards: () => null,
    getPreloadedQuiz: () => null,
    clearPreloadedData: () => {},
    preloadFirstStudyMode: async () => {},
    preloadDuringBreak: async () => {}
  };
};
