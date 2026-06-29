import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Calendar,
  Target,
  Clock,
  Flame,
  BookOpen,
  ArrowRight,
  Brain,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface ConceptSnapshot {
  concept_id: string;
  name: string;
  topic: string | null;
  mastery: number;
  uncertainty: number;
  streak: number;
  next_review: string | null;
  priority: number;
}

interface TrajectoryItem {
  concept_name: string;
  direction: 'improving' | 'struggling' | 'stable';
  mastery: number;
}

interface TutorBriefing {
  user_id: string;
  current_focus: string | null;
  weak_concepts: ConceptSnapshot[];
  due_reviews: ConceptSnapshot[];
  trajectory: TrajectoryItem[];
  total_concepts: number;
  average_mastery: number;
  study_streak_days: number;
  all_concepts: ConceptSnapshot[];
}

interface ConceptHistory {
  name: string;
  attempts: { score: number; mode: string; date: string }[];
  current_score: number;
  trend: string;
  total_attempts: number;
}

interface CalendarDay {
  date: string;
  sessions: number;
  minutes: number;
}

interface MasteryHistory {
  concepts: ConceptHistory[];
  calendar: CalendarDay[];
}

interface DueReview {
  concept_id: string;
  name: string;
  topic: string | null;
  mastery: number;
  uncertainty: number;
  streak: number;
  next_review: string | null;
  last_seen: string | null;
  attempt_count: number;
}

