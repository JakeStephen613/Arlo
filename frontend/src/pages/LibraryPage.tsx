import { useEffect, useState } from 'react';
import { Library, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiGet } from '@/lib/apiClient';

interface ConceptSnapshot {
  concept_id: string;
  name: string;
  topic: string | null;
  mastery: number;
  streak: number;
  next_review: string | null;
}

interface TutorBriefing {
  weak_concepts: ConceptSnapshot[];
  due_reviews: ConceptSnapshot[];
  total_concepts: number;
}

export default function LibraryPage() {
  const [concepts, setConcepts] = useState<ConceptSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<TutorBriefing>('/learner/briefing')
      .then(b => {
        const seen = new Set<string>();
        const all: ConceptSnapshot[] = [];
        for (const c of [...b.weak_concepts, ...b.due_reviews]) {
          if (!seen.has(c.concept_id)) { seen.add(c.concept_id); all.push(c); }
        }
        setConcepts(all.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">All concepts Arlo is tracking for you.</p>
      </div>

      {concepts.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <Library className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Start a study session to build your concept library.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {concepts.map(c => {
            const pct = Math.round(c.mastery * 100);
            const isDue = c.next_review && new Date(c.next_review) <= new Date();
            return (
              <div key={c.concept_id} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                    {c.topic && <span className="text-xs text-muted-foreground hidden sm:inline">{c.topic}</span>}
                    {isDue && <Badge variant="outline" className="text-[10px] px-1.5 py-0">due</Badge>}
                  </div>
                  <Progress value={pct} className="h-1 mt-1.5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
