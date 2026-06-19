import { useState, useEffect } from 'react';
import { updateContext } from '@/services/studyModulesApi';
import { usePomodoroClock } from '@/hooks/usePomodoroClock';
import MainSessionTimer from '@/components/session/MainSessionTimer';
import BreakModeScreen from '@/components/session/BreakModeScreen';
import StudyBlockDisplay from '@/components/session/StudyBlockDisplay';
import BlockNavigation from '@/components/session/BlockNavigation';
import type { StudyPlan } from '@/services/api';

interface StudySessionTrackerProps {
  plan: StudyPlan;
  currentBlockIndex: number;
  onSkipToNext: () => void;
  onSkipToPrevious: () => void;
  onStartPause?: () => void;
  isRunning?: boolean;
  onCompleteSession?: () => void;
  onPauseSession?: () => void;
  isLastBlock?: boolean;
  onBlockComplete?: () => void;
  onTriggerBreak?: () => void;
  isBreakActive?: boolean;
  onBreakComplete?: () => void;
  onPreloadTeachingContent?: (currentBlockIndex: number) => Promise<void>;
  expandedBlocks?: any[];
  currentExpandedIndex?: number;
  onBlockClick?: (blockIndex: number) => void;
}

const sendContextUpdate = async (block: any) => {
  try {
    const payload = {
      source: `block_start`,
      user_id: '',
      current_topic: block.unit,
      concept: block.description,
      phase: block.technique,
      duration: block.duration,
      timestamp: new Date().toISOString(),
      block_id: block.id
    };
    await updateContext(payload);
  } catch (error) {
    console.error('Error updating context:', error);
  }
};

