import { apiPost } from '@/lib/apiClient';

const TIMEOUT_MS = 30_000;

// New Feynman Exercise Interfaces
export interface FeynmanExerciseRequest {
  teaching_content: string;
  user_id?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  subject_area?: string;
}

export interface FeynmanExerciseResponse {
  questions: string[];
}

// New Feynman Assessment Interfaces
export interface FeynmanAssessRequest {
  question: string;
  user_explanation: string;
  user_id?: string;
}

export interface FeynmanAssessResponse {
  mastery_score: number;
  what_went_well: string[];
  gaps_in_understanding: string[];
}

// Legacy interfaces for backward compatibility
export interface FeynmanRequest {
  concept: string;
  user_explanation: string;
  personalized_context?: string;
  user_id: string;
}

export interface FeynmanResponse {
  message: string;
  follow_up_question?: string;
  action_suggestion?: string;
}

export interface FeynmanExercise {
  prompt: string;
  focus: string;
}

export interface BlurtingRequest {
  exercise_question: string;
  blurted_response: string;
  user_id?: string;
}

export interface BlurtingResponse {
  mentioned: string[];
  partial_mentions: string[];
  missed: string[];
  mentioned_count: number;
  total_key_concepts: number;
  score_fraction: string;
  feedback: string;
}

export interface BlurtingExerciseRequest {
  teaching_block: string;
  user_id?: string;
}

export interface BlurtingExercise {
  prompt: string;
  focus: string;
}

export interface BlurtingExerciseResponse {
  exercise_1: BlurtingExercise;
  exercise_2: BlurtingExercise;
  exercise_3: BlurtingExercise;
}

const wrapTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
  promise.catch((error: unknown) => {
    if ((error as DOMException).name === 'AbortError') {
      throw new Error(`Request timed out - ${label} is unavailable`);
    }
    throw error;
  });

export const generateFeynmanExercises = (
  request: FeynmanExerciseRequest
): Promise<FeynmanExerciseResponse> =>
  wrapTimeout(
    apiPost<FeynmanExerciseResponse>('/feynman/exercises', request, TIMEOUT_MS),
    'Feynman exercises service'
  );

export const assessFeynmanExplanation = (
  request: FeynmanAssessRequest
): Promise<FeynmanAssessResponse> =>
  wrapTimeout(
    apiPost<FeynmanAssessResponse>('/feynman/assess', request, TIMEOUT_MS),
    'Feynman assessment service'
  );

export const generateBlurtingExercises = (
  request: BlurtingExerciseRequest
): Promise<BlurtingExerciseResponse> =>
  wrapTimeout(
    apiPost<BlurtingExerciseResponse>('/blurting/exercises', request, TIMEOUT_MS),
    'Blurting exercises service'
  );

export const sendFeynmanExplanation = (
  request: FeynmanRequest
): Promise<FeynmanResponse> =>
  wrapTimeout(
    apiPost<FeynmanResponse>('/feynman', request, TIMEOUT_MS),
    'Feynman service'
  );

export const sendBlurtingContent = (
  request: BlurtingRequest
): Promise<BlurtingResponse> =>
  wrapTimeout(
    apiPost<BlurtingResponse>('/blurting/feedback', request, TIMEOUT_MS),
    'Blurting service'
  );