export default function ProgressPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<TutorBriefing | null>(null);
  const [history, setHistory] = useState<MasteryHistory | null>(null);
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'concepts' | 'calendar'>('overview');

  useEffect(() => {
    const load = async () => {
      try {
        const [b, h, d] = await Promise.all([
          apiGet<TutorBriefing>('/learner/briefing').catch(() => null),
          apiGet<MasteryHistory>('/learner/mastery-history').catch(() => null),
          apiGet<{ items: DueReview[] }>('/learner/due-reviews').catch(() => null),
        ]);
        setBriefing(b);
        setHistory(h);
        setDueReviews(d?.items || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  const b = briefing;
  const isEmpty = !b || b.total_concepts === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Your learning journey across all concepts.</p>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Complete study sessions to see your progress here.</p>
          <button
            onClick={() => navigate('/session')}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start studying <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <StatCard icon={<Target className="w-4 h-4" />} label="Avg mastery" value={`${Math.round(b!.average_mastery * 100)}%`} />
            <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Concepts" value={b!.total_concepts} />
            <StatCard icon={<Flame className="w-4 h-4" />} label="Study streak" value={`${b!.study_streak_days}d`} accent={b!.study_streak_days >= 3} />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Due for review"
              value={dueReviews.length}
              accent={dueReviews.length > 0}
              action={dueReviews.length > 0 ? () => {
                const topics = dueReviews.slice(0, 3).map(r => r.name).join(', ');
                navigate('/session', { state: { prefillTopic: `Review: ${topics}` } });
              } : undefined}
              actionLabel="Review now"
            />
          </div>

          {/* Due reviews banner */}
          {dueReviews.length > 0 && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{dueReviews.length} concepts due for review</h3>
                </div>
                <button
                  onClick={() => navigate('/session', {
                    state: { prefillTopic: dueReviews.slice(0, 5).map(r => r.name).join(', ') }
                  })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Start review <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dueReviews.slice(0, 8).map(r => (
                  <div
                    key={r.concept_id}
                    className="rounded-lg border bg-card px-3 py-2 text-sm cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate('/session', { state: { prefillTopic: r.name } })}
                  >
                    <span className="font-medium text-foreground">{r.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={r.mastery * 100} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{Math.round(r.mastery * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab navigation */}
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {(['overview', 'concepts', 'calendar'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors capitalize',
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Knowledge map - visual grid of all concepts */}
              {b!.all_concepts && b!.all_concepts.length > 0 && (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-medium text-foreground mb-4">Knowledge map</h3>
                  <div className="flex flex-wrap gap-2">
                    {b!.all_concepts
                      .sort((a, c) => a.mastery - c.mastery)
                      .map(c => {
                        const pct = Math.round(c.mastery * 100);
                        const isDue = c.next_review && new Date(c.next_review) <= new Date();
                        return (
                          <div
                            key={c.concept_id}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all hover:shadow-sm',
                              isDue && 'ring-1 ring-primary/40',
                            )}
                            style={{
                              background: `linear-gradient(90deg, ${
                                pct >= 85 ? 'rgb(34 197 94 / 0.15)' :
                                pct >= 70 ? 'rgb(234 179 8 / 0.12)' :
                                pct >= 40 ? 'rgb(249 115 22 / 0.1)' :
                                'rgb(239 68 68 / 0.08)'
                              } ${pct}%, transparent ${pct}%)`,
                            }}
                            onClick={() => navigate('/session', { state: { prefillTopic: c.name } })}
                            title={`${c.name}: ${pct}% mastery, ${c.streak} streak${isDue ? ' (due for review)' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'w-2 h-2 rounded-full',
                                pct >= 85 ? 'bg-green-500' :
                                pct >= 70 ? 'bg-yellow-500' :
                                pct >= 40 ? 'bg-orange-500' :
                                'bg-red-500'
                              )} />
                              <span className="font-medium text-foreground">{c.name}</span>
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                              {isDue && <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/30">due</Badge>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Trajectory */}
              {b!.trajectory.length > 0 && (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-medium text-foreground mb-3">Learning trajectory</h3>
                  <div className="space-y-2">
                    {b!.trajectory.map(item => (
                      <div key={item.concept_name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {item.direction === 'improving' && <TrendingUp className="w-3.5 h-3.5 text-green-600" />}
                          {item.direction === 'struggling' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                          {item.direction === 'stable' && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                          <span className="text-foreground">{item.concept_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{Math.round(item.mastery * 100)}%</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 capitalize',
                              item.direction === 'improving' && 'text-green-600 border-green-300',
                              item.direction === 'struggling' && 'text-red-500 border-red-300',
                            )}
                          >
                            {item.direction}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'concepts' && (
            <div className="space-y-4">
              {history?.concepts.map(concept => (
                <ConceptCard key={concept.name} concept={concept} onStudy={() => navigate('/session', { state: { prefillTopic: concept.name } })} />
              ))}
              {(!history || history.concepts.length === 0) && (
                <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                  No concept history yet.
                </div>
              )}
            </div>
          )}

          {activeTab === 'calendar' && (
            <StudyCalendar calendar={history?.calendar || []} />
          )}
        </>
      )}
    </div>
  );
}

function ConceptCard({ concept, onStudy }: { concept: ConceptHistory; onStudy: () => void }) {
  const scores = concept.attempts.map(a => a.score);
  const maxScore = Math.max(...scores, 0.01);

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{concept.name}</span>
          {concept.trend === 'improving' && <TrendingUp className="w-3.5 h-3.5 text-green-600" />}
          {concept.trend === 'struggling' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{concept.total_attempts} attempts</span>
          <button onClick={onStudy} className="text-xs text-primary hover:underline font-medium">Study</button>
        </div>
      </div>

      {/* Mini sparkline */}
      <div className="flex items-end gap-px h-8">
        {scores.slice(-20).map((score, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-t-sm min-w-[3px] max-w-[12px] transition-all',
              score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-red-400',
            )}
            style={{ height: `${(score / maxScore) * 100}%` }}
            title={`${Math.round(score * 100)}%`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Current: <span className={cn(
          'font-medium',
          concept.current_score >= 0.7 ? 'text-green-600' : concept.current_score >= 0.4 ? 'text-yellow-600' : 'text-red-500'
        )}>{Math.round(concept.current_score * 100)}%</span></span>
        <div className="flex gap-2">
          {[...new Set(concept.attempts.slice(-10).map(a => a.mode))].map(mode => (
            <Badge key={mode} variant="outline" className="text-[9px] px-1 py-0 capitalize">{mode}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudyCalendar({ calendar }: { calendar: CalendarDay[] }) {
  const today = new Date();
  const numWeeks = 16;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (numWeeks * 7 - 1) - startDate.getDay());

  const calMap = new Map(calendar.map(d => [d.date, d]));

  // Build columns (weeks), each with 7 rows (days Sun-Sat) — GitHub style
  const weeks: (CalendarDay | null)[][] = [];
  const cursor = new Date(startDate);
  for (let w = 0; w < numWeeks; w++) {
    const week: (CalendarDay | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (cursor > today) {
        week.push(null);
      } else {
        const key = cursor.toISOString().slice(0, 10);
        week.push(calMap.get(key) || { date: key, sessions: 0, minutes: 0 });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const maxMins = Math.max(...calendar.map(d => d.minutes), 1);
  const todayKey = today.toISOString().slice(0, 10);

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w].find(d => d !== null);
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: new Date(firstDay.date).toLocaleDateString('en-US', { month: 'short' }), col: w });
        lastMonth = month;
      }
    }
  }

  const totalStudyDays = calendar.filter(d => d.sessions > 0).length;
  const totalMinutes = calendar.reduce((sum, d) => sum + d.minutes, 0);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Study calendar</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">{totalStudyDays}</span> days studied</span>
          <span><span className="font-medium text-foreground">{totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}</span> total</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-grid" style={{ gridTemplateColumns: `24px repeat(${numWeeks}, 1fr)`, gap: '3px' }}>
          {/* Month labels row */}
          <div />
          {weeks.map((_, wi) => {
            const ml = monthLabels.find(m => m.col === wi);
            return (
              <div key={wi} className="text-[10px] text-muted-foreground h-4 flex items-end">
                {ml ? ml.label : ''}
              </div>
            );
          })}

          {/* Day rows */}
          {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => (
            <>
              <div key={`label-${dayIdx}`} className="text-[10px] text-muted-foreground flex items-center justify-end pr-1 h-[14px]">
                {dayLabels[dayIdx]}
              </div>
              {weeks.map((week, wi) => {
                const day = week[dayIdx];
                if (!day) return <div key={`${wi}-${dayIdx}`} className="h-[14px] rounded-sm" />;
                const intensity = day.minutes > 0 ? Math.max(0.2, day.minutes / maxMins) : 0;
                const isToday = day.date === todayKey;
                return (
                  <div
                    key={`${wi}-${dayIdx}`}
                    className={cn(
                      'h-[14px] rounded-sm transition-colors',
                      isToday && 'ring-1 ring-primary ring-offset-1 ring-offset-card',
                      day.sessions === 0 && 'bg-secondary/60',
                    )}
                    style={day.sessions > 0 ? { backgroundColor: `rgb(34 197 94 / ${intensity})` } : undefined}
                    title={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.sessions} session${day.sessions !== 1 ? 's' : ''}, ${day.minutes}m`}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 0.2, 0.4, 0.7, 1].map((v, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: v === 0 ? 'hsl(var(--secondary))' : `rgb(34 197 94 / ${v})` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent, action, actionLabel }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
      {action && (
        <button onClick={action} className="mt-2 text-xs text-primary hover:underline font-medium">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
