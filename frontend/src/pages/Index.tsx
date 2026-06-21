import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { apiGet } from '@/lib/apiClient';

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

export default function Index() {
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<TutorBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<TutorBriefing>('/learner/briefing')
      .then(setBriefing)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Home</h1>
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>Could not load your learning data.</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const b = briefing!;
  const isEmpty = b.total_concepts === 0;
  const masteryPct = Math.round(b.average_mastery * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Home</h1>
          {!isEmpty && b.current_focus && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              Current focus: <span className="text-foreground font-medium">{b.current_focus}</span>
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => {
          if (b.due_reviews.length > 0) {
            navigate('/session?intent=quick_review');
          } else if (isEmpty) {
            navigate('/session?intent=learn_new');
          } else {
            navigate('/session?intent=deep_session');
          }
        }}
        className="w-full flex items-center justify-between rounded-xl bg-forest-700 dark:bg-forest-600 p-6 transition-all hover:bg-forest-600 dark:hover:bg-forest-500 hover:shadow-card group"
      >
        <div className="text-left">
          <p className="text-sm font-medium text-white/70">
            {b.due_reviews.length > 0 ? 'You have items due' : isEmpty ? 'Get started' : 'Keep going'}
          </p>
          <p className="text-lg font-bold text-white mt-0.5">
            {b.due_reviews.length > 0
              ? `Review ${b.due_reviews.length} due concept${b.due_reviews.length !== 1 ? 's' : ''}`
              : isEmpty
                ? 'Start your first session'
                : `Continue with ${b.current_focus || 'your studies'}`}
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>

      {isEmpty ? (
        <EmptyState onStart={() => navigate('/session?intent=learn_new')} />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<BookOpen className="w-4 h-4" />}
              label="Concepts tracked"
              value={b.total_concepts}
            />
            <StatCard
              icon={<Calendar className="w-4 h-4" />}
              label="Due for review"
              value={b.due_reviews.length}
              accent={b.due_reviews.length > 0}
            />
            <StatCard
              icon={<Flame className="w-4 h-4" />}
              label="Study streak"
              value={`${b.study_streak_days}d`}
            />
          </div>

          {/* Overall mastery */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Overall mastery</span>
              <span className="text-sm font-semibold text-primary">{masteryPct}%</span>
            </div>
            <Progress value={masteryPct} className="h-2" />
          </div>

          {/* Mastery heatmap */}
          <MasteryMap concepts={[
            ...b.weak_concepts,
            ...b.due_reviews.filter(d => !b.weak_concepts.some(w => w.concept_id === d.concept_id)),
          ]} allCount={b.total_concepts} averageMastery={b.average_mastery} />

          {/* Trajectory */}
          {b.trajectory.length > 0 && <Trajectory items={b.trajectory} />}

          {/* Due reviews list */}
          {b.due_reviews.length > 0 && <DueReviews items={b.due_reviews} />}
        </>
      )}
    </div>
  );
}


function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-6 h-6 text-primary" />
      </div>
      <h2 className="font-display text-xl font-semibold mb-2">Start your first session</h2>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
        Arlo tracks how you're doing across every concept and adapts to help you learn efficiently. Complete a study session to see your mastery data here.
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


function masteryColor(mastery: number): string {
  if (mastery >= 0.85) return 'bg-primary/80';
  if (mastery >= 0.7) return 'bg-primary/50';
  if (mastery >= 0.5) return 'bg-accent/50';
  if (mastery >= 0.3) return 'bg-accent/30';
  return 'bg-muted';
}

function MasteryMap({ concepts, allCount, averageMastery }: {
  concepts: ConceptSnapshot[];
  allCount: number;
  averageMastery: number;
}) {
  const masteredCount = allCount - concepts.length;

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Concept mastery</h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-accent/40" /> Mid</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary/80" /> High</span>
        </div>
      </div>

      {concepts.length === 0 ? (
        <p className="text-sm text-muted-foreground">All {allCount} concepts are above 70% mastery.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {concepts.map(c => (
            <div
              key={c.concept_id}
              className={`${masteryColor(c.mastery)} rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors`}
              title={`${c.name}: ${Math.round(c.mastery * 100)}% mastery`}
            >
              <span className="text-foreground/80">{c.name}</span>
              <span className="text-foreground/50 ml-1.5">{Math.round(c.mastery * 100)}%</span>
            </div>
          ))}
          {masteredCount > 0 && (
            <div className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-primary/80 text-primary-foreground/80">
              +{masteredCount} mastered
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function Trajectory({ items }: { items: TrajectoryItem[] }) {
  const iconMap = {
    improving: <TrendingUp className="w-3.5 h-3.5 text-green-600" />,
    struggling: <TrendingDown className="w-3.5 h-3.5 text-red-500" />,
    stable: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-3">Recent trajectory</h3>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.concept_name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {iconMap[item.direction]}
              <span className="text-foreground">{item.concept_name}</span>
            </div>
            <span className="text-muted-foreground text-xs capitalize">{item.direction}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function DueReviews({ items }: { items: ConceptSnapshot[] }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-3">Due for review</h3>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.concept_id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-3.5 h-3.5 text-accent" />
              {item.name}
            </div>
            <span className="text-muted-foreground text-xs">{Math.round(item.mastery * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
