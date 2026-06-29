import { supabase } from '@/integrations/supabase/client';
import { apiPost } from '@/lib/apiClient';

export interface SessionHistoryItem {
  id: string;
  timestamp: string;
  topic: string;
  duration: number;
  summary: string;
  phases_used: string[];
  review_sheet?: unknown;
  quiz_mistakes?: unknown[];
  flashcards?: unknown[];
  notes?: string;
}

interface SessionResults {
  review_sheet?: unknown;
  quiz_mistakes?: unknown[];
  flashcards?: unknown[];
  duration_minutes: number;
}

export const saveStudySessionData = async (sessionData: {
  topic: string;
  duration_minutes: number;
  review_sheet?: unknown;
  quiz_mistakes?: unknown[];
  flashcards?: unknown[];
  user_id: string;
  subject_id?: string | null;
}) => {
  const { data, error } = await supabase
    .from('study_session_data')
    .insert({
      topic: sessionData.topic,
      duration_minutes: sessionData.duration_minutes,
      review_sheet: sessionData.review_sheet || {},
      quiz_mistakes: sessionData.quiz_mistakes || [],
      flashcards: sessionData.flashcards || [],
      user_id: sessionData.user_id,
      timestamp: new Date().toISOString(),
      ...(sessionData.subject_id ? { subject_id: sessionData.subject_id } : {}),
    } as any)
    .select()
    .single();

  if (error) throw error;

  await markAssignedSessionComplete(sessionData.user_id, sessionData.topic, {
    review_sheet: sessionData.review_sheet,
    quiz_mistakes: sessionData.quiz_mistakes,
    flashcards: sessionData.flashcards,
    duration_minutes: sessionData.duration_minutes,
  });

  return data;
};

export const markAssignedSessionComplete = async (
  studentId: string,
  sessionTopic: string,
  sessionResults: SessionResults
) => {
  const { data: assignedSessions, error: fetchError } = await supabase
    .from('assigned_sessions')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['pending', 'in_progress'])
    .ilike('title', `%${sessionTopic}%`);

  if (fetchError || !assignedSessions?.length) return;

  const sessionToUpdate = assignedSessions[0];
  const currentPlan =
    typeof sessionToUpdate.session_plan === 'object' && sessionToUpdate.session_plan !== null
      ? sessionToUpdate.session_plan
      : {};

  await supabase
    .from('assigned_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      session_plan: {
        ...currentPlan,
        completion_data: {
          completed_at: new Date().toISOString(),
          duration_minutes: sessionResults.duration_minutes,
          review_sheet: sessionResults.review_sheet,
          quiz_mistakes: sessionResults.quiz_mistakes,
          flashcards: sessionResults.flashcards,
        },
      },
    })
    .eq('id', sessionToUpdate.id);
};

export const generateBedtimeReviewSheet = (userId: string): Promise<unknown> =>
  apiPost('/review-sheet', { user_id: userId });

export const saveSession = async (sessionData: {
  user_id: string;
  topic: string;
  duration: number;
  review_sheet?: unknown;
  quiz_mistakes?: unknown[];
  flashcards?: unknown[];
  timestamp?: string;
}) => {
  const { data, error } = await supabase
    .from('study_session_data')
    .insert({
      user_id: sessionData.user_id,
      topic: sessionData.topic,
      duration_minutes: sessionData.duration,
      review_sheet: sessionData.review_sheet || {},
      quiz_mistakes: sessionData.quiz_mistakes || [],
      flashcards: sessionData.flashcards || [],
      timestamp: sessionData.timestamp || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  await markAssignedSessionComplete(sessionData.user_id, sessionData.topic, {
    review_sheet: sessionData.review_sheet,
    quiz_mistakes: sessionData.quiz_mistakes,
    flashcards: sessionData.flashcards,
    duration_minutes: sessionData.duration,
  });

  return data;
};

export const resetContext = (userId: string): Promise<unknown> =>
  apiPost('/context/reset', { user_id: userId });

export const fetchSessionHistory = async (userId: string): Promise<SessionHistoryItem[]> => {
  const { data, error } = await supabase
    .from('study_session_data')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(session => ({
    id: session.id,
    timestamp: session.timestamp,
    topic: session.topic,
    duration: session.duration_minutes,
    summary: `Completed study session on ${session.topic}`,
    phases_used: ['study'],
    review_sheet: session.review_sheet,
    quiz_mistakes: Array.isArray(session.quiz_mistakes) ? session.quiz_mistakes : [],
    flashcards: Array.isArray(session.flashcards) ? session.flashcards : [],
    notes: '',
  }));
};
