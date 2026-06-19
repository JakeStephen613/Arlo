
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus } from 'lucide-react';

interface StudyBlockTimerProps {
  duration: number; // in minutes
  onTimeUp: () => void;
  onComplete: () => void;
  isActive: boolean;
  blockName: string;
}

const StudyBlockTimer = ({ duration, onTimeUp, onComplete, isActive, blockName }: StudyBlockTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState(duration * 60); // convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [showTimeUpPrompt, setShowTimeUpPrompt] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start timer when block becomes active
  useEffect(() => {
    if (isActive) {
      setIsRunning(true);
      setTimeRemaining(duration * 60); // Reset timer
      setShowTimeUpPrompt(false);
    } else {
      setIsRunning(false);
    }
  }, [isActive, duration]);

  // Timer countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeRemaining > 0 && isActive) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setShowTimeUpPrompt(true);
            onTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, isActive, blockName, onTimeUp]);

  const handleAddTime = () => {
    setTimeRemaining(prev => prev + 300); // Add 5 minutes
    setIsRunning(true);
    setShowTimeUpPrompt(false);
  };

  const handleMoveOn = () => {
    setShowTimeUpPrompt(false);
    onComplete();
  };

  if (!isActive) return null;

  if (showTimeUpPrompt) {
    return (
      <Card className="absolute top-4 right-4 p-4 bg-yellow-50 border-2 border-yellow-200 shadow-lg min-w-[200px]">
        <div className="text-center space-y-3">
          <h4 className="font-semibold text-yellow-800">Time's Up!</h4>
          <p className="text-sm text-yellow-700">Ready to move on or need more time?</p>
          <div className="flex gap-2">
            <Button
              onClick={handleAddTime}
              variant="outline"
              size="sm"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              <Plus className="w-3 h-3 mr-1" />
              +5 min
            </Button>
            <Button
              onClick={handleMoveOn}
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              Move On
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const isLowTime = timeRemaining <= 60; // 1 minute or less
  const progress = ((duration * 60 - timeRemaining) / (duration * 60)) * 100;

  return (
    <Card className={`absolute top-4 right-4 p-3 shadow-lg min-w-[140px] ${
      isLowTime 
        ? 'bg-red-50 border-2 border-red-200' 
        : 'bg-white border border-gray-200'
    }`}>
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              strokeDasharray={87.96}
              strokeDashoffset={87.96 - (progress / 100) * 87.96}
              className={`transition-all duration-300 ${
                isLowTime ? 'text-red-500' : 'text-blue-500'
              }`}
              strokeLinecap="round"
            />
          </svg>
          <Clock className={`absolute inset-0 w-4 h-4 m-auto ${
            isLowTime ? 'text-red-600' : 'text-blue-600'
          }`} />
        </div>
        <div className="flex flex-col">
          <span className={`text-sm font-bold ${
            isLowTime ? 'text-red-600' : 'text-gray-800'
          }`}>
            {formatTime(timeRemaining)}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {blockName}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default StudyBlockTimer;
