import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Calendar,
  Target,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

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
}

export default function ProgressPage() {
  const [briefing, setBriefing] = useState<TutorBriefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<TutorBriefing>('/learner/briefing')
      .then(setBriefing)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
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
        <p className="text-muted-foreground mt-0.5 text-sm">Track your mastery across all concepts.</p>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Complete study sessions to see your progress here.</p>
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={<Target className="w-4 h-4" />} label="Average mastery" value={`${Math.round(b!.average_mastery * 100)}%`} />
            <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Concepts tracked" value={b!.total_concepts} />
            <StatCard icon={<Calendar className="w-4 h-4" />} label="Due for review" value={b!.due_reviews.length} accent={b!.due_reviews.length > 0} />
          </div>

          {/* All concepts mastery breakdown */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">Concept mastery</h3>
            {b!.weak_concepts.length === 0 && b!.due_reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">All concepts above 70%.</p>
            ) : (
              <div className="space-y-3">
                {[...b!.weak_concepts, ...b!.due_reviews.filter(d => !b!.weak_concepts.some(w => w.concept_id === d.concept_id))]
                  .sort((a, c) => a.mastery - c.mastery)
                  .map(c => (
                    <div key={c.concept_id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{c.name}</span>
                        <div className="flex items-center gap-2">
                          {c.next_review && new Date(c.next_review) <= new Date() && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">due</Badge>
                          )}
                          <span className="text-muted-foreground text-xs">{Math.round(c.mastery * 100)}%</span>
                        </div>
                      </div>
                      <Progress value={c.mastery * 100} className="h-1.5" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Trajectory */}
          {b!.trajectory.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium text-foreground mb-3">Recent trajectory</h3>
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
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${accent ? 'text-accent' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
