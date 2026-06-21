import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  X,
  BookOpen,
  MessageSquare,
  Clock,
  Trophy,
  TrendingUp,
  AlertCircle,
  Send,
  RefreshCw,
  ChevronDown,
  Layers,
  Zap,
  Brain,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiPost } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface StudyBlock {
  id: string;
  unit: string;
  technique: string;
  techniques: string[];
  phase: string;
  tool: string;
  duration: number;
  description: string;
  position: number;
}

interface StudyPlan {
  session_id: string;
  topic: string;
  total_duration: number;
  pomodoro: string;
  units_to_cover: string[];
  techniques: string[];
  blocks: StudyBlock[];
}

interface ExpandedSubBlock {
  blockIndex: number;
  mode: 'teach' | 'quiz' | 'flashcard' | 'feynman' | 'blurting';
  block: StudyBlock;
}

type SessionPhase = 'input' | 'generating' | 'plan-review' | 'studying' | 'summary';

interface BlockScore {
  blockIndex: number;
  mode: string;
  score: number;
}

// ── Main Component ───────────────────────────────────────────

export default function Session() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<SessionPhase>('input');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(60);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Studying state
  const [subBlocks, setSubBlocks] = useState<ExpandedSubBlock[]>([]);
  const [currentSubBlockIndex, setCurrentSubBlockIndex] = useState(0);
  const [scores, setScores] = useState<BlockScore[]>([]);
  const [preloadedContent, setPreloadedContent] = useState<Record<string, boolean>>({});

  const generatePlan = async () => {
    if (!topic.trim()) return;
    setPhase('generating');
    setError(null);
    try {
      const result = await apiPost<StudyPlan>('/study-session', {
        objective: topic,
        duration,
      }, 60000);
      setPlan(result);
      setPhase('plan-review');
    } catch (e: any) {
      setError(e.message || 'Failed to generate study plan');
      setPhase('input');
    }
  };

  const startStudying = () => {
    if (!plan) return;
    const expanded = expandBlocks(plan.blocks);
    setSubBlocks(expanded);
    setCurrentSubBlockIndex(0);
    setScores([]);
    setPhase('studying');
  };

  const handleSubBlockComplete = (score: number) => {
    const current = subBlocks[currentSubBlockIndex];
    setScores(prev => [...prev, { blockIndex: current.blockIndex, mode: current.mode, score }]);

    const nextIndex = currentSubBlockIndex + 1;
    if (nextIndex >= subBlocks.length) {
      setPhase('summary');
    } else {
      setCurrentSubBlockIndex(nextIndex);
    }
  };

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full rounded-xl border border-destructive/20 bg-card p-8 text-center shadow-card">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-semibold text-lg">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{error}</p>
          <button
            onClick={() => { setError(null); setPhase('input'); }}
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col">
      {phase === 'input' && (
        <TopicInput
          topic={topic}
          setTopic={setTopic}
          duration={duration}
          setDuration={setDuration}
          onSubmit={generatePlan}
        />
      )}
      {phase === 'generating' && <GeneratingState />}
      {phase === 'plan-review' && plan && (
        <PlanReview plan={plan} onStart={startStudying} onBack={() => setPhase('input')} />
      )}
      {phase === 'studying' && plan && subBlocks.length > 0 && (
        <StudyingView
          plan={plan}
          subBlocks={subBlocks}
          currentIndex={currentSubBlockIndex}
          scores={scores}
          onComplete={handleSubBlockComplete}
        />
      )}
      {phase === 'summary' && plan && (
        <SummaryView
          plan={plan}
          scores={scores}
          onHome={() => navigate('/')}
          onAnother={() => {
            setPlan(null);
            setSubBlocks([]);
            setScores([]);
            setTopic('');
            setPhase('input');
          }}
        />
      )}
    </div>
  );
}

// ── Block Expansion ──────────────────────────────────────────

