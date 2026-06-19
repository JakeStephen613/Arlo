
export interface TechniqueStep {
  technique: string;
  duration: number;
  order: number;
  description?: string;
}

export interface StudyBlock {
  id: string;
  unit: string;
  technique: string;
  techniques?: TechniqueStep[];
  phase: string;
  tool: string;
  duration: number;
  total_duration?: number;
  description: string;
  position: number;
  custom: boolean;
  user_notes: string | null;
}

export interface StudyPlan {
  session_id: string;
  topic: string;
  total_duration: number;
  pomodoro: string;
  units_to_cover: string[];
  techniques: string[];
  blocks: StudyBlock[];
}

export type StudyTechnique = 'flashcards' | 'feynman' | 'blurting' | 'quiz' | 'teaching';

export type AppState = 'planning' | 'editing-plan' | 'study-session' | 'session-complete';
