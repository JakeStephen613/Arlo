
import { Button } from '@/components/ui/button';
import { Play, Pause, Check, PauseCircle } from 'lucide-react';

interface SessionControlsProps {
  isRunning: boolean;
  isLastBlock: boolean;
  onStartPause: () => void;
  onSkipOrComplete: () => void;
  onPauseSession?: () => void;
}

const SessionControls = ({ 
  isRunning, 
  isLastBlock, 
  onStartPause, 
  onSkipOrComplete,
  onPauseSession
}: SessionControlsProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onStartPause}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {isRunning ? 'Pause' : 'Start'}
      </Button>
      
      {/* Show pause session during the session, complete session at the end */}
      {!isLastBlock ? (
        <>
          <Button
            onClick={onSkipOrComplete}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Complete Block
          </Button>
          {onPauseSession && (
            <Button
              onClick={onPauseSession}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <PauseCircle className="w-4 h-4" />
              Pause Session
            </Button>
          )}
        </>
      ) : (
        <Button
          onClick={onSkipOrComplete}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Complete Session
        </Button>
      )}
    </div>
  );
};

export default SessionControls;
