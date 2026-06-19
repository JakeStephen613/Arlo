export type MasteryStatus = 'reviewing' | 'mastered';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty?: string;
  category?: string;
  masteryStatus: MasteryStatus;
  attempts: number;
  lastReviewed: Date;
  confidenceLevel: number;
}

export interface FlashcardStats {
  total: number;
  reviewing: number;
  mastered: number;
  masteryPercentage: number;
}