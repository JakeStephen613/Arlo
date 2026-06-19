
import { Card } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface SessionTimerProps {
  sessionTimeElapsed: number;
}

const SessionTimer = ({ sessionTimeElapsed }: SessionTimerProps) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-3 bg-white/90 backdrop-blur-sm border-2 border-indigo-100 shadow-lg">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-indigo-600" />
        <div className="text-right">
          <div className="text-sm font-medium text-gray-600">Session Time</div>
          <div className="text-lg font-bold text-indigo-600">
            {formatTime(sessionTimeElapsed)}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SessionTimer;
