import { Button } from '@/components/ui/button';
import { CheckCircle, RotateCcw } from 'lucide-react';

interface MasteryActionsProps {
  onMastered: () => void;
  onKeepReviewing: () => void;
  isAnswerRevealed: boolean;
}

const MasteryActions = ({ onMastered, onKeepReviewing, isAnswerRevealed }: MasteryActionsProps) => {
  return (
    <div className="flex items-center justify-center gap-12 mt-8">
      {/* Always show buttons with advanced styling */}
      <Button
        variant="outline"
        size="lg"
        onClick={onKeepReviewing}
        className="group relative overflow-hidden border-2 border-red-400/60 text-red-600 hover:border-red-500 px-16 py-6 text-xl font-bold shadow-xl transition-all duration-300 rounded-2xl bg-gradient-to-br from-red-50/80 to-red-100/60 hover:from-red-100 hover:to-red-200 backdrop-blur-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-center gap-3">
          <RotateCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
          <span className="group-hover:scale-105 transition-transform duration-200">Keep Reviewing</span>
        </div>
      </Button>
      
      <Button
        variant="default"
        size="lg"
        onClick={onMastered}
        className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-green-700 text-white px-16 py-6 text-xl font-bold shadow-xl transition-all duration-300 rounded-2xl border-0"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        <div className="relative flex items-center gap-3">
          <CheckCircle className="w-6 h-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
          <span className="group-hover:scale-105 transition-transform duration-200">Mastered!</span>
        </div>
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-green-400 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300 -z-10" />
      </Button>
    </div>
  );
};

export default MasteryActions;