import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PausedSessionsDisplay from '@/components/PausedSessionsDisplay';

interface SessionRecord {
  id: string;
  topic: string;
  duration_minutes: number;
  timestamp: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { user, userProfile, updateProfile } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
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
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  const isEmpty = sessions.length === 0;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const timeDisplay = totalHours > 0 ? `${totalHours}h ${remainingMins}m` : `${remainingMins}m`;
  const uniqueTopics = new Set(sessions.map(s => s.topic)).size;
  const lastTopic = sessions[0]?.topic;

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Home</h1>
        {lastTopic && (
          <p className="text-muted-foreground mt-0.5 text-sm">
            Last studied: <span className="text-foreground font-medium">{lastTopic}</span>
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/session', lastTopic ? { state: { prefillTopic: lastTopic } } : undefined)}
        className="w-full flex items-center justify-between rounded-xl bg-forest-700 dark:bg-forest-600 p-6 transition-all hover:bg-forest-600 dark:hover:bg-forest-500 hover:shadow-card group"
      >
        <div className="text-left">
          <p className="text-sm font-medium text-white/70">
            {isEmpty ? 'Get started' : 'Keep going'}
          </p>
          <p className="text-lg font-bold text-white mt-0.5">
            {isEmpty
              ? 'Start your first session'
              : `Continue with ${lastTopic || 'your studies'}`}
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>

      <PausedSessionsDisplay onResumeSession={(id) => navigate('/session', { state: { resumeSessionId: id } })} />

      {isEmpty ? (
        <EmptyState onStart={() => navigate('/session')} userProfile={userProfile} updateProfile={updateProfile} />
      ) : (
        <>
          {/* Real stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<BookOpen className="w-4 h-4" />}
              label="Sessions completed"
              value={sessions.length}
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Total study time"
              value={timeDisplay}
            />
            <StatCard
              icon={<Layers className="w-4 h-4" />}
              label="Topics studied"
              value={uniqueTopics}
            />
          </div>

          {/* Recent sessions */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Recent sessions</h3>
              <button
                onClick={() => navigate('/library')}
                className="text-xs text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm py-2 cursor-pointer hover:bg-secondary/30 rounded-md px-2 -mx-2 transition-colors"
                  onClick={() => navigate('/session', { state: { prefillTopic: s.topic } })}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span className="text-foreground">{s.topic}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{s.duration_minutes} min</span>
                    <span>{formatDate(s.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Topics breakdown */}
          {uniqueTopics > 1 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium text-foreground mb-3">Topics studied</h3>
              <div className="flex flex-wrap gap-2">
                {[...new Set(sessions.map(s => s.topic))].map(topic => {
                  const count = sessions.filter(s => s.topic === topic).length;
                  const mins = sessions.filter(s => s.topic === topic).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
                  return (
                    <div
                      key={topic}
                      className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => navigate('/session', { state: { prefillTopic: topic } })}
                    >
                      <span className="text-foreground">{topic}</span>
                      <span className="text-muted-foreground ml-1.5">{count} session{count !== 1 ? 's' : ''} · {mins}m</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


const GRADE_LEVELS = ['Middle School', 'High School', 'Undergraduate', 'Graduate', 'Self-study'];

function EmptyState({ onStart, userProfile, updateProfile }: {
  onStart: () => void;
  userProfile: any;
  updateProfile: (data: any) => Promise<void>;
}) {
  const [step, setStep] = useState<'welcome' | 'grade' | 'goals' | 'done'>(() => {
    return userProfile?.grade_level ? 'done' : 'welcome';
  });
  const [grade, setGrade] = useState('');
  const [goals, setGoals] = useState('');

  const finishOnboarding = async () => {
    try {
      await updateProfile({ grade_level: grade, learning_goals: goals || null } as any);
    } catch {}
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <h2 className="font-display text-xl font-semibold mb-2">Start your first session</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
          Enter a topic and Arlo will build a study session for you. Your session history will appear here.
        </p>
        <button
          onClick={onStart}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Learn something new
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-8 max-w-md mx-auto animate-fade-in">
      {step === 'welcome' && (
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-xl font-semibold">Welcome to Arlo</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Let's personalize your experience. A couple of quick questions so Arlo can adapt to your level.
          </p>
          <button
            onClick={() => setStep('grade')}
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get started
          </button>
        </div>
      )}

      {step === 'grade' && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-center">What's your level?</h2>
          <div className="grid gap-2">
            {GRADE_LEVELS.map(g => (
              <button
                key={g}
                onClick={() => { setGrade(g); setStep('goals'); }}
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors hover:border-primary/50',
                  grade === g ? 'border-primary bg-primary/5 text-foreground' : 'text-muted-foreground'
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'goals' && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-center">What are you studying?</h2>
          <p className="text-xs text-muted-foreground text-center">Tell Arlo what subjects or goals you're working on.</p>
          <textarea
            value={goals}
            onChange={e => setGoals(e.target.value)}
            placeholder="e.g. Preparing for AP Biology exam, learning calculus, reviewing organic chemistry..."
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none h-24"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setStep('grade')}
              className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              Back
            </button>
            <button
              onClick={finishOnboarding}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {goals.trim() ? 'Continue' : 'Skip'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function StatCard({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
