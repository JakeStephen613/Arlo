import { Progress } from '@/components/ui/progress';
import { FlashcardStats } from '@/types/flashcard';

interface MasteryProgressProps {
  stats: FlashcardStats;
}

const MasteryProgress = ({ stats }: MasteryProgressProps) => {
  const reviewingPercentage = (stats.reviewing / stats.total) * 100;
  const masteredPercentage = (stats.mastered / stats.total) * 100;

  return (
    <div className="bg-white/60 backdrop-blur-sm px-6 py-4 border-b border-slate-200 mb-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium text-slate-700">Mastery Progress</span>
          <div className="flex-1">
            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
              {/* Mastered (Green) */}
              <div 
                className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${masteredPercentage}%` }}
              />
              {/* Reviewing (Orange) */}
              <div 
                className="absolute top-0 h-full bg-orange-400 transition-all duration-500"
                style={{ 
                  left: `${masteredPercentage}%`,
                  width: `${reviewingPercentage}%` 
                }}
              />
            </div>
          </div>
          <span className="text-sm font-bold text-emerald-600">
            {Math.round(stats.masteryPercentage)}% Mastered
          </span>
        </div>
        
        {/* Stats Legend */}
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">Mastered ({stats.mastered})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
            <span className="text-slate-600">Reviewing ({stats.reviewing})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasteryProgress;