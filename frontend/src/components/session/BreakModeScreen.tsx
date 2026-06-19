
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Coffee, SkipForward, BookOpen } from 'lucide-react';

interface BreakModeScreenProps {
  timeRemaining: number;
  onSkipBreak: () => void;
  completedBlocks: number;
  isPreloadingComplete?: boolean;
}

const motivationalTips = [
  "Go stretch and move around",
  "Drink some water to stay hydrated", 
  "Do 10 pushups or jumping jacks",
  "Take 5 deep breaths and relax",
  "Look out the window and rest your eyes",
  "Walk around for a few minutes"
];

const BreakModeScreen = ({ timeRemaining, onSkipBreak, completedBlocks, isPreloadingComplete = false }: BreakModeScreenProps) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Rotate tips every 10 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % motivationalTips.length);
    }, 10000);

    return () => clearInterval(tipInterval);
  }, []);

  return (
    <div className="h-full bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center p-8">
      <Card className="p-8 max-w-lg w-full text-center bg-white/90 backdrop-blur-sm border-2 border-indigo-200 shadow-xl">
        <div className="space-y-6">
          {/* Break Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center">
              <Coffee className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Break Title */}
          <div>
            <h2 className="text-3xl font-bold text-indigo-800 mb-2">Break Time</h2>
            <p className="text-lg text-indigo-600">
              Time to recharge and refresh!
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="py-6">
            <div className="text-5xl font-bold text-indigo-500 mb-2">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-indigo-400">break remaining</p>
          </div>
          
          {/* Teaching Content Preload Indicator */}
          {!isPreloadingComplete && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 justify-center text-blue-700">
                <BookOpen className="w-4 h-4" />
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Preparing next lessons...</span>
              </div>
            </div>
          )}
          
          {isPreloadingComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 justify-center text-green-700">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">✅ Next lessons ready!</span>
              </div>
            </div>
          )}
          
          {/* Motivational Tip with smooth transition */}
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 min-h-[60px] flex items-center justify-center">
            <p className="text-base text-indigo-800 font-medium transition-opacity duration-500">
              💡 {motivationalTips[currentTipIndex]}
            </p>
          </div>

          {/* Skip Button */}
          <Button
            onClick={onSkipBreak}
            variant="outline"
            size="lg"
            disabled={!isPreloadingComplete}
            className={`bg-white border-2 ${
              isPreloadingComplete 
                ? 'hover:bg-indigo-50 border-indigo-300 text-indigo-700 hover:text-indigo-800' 
                : 'border-gray-300 text-gray-400 cursor-not-allowed'
            }`}
          >
            <SkipForward className="w-5 h-5 mr-2" />
            {isPreloadingComplete ? 'Skip Break & Continue Studying' : 'Please wait for content to load...'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BreakModeScreen;
