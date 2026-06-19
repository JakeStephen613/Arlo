
import { Clock } from 'lucide-react';

interface BlockTimerProps {
  timeRemaining: number;
  blockName: string;
}

const BlockTimer = ({
  timeRemaining,
  blockName
}: BlockTimerProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining <= 60; // 1 minute or less

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-md ${
      isLowTime 
        ? 'bg-red-50 border-2 border-red-200 text-red-700' 
        : 'bg-white border border-gray-200 text-gray-800'
    }`}>
      <Clock className={`w-4 h-4 ${isLowTime ? 'text-red-600' : 'text-blue-600'}`} />
      <div className="flex flex-col">
        <span className={`text-sm font-bold ${isLowTime ? 'text-red-600' : 'text-gray-800'}`}>
          {formatTime(timeRemaining)}
        </span>
        <span className="text-xs text-gray-500 capitalize">
          {blockName}
        </span>
      </div>
    </div>
  );
};

export default BlockTimer;
