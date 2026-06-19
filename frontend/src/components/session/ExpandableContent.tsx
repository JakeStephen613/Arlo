
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExpandableContentProps {
  items: any[];
  type: 'flashcards' | 'quiz_mistakes';
  maxInitialItems?: number;
}

// Helper function to safely convert any value to string
const safeStringify = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    if (value.text) return String(value.text);
    if (value.content) return String(value.content);
    if (value.value) return String(value.value);
    return JSON.stringify(value);
  }
  return String(value);
};

const ExpandableContent = ({ items, type, maxInitialItems = 3 }: ExpandableContentProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (items.length === 0) return null;

  const displayItems = isExpanded ? items : items.slice(0, maxInitialItems);
  const remainingCount = items.length - maxInitialItems;

  const renderFlashcard = (card: any, idx: number) => (
    <div key={idx} className="bg-white p-3 rounded border text-sm shadow-sm">
      <p className="font-medium text-blue-800 mb-1">{card.front}</p>
      <p className="text-blue-700">{card.back}</p>
    </div>
  );

  const renderQuizMistake = (mistake: any, idx: number) => (
    <div key={idx} className="bg-white p-3 rounded border text-sm border-l-4 border-red-200">
      <p className="text-red-800 font-medium mb-2">{safeStringify(mistake.question)}</p>
      <p className="text-green-600 text-sm font-medium">Correct: {safeStringify(mistake.correctAnswer || mistake.correct_answer)}</p>
    </div>
  );

  return (
    <div>
      {type === 'flashcards' && (
        <div className="grid grid-cols-1 gap-2">
          {displayItems.map(renderFlashcard)}
        </div>
      )}
      
      {type === 'quiz_mistakes' && (
        <div className="space-y-2">
          {displayItems.map(renderQuizMistake)}
        </div>
      )}

      {remainingCount > 0 && !isExpanded && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="text-xs mt-2 p-1 h-auto text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        >
          +{remainingCount} more {type === 'flashcards' ? 'cards' : 'mistakes'}
        </Button>
      )}

      {isExpanded && remainingCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="text-xs mt-2 p-1 h-auto text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        >
          Show less
        </Button>
      )}
    </div>
  );
};

export default ExpandableContent;
