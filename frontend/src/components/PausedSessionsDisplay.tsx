import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StudyPlan } from '@/services/api';
import PausedSessionCard from './PausedSessionCard';

interface PausedSession {
  id: string;
  title: string;
  session_plan: StudyPlan;
  current_block_index: number;
  paused_at: string;
  expires_at: string;
}

interface PausedSessionsDisplayProps {
  onResumeSession?: (sessionId: string) => void;
}

const PausedSessionsDisplay = ({ onResumeSession }: PausedSessionsDisplayProps) => {
  const [pausedSessions, setPausedSessions] = useState<PausedSession[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPausedSessions();
      cleanupExpiredSessions();
    }
  }, [user]);

  const fetchPausedSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('paused_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('paused_at', { ascending: false });

      if (error) {
        console.error('Error fetching paused sessions:', error);
      } else {
        setPausedSessions(data?.map((session: any) => ({
          id: session.id,
          title: session.title,
          session_plan: session.session_plan as StudyPlan,
          current_block_index: session.current_block_index,
          paused_at: session.paused_at,
          expires_at: session.expires_at
        })) || []);
      }
    } catch (error) {
      console.error('Error in fetchPausedSessions:', error);
    }
  };

  const cleanupExpiredSessions = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('paused_sessions')
        .delete()
        .eq('user_id', user.id)
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error cleaning up expired sessions:', error);
      }
    } catch (error) {
      console.error('Error in cleanupExpiredSessions:', error);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    if (onResumeSession) {
      onResumeSession(sessionId);
      // Refresh paused sessions list
      fetchPausedSessions();
    }
  };

  if (pausedSessions.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <PausedSessionCard 
        session={pausedSessions[0]} 
        onResume={handleResumeSession}
      />
    </div>
  );
};

export default PausedSessionsDisplay;