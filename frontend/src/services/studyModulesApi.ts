import { apiPost, apiPostAnon } from '@/lib/apiClient';

export interface FlashcardRequest {
  content: string;
  format?: 'Q&A';
  user_id?: string;
}

export interface FlashcardResponseItem {
  question: string;
  answer: string;
}

export interface FlashcardResponse {
  flashcards: FlashcardResponseItem[];
}

export interface QuizRequest {
  content: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  question_types?: string[];
  user_id?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  type: 'multiple_choice';
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty?: string;
  category?: string;
}

export interface QuizResponse {
  quiz_id: string;
  questions: QuizQuestion[];
  total_questions: number;
  estimated_time_minutes: number;
}

export interface ChatbotInput {
  user_input: string;
  topic: string;
  target_level?: string;
  message_history?: Array<{ role: string; content: string }>;
  user_id?: string;
}

export interface ChatbotResponse {
  message: string;
  follow_up_question?: string;
  context_update_required?: boolean;
  learning_concepts_covered?: string[];
  confidence_level?: string;
}

export const fetchFlashcards = (request: FlashcardRequest): Promise<FlashcardResponse> =>
  apiPost<FlashcardResponse>('/flashcards', request);

export const fetchQuiz = (request: QuizRequest): Promise<QuizResponse> =>
  apiPost<QuizResponse>('/quiz/generate', request);

export const sendChatbotMessage = (data: ChatbotInput): Promise<ChatbotResponse> =>
  apiPostAnon<ChatbotResponse>('/chatbot', data);

export const saveChatbotContext = (data: unknown): Promise<void> =>
  apiPost('/context/save', data);

export const updateContext = (contextData: unknown): Promise<void> =>
  apiPost('/context/update', contextData);