function expandBlocks(blocks: StudyBlock[]): ExpandedSubBlock[] {
  const expanded: ExpandedSubBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    // Teaching first
    expanded.push({ blockIndex: i, mode: 'teach', block });
    // Then each technique
    for (const tech of block.techniques) {
      const mode = tech as ExpandedSubBlock['mode'];
      if (['quiz', 'flashcard', 'feynman', 'blurting'].includes(mode)) {
        expanded.push({ blockIndex: i, mode, block });
      }
    }
  }
  return expanded;
}

// ── Topic Input ──────────────────────────────────────────────

const DURATION_OPTIONS = [30, 60, 90, 120];

function TopicInput({ topic, setTopic, duration, setDuration, onSubmit }: {
  topic: string;
  setTopic: (t: string) => void;
  duration: number;
  setDuration: (d: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-lg mx-auto w-full space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Start a study session</h1>
          <p className="text-muted-foreground mt-2">Enter a topic and Arlo will build a structured curriculum for you.</p>
        </div>

        <div className="space-y-5">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) onSubmit(); }}
            placeholder="e.g. Cell Biology, Linear Algebra, World War 2..."
            className="w-full rounded-xl border-2 bg-card px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-center text-lg"
            autoFocus
          />

          <div>
            <p className="text-sm text-muted-foreground mb-2 text-center">Session duration</p>
            <div className="flex gap-2 justify-center">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                    duration === d
                      ? 'bg-primary text-primary-foreground'
                      : 'border bg-card text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onSubmit}
            disabled={!topic.trim()}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            Generate Study Plan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generating State ─────────────────────────────────────────

const GENERATING_MESSAGES = [
  'Designing your curriculum...',
  'Breaking down subtopics...',
  'Planning your study blocks...',
  'Choosing retrieval techniques...',
];

function GeneratingState() {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMsgIndex(i => (i + 1) % GENERATING_MESSAGES.length), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
      <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground mt-5 font-medium">{GENERATING_MESSAGES[msgIndex]}</p>
    </div>
  );
}

// ── Plan Review ──────────────────────────────────────────────

const TECHNIQUE_ICONS: Record<string, typeof BookOpen> = {
  quiz: Zap,
  flashcard: Layers,
  flashcards: Layers,
  feynman: Brain,
  blurting: Pencil,
};

