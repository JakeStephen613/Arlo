
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Plus, Minus } from 'lucide-react';

interface ProminentTimerProps {
  timeRemaining: number;
  progress: number;
  isRunning: boolean;
  onStartPause: () => void;
  size?: number;
  timerState: 'study' | 'break' | 'paused';
  onAddTime?: (minutes: number) => void;
}

const ProminentTimer = ({ 
  timeRemaining, 
  progress, 
  isRunning, 
  onStartPause,
  size = 160,
  timerState,
  onAddTime
}: ProminentTimerProps) => {
  const radius = (size - 12) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    switch (timerState) {
      case 'break':
        return 'text-green-500';
      case 'study':
        return 'text-indigo-500';
      default:
        return 'text-gray-400';
    }
  };

  const handleAddTime = () => {
    onAddTime?.(2);
  };

  const handleSubtractTime = () => {
    onAddTime?.(-2);
  };

  return (
    <Card className="p-4 bg-white/90 backdrop-blur-sm border-2 border-indigo-100 shadow-lg relative">
      {/* Plus button - top right */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAddTime}
        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 p-0"
      >
        <Plus className="w-4 h-4 text-green-600" />
      </Button>

      {/* Minus button - top left */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSubtractTime}
        className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 p-0"
      >
        <Minus className="w-4 h-4 text-red-600" />
      </Button>

      <div className="flex flex-col items-center gap-4">
        {/* Large Circular Timer */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            className="transform -rotate-90"
            width={size}
            height={size}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-300 ${getTimerColor()}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-800">
              {formatTime(timeRemaining)}
            </span>
            <span className="text-sm text-gray-500 capitalize font-medium">
              {timerState === 'break' ? 'Break Time' : 'Study Time'}
            </span>
          </div>
        </div>

        {/* Control Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStartPause}
          className="flex items-center gap-2"
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Pause' : 'Start'}
        </Button>
      </div>
    </Card>
  );
};

export default ProminentTimer;
