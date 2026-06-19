
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus } from 'lucide-react';

interface MainSessionTimerProps {
  totalTimeRemaining: number;
  totalProgress: number;
  onAddTime: () => void;
  onEndSession: () => void;
}

const MainSessionTimer = ({ totalTimeRemaining, totalProgress = 0, onAddTime, onEndSession }: MainSessionTimerProps) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = totalTimeRemaining <= 300; // 5 minutes or less
  const size = 120;
  const radius = (size - 12) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (totalProgress / 100) * circumference;

  // Show completion prompt when time is up
  if (totalTimeRemaining <= 0) {
    return (
      <Card className="p-4 bg-red-50 border-2 border-red-200 shadow-lg">
        <div className="text-center space-y-3">
          <h3 className="font-bold text-red-800">Time's Up!</h3>
          <p className="text-sm text-red-700">Add 5 more minutes or finish session?</p>
          <div className="flex gap-2 justify-center">
            <Button
              onClick={onAddTime}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add 5 min
            </Button>
            <Button
              onClick={onEndSession}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              End Session
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 shadow-lg ${isLowTime ? 'bg-red-50 border-2 border-red-200' : 'bg-white/90 backdrop-blur-sm border-2 border-indigo-100'}`}>
      <div className="flex flex-col items-center gap-3">
        {/* Circular Progress Timer */}
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
              className={`transition-all duration-300 ${isLowTime ? 'text-red-500' : 'text-indigo-500'}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-xl font-bold ${isLowTime ? 'text-red-600' : 'text-indigo-600'}`}>
              {formatTime(totalTimeRemaining)}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Session Time
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MainSessionTimer;