const StudySessionTracker = ({
  plan,
  currentBlockIndex,
  onSkipToNext,
  onSkipToPrevious,
  onStartPause,
  isRunning = true,
  onCompleteSession,
  onPauseSession,
  isLastBlock = false,
  onBlockComplete,
  onTriggerBreak,
  isBreakActive = false,
  onBreakComplete,
  onPreloadTeachingContent,
  expandedBlocks = [],
  currentExpandedIndex = 0,
  onBlockClick
}: StudySessionTrackerProps) => {
  const currentBlock = plan.blocks[currentBlockIndex];
  const [hasStartedCurrentBlock, setHasStartedCurrentBlock] = useState(false);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(300); // 5 minutes
  const [hasTriggeredPreload, setHasTriggeredPreload] = useState(false);
  const [isPreloadingComplete, setIsPreloadingComplete] = useState(false);

  // Calculate study duration for current block and total session
  const studyDurationMinutes = currentBlock?.duration || 20;
  const studyDurationSeconds = studyDurationMinutes * 60;
  const totalSessionSeconds = plan.total_duration * 60;
  
  const {
    timeRemaining,
    totalTimeRemaining,
    timerState,
    isRunning: pomodoroIsRunning,
    completedBlocks,
    totalProgress,
    startTimer,
    pauseTimer,
    skipBreak,
    resetTimer,
    addSessionTime,
    completeBlock
  } = usePomodoroClock({
    studyDuration: studyDurationSeconds,
    breakDuration: 300,
    totalSessionDuration: totalSessionSeconds,
    autoStart: true,
    blocksUntilBreak: 2,
    currentBlockIndex,
    onStudyComplete: () => {
      if (isLastBlock && onCompleteSession) {
        onCompleteSession();
      } else {
        onSkipToNext();
      }
    },
    onBreakComplete: () => {
      if (onBreakComplete) {
        onBreakComplete();
      }
    },
    onSessionTimeUp: () => {
    },
    onTriggerBreak: () => {
      if (onTriggerBreak) {
        onTriggerBreak();
      }
    }
  });

  // Break timer countdown effect
  useEffect(() => {
    let breakInterval: NodeJS.Timeout;
    
    if (isBreakActive && breakTimeRemaining > 0) {
      breakInterval = setInterval(() => {
        setBreakTimeRemaining(prev => {
          if (prev <= 1) {
            if (onBreakComplete) {
              onBreakComplete();
            }
            return 300; // Reset for next break
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(breakInterval);
  }, [isBreakActive, breakTimeRemaining, onBreakComplete]);

  // Reset break timer when break starts
  useEffect(() => {
    if (isBreakActive) {
      setBreakTimeRemaining(300);
      setHasTriggeredPreload(false); // Reset preload flag when break starts
      setIsPreloadingComplete(false); // Reset preload completion status
    }
  }, [isBreakActive]);

  // Trigger teaching content preload during break - only during breaks, not on navigation
  useEffect(() => {
    const handlePreloading = async () => {
      if (isBreakActive && !hasTriggeredPreload && onPreloadTeachingContent) {
        setHasTriggeredPreload(true);
        
        try {
          await onPreloadTeachingContent(currentBlockIndex);
          setIsPreloadingComplete(true);
        } catch (error) {
          console.error('❌ Teaching content preload failed:', error);
          // Even if preloading fails, allow user to continue after a delay
          setTimeout(() => {
            setIsPreloadingComplete(true);
          }, 5000);
        }
      }
    };
    
    handlePreloading();
  }, [isBreakActive, hasTriggeredPreload, onPreloadTeachingContent, currentBlockIndex]);

  // Send context update when block starts
  useEffect(() => {
    if (currentBlock && !hasStartedCurrentBlock && pomodoroIsRunning && !isBreakActive) {
      sendContextUpdate(currentBlock);
      setHasStartedCurrentBlock(true);
    }
  }, [currentBlock, hasStartedCurrentBlock, pomodoroIsRunning, isBreakActive]);

  // Reset when block changes
  useEffect(() => {
    if (currentBlock && !isBreakActive) {
      const newStudyDuration = currentBlock.duration * 60;
      resetTimer(newStudyDuration);
      setHasStartedCurrentBlock(false);
    }
  }, [currentBlockIndex, currentBlock, resetTimer, isBreakActive]);

  const handleStartPause = () => {
    if (isBreakActive) return; // Don't allow pause/start during break
    
    if (onStartPause) {
      onStartPause();
    }
    if (pomodoroIsRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  const handleSkipOrComplete = () => {
    if (isBreakActive) return; // Don't allow skip during break
    
    completeBlock(); // This will trigger the break logic
  };

  const handleAddTime = () => {
    addSessionTime(300); // Add 5 minutes
  };

  const handleEndSession = () => {
    if (onCompleteSession) {
      onCompleteSession();
    }
  };

  const handleSkipBreak = () => {
    setBreakTimeRemaining(300); // Reset timer
    setIsPreloadingComplete(false); // Reset preload status
    if (onBreakComplete) {
      onBreakComplete();
    }
  };

  if (!currentBlock) return null;

  // If break is active, show ONLY the break screen (full screen)
  if (isBreakActive) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-50 to-indigo-100">
        <BreakModeScreen 
          timeRemaining={breakTimeRemaining}
          onSkipBreak={handleSkipBreak} 
          completedBlocks={completedBlocks}
          isPreloadingComplete={isPreloadingComplete}
        />
      </div>
    );
  }

  // Normal session view (no break active)
  return (
    <>
      {/* Top Navigation Bar with Study Blocks and Complete Button */}
      <div className="w-full bg-gray-50 py-4 px-6 border-b border-gray-200">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Centered Study blocks navigation */}
          <div className="flex-1 flex justify-center">
            <StudyBlockDisplay 
              blocks={plan.blocks} 
              currentBlockIndex={currentBlockIndex}
              isLastBlock={isLastBlock}
              onCompleteSession={onCompleteSession}
              onPauseSession={onPauseSession}
              expandedBlocks={expandedBlocks}
              currentExpandedIndex={currentExpandedIndex}
              onBlockClick={onBlockClick}
            />
          </div>

          {/* Main Session Timer - Aligned on the right */}
          <div className="flex-shrink-0 ml-6">
            <MainSessionTimer 
              totalTimeRemaining={totalTimeRemaining} 
              totalProgress={totalProgress}
              onAddTime={handleAddTime} 
              onEndSession={handleEndSession} 
            />
          </div>
        </div>
      </div>

      {/* Block Navigation */}
      <BlockNavigation 
        currentBlockIndex={currentExpandedIndex} 
        totalBlocks={expandedBlocks?.length || plan.blocks.length} 
        onPrevious={onSkipToPrevious} 
        onNext={onSkipToNext} 
        canGoPrevious={currentExpandedIndex > 0} 
        canGoNext={currentExpandedIndex < (expandedBlocks?.length || plan.blocks.length) - 1}
        isLastTechniqueOfSession={currentExpandedIndex === (expandedBlocks?.length || plan.blocks.length) - 1}
        onCompleteSession={onCompleteSession}
      />
    </>
  );
};

export default StudySessionTracker;
