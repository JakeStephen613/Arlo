import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Lightbulb,
  Brain,
  BookOpen,
  MessageSquare,
  Pencil,
  ChevronRight,
  Clock,
  Trophy,
  TrendingUp,
  AlertCircle,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiPost, apiGet } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface SessionStep {
  step_number: number;
  mode: string;
  concept_id: string;
  concept_name: string;
  difficulty: string;
  rationale: string;
  completed: boolean;
  score: number | null;
  confidence_before: number | null;
}

interface SessionPlan {
  session_id: string;
  user_id: string;
  intent: string;
  steps: SessionStep[];
  current_step: number;
  started_at: string;
}

interface SessionSummary {
  session_id: string;
  intent: string;
  total_steps: number;
  completed_steps: number;
  concepts_practiced: string[];
  improved: string[];
  still_weak: string[];
  scheduled_next: string[];
  time_on_task_seconds: number;
  average_score: number;
}

interface NextStepResponse {
  step: SessionStep | null;
  done: boolean;
  summary: SessionSummary | null;
}

type SessionPhase = 'pick' | 'topic' | 'loading' | 'confidence' | 'step' | 'feedback' | 'summary';

// ── Main Component ───────────────────────────────────────────

export default function Session() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const intent = searchParams.get('intent');

  const [phase, setPhase] = useState<SessionPhase>(intent ? 'topic' : 'pick');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [currentStep, setCurrentStep] = useState<SessionStep | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<SessionStep[]>([]);

  const createSession = useCallback(async (sessionIntent: string, sessionTopic?: string) => {
    setPhase('loading');
    setError(null);
    try {
      const newPlan = await apiPost<SessionPlan>('/session/create', {
        intent: sessionIntent,
        topic: sessionTopic || undefined,
      });
      setPlan(newPlan);

      const next = await apiGet<NextStepResponse>(`/session/${newPlan.session_id}/next`);
      if (next.done) {
        setSummary(next.summary);
        setPhase('summary');
      } else if (next.step) {
        setCurrentStep(next.step);
        setPhase('confidence');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create session');
      setPhase('pick');
    }
  }, []);

  useEffect(() => {
    if (intent && phase === 'topic') {
      if (intent === 'quick_review') {
        createSession(intent);
      }
    }
  }, [intent, phase, createSession]);

  const handleTopicSubmit = () => {
    if (intent) createSession(intent, topic);
  };

  const handleConfidenceSubmit = () => {
    setPhase('step');
  };

  const handleStepComplete = async (stepScore: number) => {
    if (!plan || !currentStep) return;
    setScore(stepScore);
    setPhase('feedback');

    try {
      const next = await apiPost<NextStepResponse>(`/session/${plan.session_id}/submit`, {
        score: stepScore,
        confidence_before: confidence,
      });

      setCompletedSteps(prev => [...prev, { ...currentStep, score: stepScore, completed: true }]);

      setTimeout(() => {
        if (next.done) {
          setSummary(next.summary);
          setPhase('summary');
        } else if (next.step) {
          setCurrentStep(next.step);
          setScore(null);
          setConfidence(null);
          setPhase('confidence');
        }
      }, 1500);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-foreground font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setPhase('pick'); }}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Progress bar for active session */}
      {plan && phase !== 'summary' && phase !== 'pick' && (
        <SessionProgressBar plan={plan} completedSteps={completedSteps} currentStep={currentStep} />
      )}

      {phase === 'pick' && <IntentPicker onSelect={(i) => { navigate(`/session?intent=${i}`); setPhase('topic'); }} />}
      {phase === 'topic' && intent && intent !== 'quick_review' && (
        <TopicInput intent={intent} topic={topic} setTopic={setTopic} onSubmit={handleTopicSubmit} onSkip={() => createSession(intent)} />
      )}
      {phase === 'loading' && <LoadingState />}
      {phase === 'confidence' && currentStep && (
        <ConfidencePrompt step={currentStep} confidence={confidence} setConfidence={setConfidence} onSubmit={handleConfidenceSubmit} />
      )}
      {phase === 'step' && currentStep && plan && (
        <StepView step={currentStep} plan={plan} onComplete={handleStepComplete} />
      )}
      {phase === 'feedback' && currentStep && score !== null && (
        <FeedbackView step={currentStep} score={score} confidence={confidence} />
      )}
      {phase === 'summary' && summary && (
        <SummaryView summary={summary} onContinue={() => navigate('/')} onAnother={() => { setPhase('pick'); setPlan(null); setSummary(null); setCompletedSteps([]); navigate('/session'); }} />
      )}
    </div>
  );
}

