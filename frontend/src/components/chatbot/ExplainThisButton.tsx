
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Loader2 } from 'lucide-react';

interface ExplainThisButtonProps {
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  onGetVisibleContent: () => string;
  onExplain: (content: string) => Promise<void>;
}

const ExplainThisButton = ({ currentBlock, onGetVisibleContent, onExplain }: ExplainThisButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleExplainThis = async () => {
    setIsLoading(true);
    
    try {
      // Get the current visible content
      const visibleContent = onGetVisibleContent();
      await onExplain(visibleContent);
    } catch (error) {
      console.error('Error in ExplainThisButton:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center py-3">
      <Button
        onClick={handleExplainThis}
        disabled={isLoading}
        className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Getting explanation...
          </>
        ) : (
          <>
            <Brain className="w-5 h-5 mr-2" />
            🧠 Explain This
          </>
        )}
      </Button>
    </div>
  );
};

export default ExplainThisButton;
