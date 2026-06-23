import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library, Clock, BookOpen, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SessionRecord {
  id: string;
  topic: string;
  duration_minutes: number;
  timestamp: string;
}

export default function LibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('study_session_data')
      .select('id, topic, duration_minutes, timestamp')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .then(({ data }) => {
        setSessions((data as SessionRecord[]) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Your study session history.</p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <Library className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No sessions yet. Start studying to build your library.</p>
          <button
            onClick={() => navigate('/session')}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start a session
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div
              key={s.id}
              className="rounded-lg border bg-card p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer"
              onClick={() => navigate('/session', { state: { prefillTopic: s.topic } })}
            >
              <div className="rounded-md bg-primary/10 p-2.5">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{s.topic}</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {s.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(s.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
