import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import AddFlashcardForm from './AddFlashcardForm';
import MasteryActions from './MasteryActions';
import MasteryProgress from './MasteryProgress';
import { Flashcard } from '@/types/flashcard';
import { calculateStats } from '@/utils/flashcardMastery';

interface FlashcardDisplayProps {
  flashcards: Flashcard[];
  allFlashcards: Flashcard[];
  onExit: () => void;
  onComplete: () => void;
  onAddFlashcard?: (front: string, back: string) => void;
  
  onMasteryAction: (action: 'mastered' | 'keepReviewing') => void;
  onGetCurrentContent?: (content: string) => void;
  isLastTechniqueOfSession?: boolean;
}

const FlashcardDisplay = ({
  flashcards,
  allFlashcards,
  onExit,
  onComplete,
  onAddFlashcard,
  onMasteryAction,
  onGetCurrentContent,
  isLastTechniqueOfSession = false
}: FlashcardDisplayProps) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-advance to next card or loop back to beginning
  const handleMasteryDecision = (action: 'mastered' | 'keepReviewing') => {
    onMasteryAction(action);
    
    // Move to next card or loop back to beginning
    if (currentCard < flashcards.length - 1) {
      setCurrentCard(prev => prev + 1);
    } else {
      setCurrentCard(0); // Loop back to beginning
    }
    
    setIsFlipped(false);
  };

  // Reset currentCard if it goes out of bounds
  useEffect(() => {
    if (flashcards.length > 0 && currentCard >= flashcards.length) {
      setCurrentCard(0);
    }
  }, [flashcards.length, currentCard]);

  useEffect(() => {
    if (onGetCurrentContent && flashcards[currentCard]) {
      const currentContent = isFlipped 
        ? `Question: ${flashcards[currentCard].front}\nAnswer: ${flashcards[currentCard].back}`
        : flashcards[currentCard].front;
      onGetCurrentContent(currentContent);
    }
  }, [currentCard, isFlipped, flashcards, onGetCurrentContent]);

  const handleAddFlashcard = (front: string, back: string) => {
    if (onAddFlashcard) {
      onAddFlashcard(front, back);
      setShowAddForm(false);
    }
  };

  const masteryStats = calculateStats(allFlashcards);

  if (flashcards.length === 0 || !flashcards[currentCard]) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">🎉 All Cards Mastered!</h2>
          <p className="text-slate-600 mb-6">You've mastered all flashcards in this session.</p>
          <Button onClick={onComplete} className="bg-emerald-500 hover:bg-emerald-600 px-8">
            {isLastTechniqueOfSession ? 'Complete Session' : 'Continue'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onExit}
              className="hover:bg-slate-100 rounded-full"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Flashcards</h1>
              <p className="text-slate-600">Master your cards with continuous review</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            
            {/* Add Flashcard Plus Icon */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="h-10 w-10 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-md"
              title="Add new flashcard"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mastery Progress Bar */}
      <MasteryProgress stats={masteryStats} />

      {/* Main Flashcard Area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-4xl">
          {/* Enhanced Flashcard */}
          <div className="perspective-1000 h-96 mb-8">
            <div 
              className={`relative w-full h-full transition-transform duration-700 preserve-3d cursor-pointer ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front of card */}
              <Card className="absolute inset-0 backface-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-indigo-50">
                <CardContent className="h-full flex flex-col items-center justify-center p-8 relative">
                  <div className="absolute top-4 right-4">
                    <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                  </div>
                  <div className="text-center max-w-2xl">
                    <div className="mb-6 text-sm font-medium text-indigo-600 uppercase tracking-wide">Question</div>
                    <p className="text-3xl text-slate-800 mb-8 leading-relaxed font-medium">
                      {flashcards[currentCard]?.front || 'Loading...'}
                    </p>
                    <div className="text-slate-500 text-lg">
                      Click to reveal answer
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Back of card */}
              <Card className="absolute inset-0 backface-hidden rotate-y-180 shadow-2xl hover:shadow-3xl transition-all duration-300 border-0 bg-gradient-to-br from-emerald-50 to-green-100">
                <CardContent className="h-full flex flex-col items-center justify-center p-8 relative">
                  <div className="absolute top-4 right-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  </div>
                  <div className="text-center max-w-2xl">
                    <div className="mb-6 text-sm font-medium text-emerald-600 uppercase tracking-wide">Answer</div>
                    <p className="text-3xl text-slate-800 leading-relaxed font-medium">
                      {flashcards[currentCard]?.back || 'Loading...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mastery Action Buttons */}
          <MasteryActions
            onMastered={() => handleMasteryDecision('mastered')}
            onKeepReviewing={() => handleMasteryDecision('keepReviewing')}
            isAnswerRevealed={isFlipped}
          />
        </div>
      </div>

      {/* Add Flashcard Form */}
      {showAddForm && (
        <div className="bg-white/90 backdrop-blur-sm border-t border-slate-200 p-6">
          <div className="max-w-2xl mx-auto">
            <AddFlashcardForm
              onSave={handleAddFlashcard}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardDisplay;