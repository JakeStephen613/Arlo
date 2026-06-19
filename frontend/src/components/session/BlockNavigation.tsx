
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BlockNavigationProps {
  currentBlockIndex: number;
  totalBlocks: number;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLastTechniqueOfSession?: boolean;
  onCompleteSession?: () => void;
}

const BlockNavigation = ({
  currentBlockIndex,
  totalBlocks,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  isLastTechniqueOfSession = false,
  onCompleteSession
}: BlockNavigationProps) => {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="flex items-center gap-4 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg border border-gray-200">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="rounded-full"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        
        <div className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
          Step {currentBlockIndex + 1} of {totalBlocks}
        </div>
        
        <Button
          variant={isLastTechniqueOfSession ? "default" : "outline"}
          size="sm"
          onClick={isLastTechniqueOfSession && onCompleteSession ? onCompleteSession : onNext}
          disabled={!canGoNext && !(isLastTechniqueOfSession && onCompleteSession)}
          className={`rounded-full ${isLastTechniqueOfSession ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' : ''}`}
        >
          {isLastTechniqueOfSession ? 'Complete' : 'Next'}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default BlockNavigation;
