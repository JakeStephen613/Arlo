import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library, Clock, BookOpen, Calendar, Pause, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface SessionRecord {
  id: string;
  topic: string;
  duration_minutes: number;
  timestamp: string;
  status: 'completed' | 'paused';
}

export default function LibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadSessions = async () => {
      const allSessions: SessionRecord[] = [];

      // Fetch completed sessions
      const { data: completed } = await supabase
        .from('study_session_data')
        .select('id, topic, duration_minutes, timestamp')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (completed) {
        allSessions.push(...completed.map((s: any) => ({
          ...s,
          status: 'completed' as const,
        })));
      }

      // Fetch paused sessions
      const { data: paused } = await supabase
        .from('paused_sessions')
        .select('id, title, session_plan, paused_at')
        .eq('user_id', user.id)
        .order('paused_at', { ascending: false });

      if (paused) {
        allSessions.push(...paused.map((s: any) => ({
          id: s.id,
          topic: s.title || (s.session_plan as any)?.topic || 'Untitled',
          duration_minutes: (s.session_plan as any)?.total_duration || 0,
          timestamp: s.paused_at,
          status: 'paused' as const,
        })));
      }

      // Sort by timestamp descending
      allSessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSessions(allSessions);
      setLoading(false);
    };

    loadSessions().catch(() => setLoading(false));
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
              onClick={() => {
                if (s.status === 'paused') {
                  navigate('/session', { state: { resumeSessionId: s.id } });
                } else {
                  navigate('/session', { state: { prefillTopic: s.topic } });
                }
              }}
            >
              <div className="rounded-md bg-primary/10 p-2.5">
                {s.status === 'paused' ? (
                  <Pause className="w-5 h-5 text-accent" />
                ) : (
                  <BookOpen className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.topic}</span>
                  {s.status === 'paused' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">paused</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {s.duration_minutes > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {s.duration_minutes} min
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(s.timestamp)}
                  </span>
                </div>
              </div>
              {s.status === 'paused' && (
                <button className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                  <Play className="w-3 h-3" /> Resume
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