// ── Session Progress Bar ─────────────────────────────────────

function SessionProgressBar({ plan, completedSteps, currentStep }: {
  plan: SessionPlan;
  completedSteps: SessionStep[];
  currentStep: SessionStep | null;
}) {
  const total = plan.steps.length;
  const done = completedSteps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{done} of {total} steps</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      {currentStep && (
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{currentStep.concept_name}</span>
          {' '}&middot;{' '}{currentStep.rationale}
        </p>
      )}
    </div>
  );
}

// ── Intent Picker ────────────────────────────────────────────

const INTENTS = [
  { id: 'quick_review', label: 'Quick Review', desc: '5-10 min. Review due items.', icon: Clock },
  { id: 'learn_new', label: 'Learn Something New', desc: 'Teach + practice a topic.', icon: Lightbulb },
  { id: 'deep_session', label: 'Deep Session', desc: 'Full arc: diagnose, teach, practice, review.', icon: Brain },
  { id: 'exam_prep', label: 'Exam Prep', desc: 'Breadth + weak-area drilling.', icon: BookOpen },
] as const;

function IntentPicker({ onSelect }: { onSelect: (intent: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Start a session</h1>
        <p className="text-muted-foreground mt-1 text-sm">Choose how you want to study.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {INTENTS.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 text-left transition-all hover:border-primary/40 hover:shadow-card',
              id === 'quick_review' ? 'border-accent bg-accent-light' : 'bg-card'
            )}
          >
            <div className="mt-0.5 rounded-md bg-primary/10 p-2">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">{label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Topic Input ──────────────────────────────────────────────

function TopicInput({ intent, topic, setTopic, onSubmit, onSkip }: {
  intent: string;
  topic: string;
  setTopic: (t: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const intentLabel = intent.replace(/_/g, ' ');
  return (
    <div className="space-y-5">
      <div>
        <Badge variant="secondary" className="mb-2 capitalize">{intentLabel}</Badge>
        <h2 className="font-display text-xl font-bold tracking-tight">What do you want to study?</h2>
        <p className="text-muted-foreground mt-1 text-sm">Enter a topic, or skip to let Arlo choose based on your weak areas.</p>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) onSubmit(); }}
          placeholder="e.g. Photosynthesis, Linear algebra, WW2 causes..."
          className="flex-1 rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <button
          onClick={topic.trim() ? onSubmit : onSkip}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {topic.trim() ? 'Start' : 'Skip'}
        </button>
      </div>
      {topic.trim() === '' && (
        <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Let Arlo decide based on your learning data
        </button>
      )}
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground mt-4">Building your session...</p>
    </div>
  );
}

// ── Confidence Prompt ────────────────────────────────────────

const CONFIDENCE_LEVELS = [
  { value: 0.2, label: 'No idea', emoji: '😕' },
  { value: 0.4, label: 'Shaky', emoji: '🤔' },
  { value: 0.6, label: 'Okay', emoji: '😐' },
  { value: 0.8, label: 'Confident', emoji: '😊' },
  { value: 1.0, label: 'Nailed it', emoji: '💪' },
];

function ConfidencePrompt({ step, confidence, setConfidence, onSubmit }: {
  step: SessionStep;
  confidence: number | null;
  setConfidence: (c: number) => void;
  onSubmit: () => void;
}) {
  const modeIcon = MODE_ICONS[step.mode] || BookOpen;
  const ModeIcon = modeIcon;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <ModeIcon className="w-6 h-6 text-primary" />
        </div>
        <Badge variant="secondary" className="mb-2 capitalize">{step.mode}</Badge>
        <h2 className="font-display text-xl font-bold tracking-tight">{step.concept_name}</h2>
        <p className="text-muted-foreground text-sm mt-1">Before we start — how confident do you feel about this?</p>
      </div>

      <div className="flex justify-center gap-2">
        {CONFIDENCE_LEVELS.map(({ value, label, emoji }) => (
          <button
            key={value}
            onClick={() => setConfidence(value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
              confidence === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-card text-muted-foreground hover:border-primary/30'
            )}
          >
            <span className="text-lg">{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onSubmit}
          disabled={confidence === null}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step View (mode UIs) ─────────────────────────────────────

const MODE_ICONS: Record<string, any> = {
  diagnose: Brain,
  teach: BookOpen,
  quiz: Lightbulb,
  flashcard: BookOpen,
  feynman: MessageSquare,
  blurting: Pencil,
  review: TrendingUp,
};

function StepView({ step, plan, onComplete }: {
  step: SessionStep;
  plan: SessionPlan;
  onComplete: (score: number) => void;
}) {
  switch (step.mode) {
    case 'teach':
      return <TeachingStep step={step} onComplete={onComplete} />;
    case 'quiz':
    case 'diagnose':
      return <QuizStep step={step} onComplete={onComplete} />;
    case 'flashcard':
      return <FlashcardStep step={step} onComplete={onComplete} />;
    case 'feynman':
      return <FeynmanStep step={step} onComplete={onComplete} />;
    case 'blurting':
      return <BlurtingStep step={step} onComplete={onComplete} />;
    case 'review':
      return <ReviewStep step={step} onComplete={onComplete} />;
    default:
      return <GenericStep step={step} onComplete={onComplete} />;
  }
}

// ── Teaching Step (streaming SSE) ────────────────────────────

function TeachingStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  const [content, setContent] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [checkQuestions, setCheckQuestions] = useState<string[]>([]);
  const [currentCheck, setCurrentCheck] = useState<string | null>(null);
  const [checkAnswer, setCheckAnswer] = useState('');
  const [checkResult, setCheckResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [followUpContent, setFollowUpContent] = useState('');
  const [followUpStreaming, setFollowUpStreaming] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
        const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
        const res = await fetch(`${base}/teaching/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': session?.user?.id || '',
          },
          body: JSON.stringify({
            topic: step.concept_name,
            concept_name: step.concept_name,
            difficulty: step.difficulty,
          }),
          signal: ac.signal,
        });

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
                setContent(fullText);
              } else if (evt.type === 'done') {
                setStreaming(false);
                // Extract check questions
                const checks = [...fullText.matchAll(/\[CHECK\](.*?)\[\/CHECK\]/gs)].map(m => m[1].trim());
                setCheckQuestions(checks);
              }
            } catch {}
          }
        }
        setStreaming(false);
      } catch (e: any) {
        if (e.name !== 'AbortError') setStreaming(false);
      }
    })();

    return () => ac.abort();
  }, [step.concept_name, step.difficulty]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  const handleCheckSubmit = async () => {
    if (!currentCheck || !checkAnswer.trim()) return;
    try {
      const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      const result = await apiPost<{ correct: boolean; score: number; explanation: string }>('/teaching/check', {
        question: currentCheck,
        user_answer: checkAnswer,
        concept_name: step.concept_name,
        user_id: session?.user?.id,
      });
      setCheckResult(result);
    } catch {
      setCheckResult({ correct: false, explanation: 'Could not grade.' });
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
        body: JSON.stringify({ original_topic: step.concept_name, follow_up: followUp }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let text = '';
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
            if (evt.type === 'token') { text += evt.content; setFollowUpContent(text); }
          } catch {}
        }
      }
    } catch {}
    setFollowUpStreaming(false);
    setFollowUp('');
  };

  const displayContent = content
    .replace(/\[CHECK\](.*?)\[\/CHECK\]/gs, '')
    .trim();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">{step.concept_name}</h2>
        </div>
        <Badge variant="secondary" className="capitalize">{step.difficulty}</Badge>
      </div>

      <div
        ref={contentRef}
        className="rounded-lg border bg-card p-5 max-h-[60vh] overflow-y-auto prose prose-sm prose-forest max-w-none text-foreground"
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {displayContent}
          {streaming && <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle" />}
        </div>
      </div>

      {/* Check questions */}
      {!streaming && checkQuestions.length > 0 && !currentCheck && (
        <div className="rounded-lg border border-accent/30 bg-accent-light p-4">
          <p className="text-sm font-medium text-foreground mb-2">Check your understanding</p>
          {checkQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => setCurrentCheck(q)}
              className="block text-sm text-primary hover:underline mt-1"
            >
              {i + 1}. {q}
            </button>
          ))}
        </div>
      )}

      {currentCheck && !checkResult && (
        <div className="rounded-lg border border-accent/30 bg-accent-light p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">{currentCheck}</p>
          <div className="flex gap-2">
            <input
              value={checkAnswer}
              onChange={e => setCheckAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCheckSubmit(); }}
              placeholder="Your answer..."
              className="flex-1 rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button onClick={handleCheckSubmit} className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {checkResult && (
        <div className={cn(
          'rounded-lg border p-4',
          checkResult.correct ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        )}>
          <div className="flex items-center gap-2 mb-1">
            {checkResult.correct ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-500" />}
            <span className="text-sm font-medium">{checkResult.correct ? 'Correct!' : 'Not quite'}</span>
          </div>
          <p className="text-sm text-muted-foreground">{checkResult.explanation}</p>
        </div>
      )}

      {/* Follow-up */}
      {!streaming && (
        <div className="flex gap-2">
          <input
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleFollowUp(); }}
            placeholder="Ask a follow-up or &quot;explain differently&quot;..."
            className="flex-1 rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleFollowUp}
            disabled={!followUp.trim() || followUpStreaming}
            className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground hover:bg-secondary/80 disabled:opacity-40"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      )}

      {followUpContent && (
        <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {followUpContent}
          {followUpStreaming && <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle" />}
        </div>
      )}

      {!streaming && (
        <div className="flex justify-end">
          <button
            onClick={() => onComplete(0.5)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            I've read this — continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quiz Step ────────────────────────────────────────────────

function QuizStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiPost<any>('/quiz/generate', {
          content: `Test the student's understanding of: ${step.concept_name}`,
          difficulty: step.difficulty,
          concept_name: step.concept_name,
          max_questions: 1,
        }, 30000);
        const q = res.questions?.[0];
        if (q) {
          setQuestion(q.question);
          setOptions(q.options);
          setCorrectAnswer(q.correct_answer);
          setExplanation(q.explanation);
        }
      } catch {
        setQuestion(`What do you know about ${step.concept_name}?`);
        setOptions(['A lot', 'Some basics', 'Very little', 'Nothing']);
        setCorrectAnswer('A lot');
      }
      setLoading(false);
    })();
  }, [step.concept_name, step.difficulty]);

  const handleSelect = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
  };

  const handleReveal = () => {
    setRevealed(true);
    const isCorrect = selected === correctAnswer;
    setTimeout(() => onComplete(isCorrect ? 1.0 : 0.0), 2000);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-primary" />
        <Badge variant="secondary" className="capitalize">{step.mode}</Badge>
        <span className="text-xs text-muted-foreground">{step.concept_name}</span>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-foreground font-medium leading-relaxed">{question}</p>
      </div>

      <div className="space-y-2">
        {options.map((opt, i) => {
          const isCorrect = revealed && opt === correctAnswer;
          const isWrong = revealed && opt === selected && opt !== correctAnswer;
          return (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              className={cn(
                'w-full text-left rounded-lg border p-3.5 text-sm transition-all',
                selected === opt && !revealed && 'border-primary bg-primary/5',
                isCorrect && 'border-green-500 bg-green-50 dark:bg-green-900/20',
                isWrong && 'border-red-500 bg-red-50 dark:bg-red-900/20',
                !selected || revealed ? '' : 'hover:border-primary/40',
                !revealed && selected !== opt && 'bg-card'
              )}
              disabled={revealed}
            >
              <span className="font-medium text-muted-foreground mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
              {isCorrect && <Check className="inline w-4 h-4 text-green-600 ml-2" />}
              {isWrong && <X className="inline w-4 h-4 text-red-500 ml-2" />}
            </button>
          );
        })}
      </div>

      {revealed && explanation && (
        <div className="rounded-lg border bg-accent-light p-4 text-sm text-foreground animate-fade-in">
          <p className="font-medium mb-1">Explanation</p>
          <p className="text-muted-foreground">{explanation}</p>
        </div>
      )}

      {!revealed && selected && (
        <div className="flex justify-end">
          <button
            onClick={handleReveal}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Check answer
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Flashcard Step ────────────────────────────────────────────

function FlashcardStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiPost<any>('/flashcards', {
          content: `Create a flashcard about: ${step.concept_name}`,
          concept_name: step.concept_name,
        }, 20000);
        const card = res.flashcards?.[0];
        if (card) { setFront(card.front); setBack(card.back); }
      } catch {
        setFront(`What is ${step.concept_name}?`);
        setBack('Think about the key definition and properties.');
      }
      setLoading(false);
    })();
  }, [step.concept_name]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" />
        <Badge variant="secondary">Flashcard</Badge>
        <span className="text-xs text-muted-foreground">{step.concept_name}</span>
      </div>

      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[200px] rounded-lg border bg-card p-8 text-center transition-all hover:shadow-card"
      >
        <p className="text-xs text-muted-foreground mb-3">{flipped ? 'Answer' : 'Question'}</p>
        <p className="text-lg font-medium text-foreground leading-relaxed">
          {flipped ? back : front}
        </p>
        {!flipped && (
          <p className="text-xs text-muted-foreground mt-4">Click to reveal answer</p>
        )}
      </button>

      {flipped && (
        <div className="animate-fade-in">
          <p className="text-sm text-muted-foreground text-center mb-3">How well did you know this?</p>
          <div className="flex justify-center gap-2">
            {[
              { label: 'Didn\'t know', score: 0, color: 'border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20' },
              { label: 'Partially', score: 0.5, color: 'border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' },
              { label: 'Knew it', score: 1, color: 'border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20' },
            ].map(({ label, score, color }) => (
              <button
                key={score}
                onClick={() => onComplete(score)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${color}`}
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

function FeynmanStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!explanation.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPost<any>('/feynman/assess', {
        question: `Explain ${step.concept_name} in your own words`,
        user_explanation: explanation,
        concept_name: step.concept_name,
      }, 20000);
      onComplete(res.score ?? 0.5);
    } catch {
      onComplete(0.5);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <Badge variant="secondary">Feynman</Badge>
        <span className="text-xs text-muted-foreground">{step.concept_name}</span>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-foreground font-medium">Explain <span className="text-primary">{step.concept_name}</span> in your own words.</p>
        <p className="text-sm text-muted-foreground mt-1">Pretend you're teaching it to someone who knows nothing about it.</p>
      </div>

      <textarea
        value={explanation}
        onChange={e => setExplanation(e.target.value)}
        rows={6}
        placeholder="Start explaining..."
        className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        autoFocus
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{explanation.split(/\s+/).filter(Boolean).length} words</span>
        <button
          onClick={handleSubmit}
          disabled={!explanation.trim() || submitting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit explanation
        </button>
      </div>
    </div>
  );
}

// ── Blurting Step ────────────────────────────────────────────

function BlurtingStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!response.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPost<any>('/blurting/feedback', {
        exercise_question: `Write everything you know about ${step.concept_name}`,
        blurted_response: response,
        concept_name: step.concept_name,
      }, 20000);
      onComplete(res.score ?? 0.5);
    } catch {
      onComplete(0.5);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Pencil className="w-4 h-4 text-primary" />
        <Badge variant="secondary">Blurting</Badge>
        <span className="text-xs text-muted-foreground">{step.concept_name}</span>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-foreground font-medium">Write everything you know about <span className="text-primary">{step.concept_name}</span>.</p>
        <p className="text-sm text-muted-foreground mt-1">Don't look anything up — just blurt it all out.</p>
      </div>

      <textarea
        value={response}
        onChange={e => setResponse(e.target.value)}
        rows={6}
        placeholder="Start writing..."
        className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        autoFocus
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{response.split(/\s+/).filter(Boolean).length} words</span>
        <button
          onClick={handleSubmit}
          disabled={!response.trim() || submitting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit
        </button>
      </div>
    </div>
  );
}

// ── Review Step ──────────────────────────────────────────────

function ReviewStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  return (
    <div className="space-y-5 animate-fade-in text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <TrendingUp className="w-6 h-6 text-primary" />
      </div>
      <h2 className="font-display text-xl font-bold">Session review</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Take a moment to reflect on what you learned. What concepts felt clearest? What still feels fuzzy?
      </p>
      <button
        onClick={() => onComplete(0.7)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Finish session
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Generic fallback Step ────────────────────────────────────

function GenericStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  return (
    <div className="space-y-5 animate-fade-in text-center">
      <Badge variant="secondary" className="capitalize">{step.mode}</Badge>
      <h2 className="font-semibold text-foreground">{step.concept_name}</h2>
      <p className="text-sm text-muted-foreground">{step.rationale}</p>
      <button
        onClick={() => onComplete(0.5)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Feedback View (post-step) ────────────────────────────────

function FeedbackView({ step, score, confidence }: {
  step: SessionStep;
  score: number;
  confidence: number | null;
}) {
  const pct = Math.round(score * 100);
  const isGood = score >= 0.7;
  const confPct = confidence !== null ? Math.round(confidence * 100) : null;
  const gap = confPct !== null ? pct - confPct : null;

  return (
    <div className="flex flex-col items-center py-8 animate-fade-in space-y-4">
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center',
        isGood ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
      )}>
        {isGood
          ? <Check className="w-8 h-8 text-green-600" />
          : <AlertCircle className="w-8 h-8 text-yellow-600" />
        }
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold text-foreground">{pct}%</p>
        <p className="text-sm text-muted-foreground">{step.concept_name}</p>
      </div>

      {gap !== null && (
        <p className="text-xs text-muted-foreground">
          You felt {confPct}% confident — {gap > 10 ? 'you did better than expected!' : gap < -10 ? 'this needs more work.' : 'your calibration is solid.'}
        </p>
      )}

      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-xs text-muted-foreground">Loading next step...</p>
    </div>
  );
}

// ── Summary View ─────────────────────────────────────────────

function SummaryView({ summary, onContinue, onAnother }: {
  summary: SessionSummary;
  onContinue: () => void;
  onAnother: () => void;
}) {
  const minutes = Math.max(1, Math.round(summary.time_on_task_seconds / 60));
  const avgPct = Math.round(summary.average_score * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Trophy className="w-7 h-7 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Session complete</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {summary.completed_steps} of {summary.total_steps} steps completed in {minutes} min
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{avgPct}%</p>
          <p className="text-xs text-muted-foreground">Average score</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{summary.concepts_practiced.length}</p>
          <p className="text-xs text-muted-foreground">Concepts</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{minutes}m</p>
          <p className="text-xs text-muted-foreground">Time</p>
        </div>
      </div>

      {/* Improved */}
      {summary.improved.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-foreground">Improved</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.improved.map(c => (
              <Badge key={c} variant="secondary" className="text-green-700 dark:text-green-400">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Still weak */}
      {summary.still_weak.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-medium text-foreground">Needs more work</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.still_weak.map(c => (
              <Badge key={c} variant="secondary" className="text-yellow-700 dark:text-yellow-400">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled next */}
      {summary.scheduled_next.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Scheduled for review</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.scheduled_next.map(c => (
              <Badge key={c} variant="outline">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onContinue}
          className="flex-1 rounded-md border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          Back to Home
        </button>
        <button
          onClick={onAnother}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Start another
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
