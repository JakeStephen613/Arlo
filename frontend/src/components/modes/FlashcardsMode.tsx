import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UniversalLoadingScreen } from '@/components/common/loading';
import { fetchFlashcards, updateContext } from '@/services/studyModulesApi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import FlashcardSetup from './flashcards/FlashcardSetup';
import FlashcardDisplay from './flashcards/FlashcardDisplay';
import { Flashcard } from '@/types/flashcard';
import { convertLegacyFlashcards, updateCardMastery, getActiveCards, calculateStats } from '@/utils/flashcardMastery';

interface FlashcardsModeProps {
  onExit: () => void;
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  isLastBlock?: boolean;
  onCompleteSession?: () => void;
  onAddFlashcards?: (flashcards: any[]) => void;
  onAddPhaseUsed?: (phase: string) => void;
  teachingLessons?: any[] | null;
}

const FlashcardsMode = ({ 
  onExit, 
  currentBlock, 
  isLastBlock = false,
  onCompleteSession,
  onAddFlashcards,
  onAddPhaseUsed,
  teachingLessons = null
}: FlashcardsModeProps) => {
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [activeCards, setActiveCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [addedFlashcards, setAddedFlashcards] = useState<Flashcard[]>([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  
  // Debug component lifecycle
  useEffect(() => {
    
    return () => {
    };
  }, []); // Empty dependency array - only runs on mount/unmount
  
  // Debug when currentIndex changes
  useEffect(() => {
  }, [currentIndex]);
  const { toast } = useToast();
  
  // Prevent duplicate processing and notifications
  const hasProcessedPreloadedRef = useRef(false);
  const hasNotifiedRef = useRef(false);
  const contextUpdateSentRef = useRef(false);

  // Helper function to flatten teaching lessons into content string
  const flattenLessonsToContent = (lessons: any[]): string => {
    
    return lessons
      .map(block => {
        if (block.type === 'section') {
          return `${block.title}: ${block.content}`;
        } else if (block.type === 'bullet_list') {
          const bulletContent = Array.isArray(block.content)
            ? block.content.join("; ")
            : block.content;
          return `${block.title}: ${bulletContent}`;
        } else {
          const content = Array.isArray(block.content)
            ? block.content.join("; ")
            : block.content;
          return `${block.title || 'Content'}: ${content}`;
        }
      })
      .join("\n\n");
  };

  // No more preloading - removed for manual generation approach

  // Send context update only once per session
  const sendContextUpdate = async (flashcardTopic: string) => {
    if (!user || !currentBlock || contextUpdateSentRef.current) return;
    
    contextUpdateSentRef.current = true;
    
    try {
      await updateContext({
        source: `user:${user.id}`,
        user_id: user.id,
        current_topic: flashcardTopic,
        concept: currentBlock.description,
        phase: 'flashcards',
        duration: currentBlock.duration,
        timestamp: new Date().toISOString(),
        block_id: currentBlock.id
      });
    } catch (error) {
      contextUpdateSentRef.current = false; // Allow retry if it failed
    }
  };

  const generateFlashcards = async (count: number, flashcardTopic: string, useCustom: boolean) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate flashcards",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTopic(flashcardTopic);
    
    // Send context update (only once)
    sendContextUpdate(flashcardTopic);

    try {
      
      let content: string;
      
      if (teachingLessons && teachingLessons.length > 0) {
        // Use teaching lessons as primary input - flatten to string
        content = flattenLessonsToContent(teachingLessons);
      } else if (useCustom) {
        // Fallback to custom topic
        content = flashcardTopic;
      } else {
        // Fallback to current block description
        content = currentBlock?.description || flashcardTopic;
      }
      
      // Use the simplified API format: content, format, user_id
      const response = await fetchFlashcards({
        content,
        format: 'Q&A',
        user_id: user.id
      });


      if (!response.flashcards || response.flashcards.length === 0) {
        throw new Error('No flashcards were generated. Please try again.');
      }

      // Validate and clean flashcards data, then convert to new format
      const validFlashcards = convertLegacyFlashcards(
        response.flashcards
          .filter((card: any) => card.front && card.back)
          .map((card: any, index: number) => ({
            id: card.id || `generated-${Date.now()}-${index}`,
            front: String(card.front).trim(),
            back: String(card.back).trim(),
            difficulty: card.difficulty,
            category: card.category
          }))
          .filter((card: any) => card.front !== '' && card.back !== '')
      );


      if (validFlashcards.length === 0) {
        throw new Error('Generated flashcards are empty. Please try again with different content.');
      }

      setFlashcards(validFlashcards);
      setActiveCards(getActiveCards(validFlashcards));
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsSessionComplete(false);

      if (onAddFlashcards) {
        onAddFlashcards(validFlashcards);
      }

      if (onAddPhaseUsed) {
        onAddPhaseUsed('flashcards');
      }

      // Show notification only if not already shown
      if (!hasNotifiedRef.current) {
        hasNotifiedRef.current = true;
        toast({
          title: "Flashcards Generated",
          description: `${validFlashcards.length} flashcards ready for study!`,
        });
      }

    } catch (error) {
      console.error('Failed to generate flashcards:', error);
      
      toast({
        title: "Flashcard Generation Failed",
        description: "Unable to generate flashcards. Please check the content format and try again.",
        variant: "destructive",
      });
      
      onExit();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFlashcard = (front: string, back: string) => {
    const newFlashcard: Flashcard = {
      id: `user-${Date.now()}`,
      front,
      back,
      masteryStatus: 'reviewing',
      attempts: 0,
      lastReviewed: new Date(),
      confidenceLevel: 0
    };
    
    setFlashcards(prev => [...prev, newFlashcard]);
    setActiveCards(prev => [...prev, newFlashcard]);
    setAddedFlashcards(prev => [...prev, newFlashcard]);
    
    toast({
      title: "Flashcard Added",
      description: "New flashcard has been added to your deck!",
    });
  };



  const handleMasteryAction = (action: 'mastered' | 'keepReviewing') => {
    if (activeCards.length === 0) return;
    
    const currentCard = activeCards[currentIndex];
    const updatedFlashcards = updateCardMastery(flashcards, currentCard.id, action);
    const newActiveCards = getActiveCards(updatedFlashcards);
    
    setFlashcards(updatedFlashcards);
    setActiveCards(newActiveCards);
    
    // Check if session is complete (all cards mastered)
    if (newActiveCards.length === 0) {
      setIsSessionComplete(true);
      toast({
        title: "Congratulations! 🎉",
        description: "You've mastered all flashcards!",
      });
      return;
    }
    
    // Move to next card or wrap around to beginning
    if (currentIndex >= newActiveCards.length) {
      setCurrentIndex(0);
    }
    
    setIsFlipped(false);
  };

  const handleComplete = () => {
    // Add any new flashcards to the session data when completing
    if (addedFlashcards.length > 0 && onAddFlashcards) {
      onAddFlashcards([...flashcards]);
    }
    
    if (isLastBlock && onCompleteSession) {
      onCompleteSession();
    } else {
      onExit();
    }
  };

  if (flashcards.length === 0 && !isLoading) {
    return (
      <Card className="h-full">
        <div className="p-6 h-full">
          <FlashcardSetup
            currentBlock={currentBlock}
            onExit={onExit}
            onGenerate={generateFlashcards}
            isLoading={isLoading}
          />
        </div>
      </Card>
    );
  }

  // Show completion screen when all cards are mastered
  if (isSessionComplete || activeCards.length === 0 && flashcards.length > 0) {
    const stats = calculateStats(flashcards);
    
    return (
      <Card className="h-full">
        <div className="p-6 h-full flex flex-col items-center justify-center text-center space-y-6">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Session Complete!</h2>
          <p className="text-lg text-slate-600 mb-6">
            You've mastered all {stats.total} flashcards!
          </p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{stats.mastered}</div>
              <div className="text-sm text-emerald-700">Mastered</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.reviewing}</div>
              <div className="text-sm text-orange-700">Reviewing</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-slate-600">{stats.total}</div>
              <div className="text-sm text-slate-700">Total Cards</div>
            </div>
          </div>
          <Button
            onClick={handleComplete}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-8 py-3 text-lg"
            size="lg"
          >
            {isLastBlock ? 'Complete Session' : 'Continue to Next Block'}
          </Button>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <UniversalLoadingScreen
        technique="flashcards"
        title="Creating your flashcards..."
        subtitle="ARLO is generating personalized study cards for optimal learning"
        showMessages={true}
      />
    );
  }

  return (
    <Card className="h-full">
      <div className="p-6 h-full">
        <FlashcardDisplay
          flashcards={activeCards}
          allFlashcards={flashcards}
          onExit={onExit}
          onComplete={handleComplete}
          onAddFlashcard={handleAddFlashcard}
          onMasteryAction={handleMasteryAction}
          isLastTechniqueOfSession={isLastBlock}
        />
      </div>
    </Card>
  );
};

export default FlashcardsMode;
