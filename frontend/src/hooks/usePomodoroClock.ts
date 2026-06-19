
import { useState, useEffect, useCallback } from 'react';

export type TimerState = 'study' | 'break' | 'paused';

interface UsePomodoroClocksProps {
  studyDuration: number; // in seconds
  breakDuration?: number; // in seconds (default 300 = 5 minutes)
  totalSessionDuration: number; // total session time in seconds
  onStudyComplete?: () => void;
  onBreakComplete?: () => void;
  autoStart?: boolean;
  blocksUntilBreak?: number; // Number of blocks before break (default 2)
  currentBlockIndex?: number;
  onSessionTimeUp?: () => void;
  onTriggerBreak?: () => void; // New callback for triggering breaks
}

export const usePomodoroClock = ({
  studyDuration,
  breakDuration = 300, // 5 minutes default
  totalSessionDuration,
  onStudyComplete,
  onBreakComplete,
  autoStart = true,
  blocksUntilBreak = 2,
  currentBlockIndex = 0,
  onSessionTimeUp,
  onTriggerBreak
}: UsePomodoroClocksProps) => {
  const [timeRemaining, setTimeRemaining] = useState(studyDuration);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(totalSessionDuration);
  const [timerState, setTimerState] = useState<TimerState>('paused');
  const [isRunning, setIsRunning] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState(0);

  // Start timer
  const startTimer = useCallback(() => {
    setIsRunning(true);
    if (timerState === 'paused') {
      setTimerState('study');
    }
  }, [timerState]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Skip break
  const skipBreak = useCallback(() => {
    if (timerState === 'break') {
      setTimerState('study');
      setTimeRemaining(studyDuration);
      onBreakComplete?.();
    }
  }, [timerState, studyDuration, onBreakComplete]);

  // Reset timer for new block
  const resetTimer = useCallback((newDuration?: number) => {
    const duration = newDuration || studyDuration;
    setTimeRemaining(duration);
    setTimerState('study');
    setIsRunning(autoStart);
  }, [studyDuration, autoStart]);

  // Add time to total session
  const addSessionTime = useCallback((seconds: number) => {
    setTotalTimeRemaining(prev => prev + seconds);
  }, []);

  // Add or subtract time from current timer
  const addTime = useCallback((minutes: number) => {
    const seconds = minutes * 60;
    setTimeRemaining(prev => Math.max(0, prev + seconds));
  }, []);

  // Complete current block - this is the key function that should be called when a block is actually completed
  const completeBlock = useCallback(() => {
    const newCompletedBlocks = completedBlocks + 1;
    setCompletedBlocks(newCompletedBlocks);

    // Check if break should be triggered after every 2 blocks
    if (newCompletedBlocks % blocksUntilBreak === 0) {
      setTimerState('break');
      setTimeRemaining(breakDuration);
      setIsRunning(true); // Keep running during break
      
      // Call the break trigger callback
      if (onTriggerBreak) {
        onTriggerBreak();
      }
    } else {
      // Continue to next block
      onStudyComplete?.();
    }
  }, [completedBlocks, blocksUntilBreak, breakDuration, onStudyComplete, onTriggerBreak]);

  // Auto-start if specified
  useEffect(() => {
    if (autoStart && timerState === 'paused') {
      startTimer();
    }
  }, [autoStart, timerState, startTimer]);

  // Main timer countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer completed
            if (timerState === 'study') {
              // Study block completed - automatically trigger completion
              completeBlock();
              return 0;
            } else if (timerState === 'break') {
              // Break completed
              setTimerState('study');
              onBreakComplete?.();
              return studyDuration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, timerState, studyDuration, completeBlock, onBreakComplete]);

  // Total session timer (always counts down when running and in study mode)
  useEffect(() => {
    let sessionInterval: NodeJS.Timeout;
    
    if (isRunning && timerState === 'study' && totalTimeRemaining > 0) {
      sessionInterval = setInterval(() => {
        setTotalTimeRemaining(prev => {
          if (prev <= 1) {
            onSessionTimeUp?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(sessionInterval);
  }, [isRunning, timerState, totalTimeRemaining, onSessionTimeUp]);

  // Reset block timer when currentBlockIndex changes
  useEffect(() => {
    if (currentBlockIndex >= 0) {
      resetTimer();
    }
  }, [currentBlockIndex, resetTimer]);

  const progress = timerState === 'study' 
    ? ((studyDuration - timeRemaining) / studyDuration) * 100
    : ((breakDuration - timeRemaining) / breakDuration) * 100;

  const totalProgress = ((totalSessionDuration - totalTimeRemaining) / totalSessionDuration) * 100;

  return {
    timeRemaining,
    totalTimeRemaining,
    timerState,
    isRunning,
    progress,
    totalProgress,
    completedBlocks,
    startTimer,
    pauseTimer,
    skipBreak,
    resetTimer,
    completeBlock,
    addSessionTime,
    addTime
  };
};
