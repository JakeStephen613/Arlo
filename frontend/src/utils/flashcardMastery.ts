import { Flashcard, FlashcardStats, MasteryStatus } from '@/types/flashcard';

export const calculateStats = (flashcards: Flashcard[]): FlashcardStats => {
  const total = flashcards.length;
  const reviewing = flashcards.filter(card => card.masteryStatus === 'reviewing').length;
  const mastered = flashcards.filter(card => card.masteryStatus === 'mastered').length;
  const masteryPercentage = total > 0 ? (mastered / total) * 100 : 0;

  return {
    total,
    reviewing,
    mastered,
    masteryPercentage
  };
};

export const getActiveCards = (flashcards: Flashcard[]): Flashcard[] => {
  return flashcards.filter(card => card.masteryStatus !== 'mastered');
};

export const updateCardMastery = (
  flashcards: Flashcard[],
  cardId: string,
  action: 'mastered' | 'keepReviewing'
): Flashcard[] => {
  return flashcards.map(card => {
    if (card.id !== cardId) return card;

    const updatedCard = {
      ...card,
      attempts: card.attempts + 1,
      lastReviewed: new Date()
    };

    if (action === 'mastered') {
      updatedCard.masteryStatus = 'mastered' as MasteryStatus;
      updatedCard.confidenceLevel = 100;
    } else {
      // Keep reviewing
      updatedCard.masteryStatus = 'reviewing' as MasteryStatus;
      updatedCard.confidenceLevel = Math.max(card.confidenceLevel - 10, 0);
    }

    return updatedCard;
  });
};

export const prioritizeCards = (cards: Flashcard[]): Flashcard[] => {
  // All active cards are 'reviewing', so just randomize order
  return [...cards].sort(() => Math.random() - 0.5);
};

export const convertLegacyFlashcards = (flashcards: any[]): Flashcard[] => {
  return flashcards.map(card => ({
    ...card,
    masteryStatus: 'reviewing' as MasteryStatus,
    attempts: 0,
    lastReviewed: new Date(),
    confidenceLevel: 0
  }));
};