function PlanReview({ plan, onStart, onBack }: {
  plan: StudyPlan;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 py-8">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{plan.topic}</h1>
          <p className="text-muted-foreground mt-1">
            {plan.blocks.length} blocks · {plan.total_duration} min · {plan.pomodoro} pomodoro
          </p>
        </div>

        <div className="space-y-3">
          {plan.blocks.map((block, i) => (
            <div key={block.id} className="rounded-xl border bg-card p-5 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{block.unit}</h3>
                    <p className="text-xs text-muted-foreground">{block.duration} min</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {block.techniques.map(tech => {
                    const Icon = TECHNIQUE_ICONS[tech] || BookOpen;
                    return (
                      <span key={tech} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        <Icon className="w-3 h-3" />
                        {tech}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-10">{block.description}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 rounded-xl border-2 bg-card px-4 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            Back
          </button>
          <button
            onClick={onStart}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start Studying
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Studying View (Sidebar + Content) ────────────────────────

function StudyingView({ plan, subBlocks, currentIndex, scores, onComplete }: {
  plan: StudyPlan;
  subBlocks: ExpandedSubBlock[];
  currentIndex: number;
  scores: BlockScore[];
  onComplete: (score: number) => void;
}) {
  const current = subBlocks[currentIndex];
  const currentBlockIndex = current.blockIndex;
  const preloadedRef = useRef<Set<string>>(new Set());

  // Preload next block's teaching content
  useEffect(() => {
    const nextTeach = subBlocks.find((sb, i) => i > currentIndex && sb.mode === 'teach');
    if (!nextTeach || preloadedRef.current.has(nextTeach.block.id)) return;
    preloadedRef.current.add(nextTeach.block.id);

    (async () => {
      try {
        const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
        const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
        // Fire-and-forget: the browser caches the SSE connection warmup
        // and the backend will have the response ready faster on next request
        fetch(`${base}/teaching/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': session?.user?.id || '' },
          body: JSON.stringify({
            topic: `${nextTeach.block.unit}: ${nextTeach.block.description}`,
            concept_name: nextTeach.block.unit,
            difficulty: 'medium',
          }),
        }).catch(() => {});
      } catch {}
    })();
  }, [currentIndex, subBlocks]);

  // Which original blocks are complete
  const completedBlocks = new Set<number>();
  const blockMaxSubIndex: Record<number, number> = {};
  subBlocks.forEach((sb, i) => {
    blockMaxSubIndex[sb.blockIndex] = i;
  });
  for (const [bi, maxI] of Object.entries(blockMaxSubIndex)) {
    if (currentIndex > Number(maxI)) completedBlocks.add(Number(bi));
  }

  // Progress
  const progressPct = Math.round((currentIndex / subBlocks.length) * 100);

  return (
    <div className="flex-1 flex gap-6 py-4">
      {/* Sidebar */}
      <div className="hidden md:block w-56 shrink-0 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Study Plan</p>
        {plan.blocks.map((block, i) => {
          const isDone = completedBlocks.has(i);
          const isCurrent = i === currentBlockIndex;
          return (
            <div
              key={block.id}
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm transition-all border',
                isCurrent && 'border-primary bg-primary/5 text-foreground font-medium',
                isDone && !isCurrent && 'border-transparent bg-secondary/50 text-muted-foreground',
                !isDone && !isCurrent && 'border-transparent text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                ) : isCurrent ? (
                  <div className="w-4 h-4 rounded-full border-2 border-primary shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className="truncate">{block.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Block {currentBlockIndex + 1} of {plan.blocks.length}</span>
            <span>{current.block.unit}</span>
          </div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Mode component */}
        <ModeView subBlock={current} onComplete={onComplete} />
      </div>
    </div>
  );
}

// ── Mode Router ──────────────────────────────────────────────

function ModeView({ subBlock, onComplete }: {
  subBlock: ExpandedSubBlock;
  onComplete: (score: number) => void;
}) {
  switch (subBlock.mode) {
    case 'teach':
      return <TeachingStep block={subBlock.block} onComplete={onComplete} />;
    case 'quiz':
      return <QuizStep block={subBlock.block} onComplete={onComplete} />;
    case 'flashcard':
      return <FlashcardStep block={subBlock.block} onComplete={onComplete} />;
    case 'feynman':
      return <FeynmanStep block={subBlock.block} onComplete={onComplete} />;
    case 'blurting':
      return <BlurtingStep block={subBlock.block} onComplete={onComplete} />;
    default:
      return <GenericStep block={subBlock.block} mode={subBlock.mode} onComplete={onComplete} />;
  }
}

// ── Teaching Step (streaming SSE) ────────────────────────────

function TeachingStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [sections, setSections] = useState<string[]>([]);
  const [currentSection, setCurrentSection] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [visibleSections, setVisibleSections] = useState(0);
  const [checkQuestions, setCheckQuestions] = useState<{ question: string; afterSection: number }[]>([]);
  const [checkAnswers, setCheckAnswers] = useState<Record<number, string>>({});
  const [checkResults, setCheckResults] = useState<Record<number, { correct: boolean; explanation: string }>>({});
  const [followUp, setFollowUp] = useState('');
  const [followUpContent, setFollowUpContent] = useState('');
  const [followUpStreaming, setFollowUpStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
        const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
        const res = await fetch(`${base}/teaching/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': session?.user?.id || '' },
          body: JSON.stringify({
            topic: `${block.unit}: ${block.description}`,
            concept_name: block.unit,
            difficulty: 'medium',
          }),
          signal: ac.signal,
        });

        if (!res.ok) {
          setError(`Teaching generation failed (${res.status})`);
          setStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let fullText = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'token') {
                fullText += evt.content;
                const cleaned = fullText.replace(/\[CHECK\].*?\[\/CHECK\]/gs, '|||CHECK|||');
                const parts = cleaned.split(/\n\n+/).filter(p => p.trim() && p.trim() !== '|||CHECK|||');
                const sectionTexts = parts.map(p => p.replace(/\|\|\|CHECK\|\|\|/g, '').trim()).filter(Boolean);
                if (sectionTexts.length > 1) {
                  setSections(sectionTexts.slice(0, -1));
                  setCurrentSection(sectionTexts[sectionTexts.length - 1]);
                } else {
                  setCurrentSection(sectionTexts[0] || '');
                }
              } else if (evt.type === 'done') {
                const checks = [...fullText.matchAll(/\[CHECK\](.*?)\[\/CHECK\]/gs)].map((m, i) => ({
                  question: m[1].trim(),
                  afterSection: i === 0 ? 2 : 5,
                }));
                setCheckQuestions(checks);
                const cleaned = fullText.replace(/\[CHECK\].*?\[\/CHECK\]/gs, '');
                const finalSections = cleaned.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
                setSections(finalSections);
                setCurrentSection('');
                setStreaming(false);
                setVisibleSections(1);
              } else if (evt.type === 'error') {
                setError(evt.message || 'Streaming error');
                setStreaming(false);
              }
            } catch {}
          }
        }
        setStreaming(false);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setError('Failed to load teaching content');
          setStreaming(false);
        }
      }
    })();

    return () => ac.abort();
  }, [block.id]);

  useEffect(() => {
    if (!streaming && visibleSections === 0 && sections.length > 0) {
      setVisibleSections(1);
    }
  }, [streaming, sections.length, visibleSections]);

  const showMore = () => setVisibleSections(prev => Math.min(prev + 2, sections.length));
  const allVisible = visibleSections >= sections.length;

  const handleCheckSubmit = async (idx: number) => {
    const q = checkQuestions[idx];
    if (!q || !checkAnswers[idx]?.trim()) return;
    try {
      const result = await apiPost<{ correct: boolean; score: number; explanation: string }>('/teaching/check', {
        question: q.question,
        user_answer: checkAnswers[idx],
        concept_name: block.unit,
      });
      setCheckResults(prev => ({ ...prev, [idx]: result }));
    } catch {
      setCheckResults(prev => ({ ...prev, [idx]: { correct: false, explanation: 'Could not grade.' } }));
    }
  };

  const handleFollowUp = async () => {
    if (!followUp.trim()) return;
    setFollowUpStreaming(true);
    setFollowUpContent('');
    try {
      const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
      const res = await fetch(`${base}/teaching/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': session?.user?.id || '' },
        body: JSON.stringify({ original_topic: block.unit, follow_up: followUp }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf2 = '';
      let text = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf2 += decoder.decode(value, { stream: true });
        const lines2 = buf2.split('\n');
        buf2 = lines2.pop() || '';
        for (const l of lines2) {
          if (!l.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(l.slice(6));
            if (evt.type === 'token') { text += evt.content; setFollowUpContent(text); }
          } catch {}
        }
      }
    } catch {}
    setFollowUpStreaming(false);
    setFollowUp('');
  };

  if (error) {
    return (
      <div className="max-w-lg mx-auto w-full text-center space-y-4 animate-fade-in">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-foreground font-semibold">{error}</p>
        <button
          onClick={() => { setError(null); setStreaming(true); setSections([]); setCurrentSection(''); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
        <button
          onClick={() => onComplete(0.3)}
          className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip this block
        </button>
      </div>
    );
  }

  const renderCheck = (idx: number) => {
    const q = checkQuestions[idx];
    if (!q) return null;
    const result = checkResults[idx];
    return (
      <div key={`check-${idx}`} className="rounded-xl border-2 border-forest-200 bg-forest-50 dark:border-forest-700 dark:bg-forest-900/30 p-5 space-y-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-forest-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">?</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Quick check</p>
        </div>
        <p className="text-foreground leading-relaxed">{q.question}</p>
        {!result ? (
          <div className="flex gap-2">
            <input
              value={checkAnswers[idx] || ''}
              onChange={e => setCheckAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleCheckSubmit(idx); }}
              placeholder="Type your answer..."
              className="flex-1 rounded-lg border bg-card px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={() => handleCheckSubmit(idx)}
              disabled={!checkAnswers[idx]?.trim()}
              className="rounded-lg bg-forest-600 px-4 py-2.5 text-white hover:bg-forest-700 transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className={cn(
            'rounded-lg p-3 text-sm',
            result.correct
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
          )}>
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              {result.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {result.correct ? 'Correct!' : 'Not quite'}
            </div>
            <p>{result.explanation}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Badge className="bg-forest-600 text-white border-0 mb-1">Teaching</Badge>
          <h2 className="font-display text-2xl font-bold tracking-tight">{block.unit}</h2>
        </div>
      </div>

      {streaming && (
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Generating lesson...</span>
          </div>
          <div className="text-foreground leading-relaxed whitespace-pre-wrap">
            {currentSection}
            <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
          </div>
        </div>
      )}

      {!streaming && sections.length > 0 && (
        <div className="space-y-4">
          {sections.slice(0, visibleSections).map((section, i) => (
            <div key={i}>
              <div className="rounded-xl border bg-card p-6 animate-fade-in">
                <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                  {formatTeachingText(section)}
                </div>
              </div>
              {checkQuestions.map((cq, ci) => cq.afterSection === i ? renderCheck(ci) : null)}
            </div>
          ))}

          {!allVisible ? (
            <button
              onClick={showMore}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-forest-300 dark:border-forest-700 py-4 text-sm font-medium text-forest-600 dark:text-forest-300 hover:bg-forest-50 dark:hover:bg-forest-900/20 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Continue reading
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleFollowUp(); }}
                  placeholder='Ask a follow-up or "explain that differently"...'
                  className="flex-1 rounded-lg border bg-card px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={handleFollowUp}
                  disabled={!followUp.trim() || followUpStreaming}
                  className="rounded-lg bg-forest-600 px-4 py-3 text-white hover:bg-forest-700 transition-colors disabled:opacity-40"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {followUpContent && (
                <div className="rounded-xl border bg-card p-5 text-sm text-foreground whitespace-pre-wrap leading-relaxed animate-fade-in">
                  {followUpContent}
                  {followUpStreaming && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />}
                </div>
              )}

              <button
                onClick={() => onComplete(0.5)}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                I understand — continue to practice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTeachingText(text: string): string {
  return text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

// ── Quiz Step ────────────────────────────────────────────────

function QuizStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<any>('/quiz/generate', {
        content: `Create a multiple choice question to test understanding of ${block.unit}. Focus on: ${block.description}`,
        difficulty: 'medium',
        concept_name: block.unit,
        max_questions: 1,
      }, 30000);
      const q = res.questions?.[0];
      if (q) {
        setQuestion(q.question);
        setOptions(q.options);
        setCorrectAnswer(q.correct_answer);
        setExplanation(q.explanation);
      } else {
        setError('No question was generated');
      }
    } catch {
      setError('Quiz generation failed');
    }
    setLoading(false);
  }, [block.unit, block.description]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const handleReveal = () => {
    setRevealed(true);
    const isCorrect = selected === correctAnswer;
    setTimeout(() => onComplete(isCorrect ? 1.0 : 0.0), 2000);
  };

  if (loading) return <LoadingMode label="Generating quiz..." />;

  if (error) {
    return (
      <div className="max-w-lg mx-auto w-full text-center space-y-4 animate-fade-in">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-foreground font-semibold">{error}</p>
        <button
          onClick={loadQuiz}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
        <button
          onClick={() => onComplete(0)}
          className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Quiz</Badge>
        <span className="text-sm text-muted-foreground">{block.unit}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium leading-relaxed text-lg">{question}</p>
      </div>

      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const isCorrect = revealed && opt === correctAnswer;
          const isWrong = revealed && opt === selected && opt !== correctAnswer;
          return (
            <button
              key={i}
              onClick={() => !revealed && setSelected(opt)}
              className={cn(
                'w-full flex items-center gap-3 text-left rounded-xl border-2 p-4 transition-all',
                !revealed && selected === opt && 'border-primary bg-primary/5',
                !revealed && selected !== opt && 'bg-card hover:border-primary/30',
                isCorrect && 'border-green-500 bg-green-50 dark:bg-green-900/20',
                isWrong && 'border-red-400 bg-red-50 dark:bg-red-900/20',
              )}
              disabled={revealed}
            >
              <span className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                selected === opt && !revealed ? 'bg-primary text-primary-foreground' :
                isCorrect ? 'bg-green-500 text-white' :
                isWrong ? 'bg-red-400 text-white' :
                'bg-secondary text-muted-foreground'
              )}>
                {isCorrect ? <Check className="w-4 h-4" /> : isWrong ? <X className="w-4 h-4" /> : letter}
              </span>
              <span className="text-foreground">{opt}</span>
            </button>
          );
        })}
      </div>

      {revealed && explanation && (
        <div className="rounded-xl border bg-forest-50 dark:bg-forest-900/20 p-5 text-sm animate-fade-in">
          <p className="font-semibold text-foreground mb-1">Why?</p>
          <p className="text-muted-foreground leading-relaxed">{explanation}</p>
        </div>
      )}

      {!revealed && selected && (
        <button
          onClick={handleReveal}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Check answer
        </button>
      )}
    </div>
  );
}

// ── Flashcard Step ───────────────────────────────────────────

function FlashcardStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<any>('/flashcards', {
        content: `Create a flashcard about: ${block.unit}. Focus on: ${block.description}`,
        concept_name: block.unit,
      }, 20000);
      const card = res.flashcards?.[0];
      if (card) {
        setFront(card.front);
        setBack(card.back);
      } else {
        setError('No flashcard was generated');
      }
    } catch {
      setError('Flashcard generation failed');
    }
    setLoading(false);
  }, [block.unit, block.description]);

  useEffect(() => { loadCard(); }, [loadCard]);

  if (loading) return <LoadingMode label="Creating flashcard..." />;

  if (error) {
    return (
      <div className="max-w-lg mx-auto w-full text-center space-y-4 animate-fade-in">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-foreground font-semibold">{error}</p>
        <button
          onClick={loadCard}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
        <button
          onClick={() => onComplete(0)}
          className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Flashcard</Badge>
        <span className="text-sm text-muted-foreground">{block.unit}</span>
      </div>

      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[240px] rounded-xl border-2 bg-card p-8 flex flex-col items-center justify-center text-center transition-all hover:shadow-card"
      >
        <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          {flipped ? 'Answer' : 'Question'}
        </p>
        <p className="text-xl font-medium text-foreground leading-relaxed max-w-md">
          {flipped ? back : front}
        </p>
        {!flipped && <p className="text-xs text-muted-foreground mt-6">Tap to reveal</p>}
      </button>

      {flipped && (
        <div className="animate-fade-in space-y-3">
          <p className="text-sm text-muted-foreground text-center">How well did you know this?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Didn't know", score: 0, style: 'border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400' },
              { label: 'Partially', score: 0.5, style: 'border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
              { label: 'Knew it', score: 1, style: 'border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400' },
            ].map(({ label, score, style }) => (
              <button
                key={score}
                onClick={() => onComplete(score)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${style}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feynman Step ─────────────────────────────────────────────

function FeynmanStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!explanation.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/feynman/assess', {
        question: `Explain ${block.unit} in your own words`,
        user_explanation: explanation,
        concept_name: block.unit,
      }, 20000);
      onComplete(res.score ?? 0.5);
    } catch {
      setError('Failed to assess explanation');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Explain it</Badge>
        <span className="text-sm text-muted-foreground">{block.unit}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium text-lg">Explain <span className="text-primary font-bold">{block.unit}</span> in your own words.</p>
        <p className="text-sm text-muted-foreground mt-2">Imagine you're teaching someone who has never heard of this before.</p>
      </div>

      <textarea
        value={explanation}
        onChange={e => setExplanation(e.target.value)}
        rows={8}
        placeholder="Start explaining..."
        className="w-full rounded-xl border-2 bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
        autoFocus
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={handleSubmit} className="text-primary hover:underline ml-2">Retry</button>
          <button onClick={() => onComplete(0.5)} className="text-muted-foreground hover:underline ml-2">Skip</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{explanation.split(/\s+/).filter(Boolean).length} words</span>
        <button
          onClick={handleSubmit}
          disabled={explanation.split(/\s+/).filter(Boolean).length < 10 || submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit
        </button>
      </div>
    </div>
  );
}

// ── Blurting Step ────────────────────────────────────────────

function BlurtingStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!response.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/blurting/feedback', {
        exercise_question: `Write everything you know about ${block.unit}`,
        blurted_response: response,
        concept_name: block.unit,
      }, 20000);
      onComplete(res.score ?? 0.5);
    } catch {
      setError('Failed to assess response');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Recall</Badge>
        <span className="text-sm text-muted-foreground">{block.unit}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium text-lg">Write everything you remember about <span className="text-primary font-bold">{block.unit}</span>.</p>
        <p className="text-sm text-muted-foreground mt-2">No peeking — just write what comes to mind.</p>
      </div>

      <textarea
        value={response}
        onChange={e => setResponse(e.target.value)}
        rows={8}
        placeholder="Start writing..."
        className="w-full rounded-xl border-2 bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
        autoFocus
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={handleSubmit} className="text-primary hover:underline ml-2">Retry</button>
          <button onClick={() => onComplete(0.5)} className="text-muted-foreground hover:underline ml-2">Skip</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{response.split(/\s+/).filter(Boolean).length} words</span>
        <button
          onClick={handleSubmit}
          disabled={response.split(/\s+/).filter(Boolean).length < 5 || submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit
        </button>
      </div>
    </div>
  );
}

// ── Generic Step (fallback) ─────────────────────────────────

function GenericStep({ block, mode, onComplete }: { block: StudyBlock; mode: string; onComplete: (score: number) => void }) {
  return (
    <div className="max-w-md mx-auto w-full text-center space-y-5 animate-fade-in">
      <Badge className="bg-forest-600 text-white border-0 capitalize">{mode}</Badge>
      <h2 className="font-semibold text-foreground text-xl">{block.unit}</h2>
      <p className="text-sm text-muted-foreground">{block.description}</p>
      <button
        onClick={() => onComplete(0.5)}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

// ── Loading Mode ────────────────────────────────────────────

function LoadingMode({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground mt-4 text-sm font-medium">{label}</p>
    </div>
  );
}

// ── Summary View ────────────────────────────────────────────

function SummaryView({ plan, scores, onHome, onAnother }: {
  plan: StudyPlan;
  scores: BlockScore[];
  onHome: () => void;
  onAnother: () => void;
}) {
  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    : 0;
  const avgPct = Math.round(avgScore * 100);

  const uniqueBlocks = new Set(scores.map(s => s.blockIndex)).size;

  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-md mx-auto w-full space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-600 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Session complete</h2>
          <p className="text-muted-foreground mt-2">
            {plan.topic} · {plan.total_duration} min
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{avgPct}%</p>
            <p className="text-xs text-muted-foreground mt-1">Score</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{uniqueBlocks}</p>
            <p className="text-xs text-muted-foreground mt-1">Blocks</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{scores.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Activities</p>
          </div>
        </div>

        {/* Per-block breakdown */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Block Scores</h3>
          {plan.blocks.map((block, i) => {
            const blockScores = scores.filter(s => s.blockIndex === i);
            const blockAvg = blockScores.length > 0
              ? Math.round((blockScores.reduce((s, x) => s + x.score, 0) / blockScores.length) * 100)
              : null;
            return (
              <div key={block.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate flex-1">{block.unit}</span>
                {blockAvg !== null ? (
                  <span className={cn(
                    'font-medium',
                    blockAvg >= 70 ? 'text-green-600' : blockAvg >= 40 ? 'text-yellow-600' : 'text-red-500'
                  )}>
                    {blockAvg}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onHome}
            className="flex-1 rounded-xl border-2 bg-card px-4 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            Back to Home
          </button>
          <button
            onClick={onAnother}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Study more
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
