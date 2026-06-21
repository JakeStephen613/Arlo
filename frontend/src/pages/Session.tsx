import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  X,
  Lightbulb,
  Brain,
  BookOpen,
  MessageSquare,
  Pencil,
  Clock,
  Trophy,
  TrendingUp,
  AlertCircle,
  Send,
  RefreshCw,
  ChevronDown,
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

const SKIP_CONFIDENCE_MODES = ['teach', 'review', 'diagnose'];

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

  const advanceToStep = (step: SessionStep) => {
    setCurrentStep(step);
    setScore(null);
    setConfidence(null);
    if (SKIP_CONFIDENCE_MODES.includes(step.mode)) {
      setPhase('step');
    } else {
      setPhase('confidence');
    }
  };

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
        advanceToStep(next.step);
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
          advanceToStep(next.step);
        }
      }, 1200);
    } catch (e: any) {
      setError(e.message);
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
            onClick={() => { setError(null); setPhase('pick'); }}
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
      {/* Progress bar for active session */}
      {plan && phase !== 'summary' && phase !== 'pick' && (
        <SessionProgressBar plan={plan} completedSteps={completedSteps} currentStep={currentStep} />
      )}

      <div className="flex-1 flex flex-col justify-center py-8">
        {phase === 'pick' && <IntentPicker onSelect={(i) => { navigate(`/session?intent=${i}`, { replace: true }); setPhase('topic'); }} />}
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
          <SummaryView summary={summary} onContinue={() => navigate('/')} onAnother={() => { setPhase('pick'); setPlan(null); setSummary(null); setCompletedSteps([]); navigate('/session', { replace: true }); }} />
        )}
      </div>
    </div>
  );
}

// ── Session Progress Bar ─────────────────────────────────────

function SessionProgressBar({ plan, completedSteps, currentStep }: {
  plan: SessionPlan;
  completedSteps: SessionStep[];
  currentStep: SessionStep | null;
}) {
  const done = completedSteps.length;
  const total = Math.max(plan.steps.length, done + 1);
  const pct = Math.min(100, total > 0 ? Math.round((done / total) * 100) : 0);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>Step {Math.min(done + 1, total)} of {total}</span>
        {currentStep && (
          <span className="text-foreground font-medium">{currentStep.concept_name}</span>
        )}
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Intent Picker ────────────────────────────────────────────

const INTENTS = [
  { id: 'quick_review', label: 'Quick Review', desc: '5-10 min — review due items and reinforce what you know.', icon: Clock, color: 'bg-forest-600' },
  { id: 'learn_new', label: 'Learn Something New', desc: 'Pick a topic, get taught, then practice with retrieval exercises.', icon: Lightbulb, color: 'bg-forest-500' },
  { id: 'deep_session', label: 'Deep Session', desc: 'Full adaptive arc — diagnose, teach, practice, assess, review.', icon: Brain, color: 'bg-forest-700' },
  { id: 'exam_prep', label: 'Exam Prep', desc: 'Broad coverage with weak-area drilling before a test.', icon: BookOpen, color: 'bg-forest-800' },
] as const;

function IntentPicker({ onSelect }: { onSelect: (intent: string) => void }) {
  return (
    <div className="max-w-lg mx-auto w-full space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Start a session</h1>
        <p className="text-muted-foreground mt-2">Choose how you want to study today.</p>
      </div>
      <div className="space-y-3">
        {INTENTS.map(({ id, label, desc, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="w-full flex items-center gap-4 rounded-xl border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-card group"
          >
            <div className={cn('rounded-lg p-2.5', color)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{label}</h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
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
    <div className="max-w-lg mx-auto w-full space-y-6">
      <div className="text-center">
        <Badge className="mb-3 capitalize bg-forest-600 text-white border-0">{intentLabel}</Badge>
        <h2 className="font-display text-2xl font-bold tracking-tight">What do you want to study?</h2>
        <p className="text-muted-foreground mt-2">Enter a topic, or skip to let Arlo choose based on your weak areas.</p>
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) onSubmit(); }}
          placeholder="e.g. Biology, Linear algebra, World War 2..."
          className="w-full rounded-xl border-2 bg-card px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-center text-lg"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
          >
            Let Arlo decide
          </button>
          <button
            onClick={topic.trim() ? onSubmit : onSkip}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start studying
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center animate-fade-in">
      <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground mt-5 font-medium">Building your session...</p>
      <p className="text-xs text-muted-foreground mt-1">Analyzing your learning data</p>
    </div>
  );
}

// ── Confidence Prompt ────────────────────────────────────────

const CONFIDENCE_LEVELS = [
  { value: 0.2, label: 'No idea' },
  { value: 0.4, label: 'Shaky' },
  { value: 0.6, label: 'Okay' },
  { value: 0.8, label: 'Confident' },
  { value: 1.0, label: 'Know it well' },
];

function ConfidencePrompt({ step, confidence, setConfidence, onSubmit }: {
  step: SessionStep;
  confidence: number | null;
  setConfidence: (c: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="max-w-md mx-auto w-full space-y-8 text-center animate-fade-in">
      <div>
        <Badge className="mb-3 capitalize bg-forest-600 text-white border-0">{step.mode}</Badge>
        <h2 className="font-display text-2xl font-bold tracking-tight">{step.concept_name}</h2>
        <p className="text-muted-foreground mt-2">How confident do you feel about this topic?</p>
      </div>

      <div className="space-y-2">
        {CONFIDENCE_LEVELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setConfidence(value); onSubmit(); }}
            className={cn(
              'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-all',
              confidence === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-card text-foreground hover:border-primary/30'
            )}
          >
            <span>{label}</span>
            <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${value * 100}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step View (mode UIs) ─────────────────────────────────────

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
        const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
        const res = await fetch(`${base}/teaching/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': session?.user?.id || '' },
          body: JSON.stringify({ topic: step.concept_name, concept_name: step.concept_name, difficulty: step.difficulty }),
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
                // Parse sections on the fly
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
                // Final parse
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

  // Auto-reveal first section when streaming finishes
  useEffect(() => {
    if (!streaming && visibleSections === 0 && sections.length > 0) {
      setVisibleSections(1);
    }
  }, [streaming, sections.length, visibleSections]);

  const showMore = () => {
    setVisibleSections(prev => Math.min(prev + 2, sections.length));
  };

  const allVisible = visibleSections >= sections.length;

  const handleCheckSubmit = async (idx: number) => {
    const q = checkQuestions[idx];
    if (!q || !checkAnswers[idx]?.trim()) return;
    try {
      const result = await apiPost<{ correct: boolean; score: number; explanation: string }>('/teaching/check', {
        question: q.question,
        user_answer: checkAnswers[idx],
        concept_name: step.concept_name,
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
        body: JSON.stringify({ original_topic: step.concept_name, follow_up: followUp }),
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

  // Render a single check question inline
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Badge className="bg-forest-600 text-white border-0 mb-1">Teaching</Badge>
          <h2 className="font-display text-2xl font-bold tracking-tight">{step.concept_name}</h2>
        </div>
      </div>

      {/* Streaming state */}
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

      {/* Sections revealed one at a time */}
      {!streaming && sections.length > 0 && (
        <div className="space-y-4">
          {sections.slice(0, visibleSections).map((section, i) => (
            <div key={i}>
              <div className="rounded-xl border bg-card p-6 animate-fade-in">
                <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                  {formatTeachingText(section)}
                </div>
              </div>

              {/* Show check question after relevant sections */}
              {checkQuestions.map((cq, ci) =>
                cq.afterSection === i ? renderCheck(ci) : null
              )}
            </div>
          ))}

          {/* Show more / continue */}
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
              {/* Follow-up input */}
              <div className="flex gap-2">
                <input
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleFollowUp(); }}
                  placeholder="Ask a follow-up or &quot;explain that differently&quot;..."
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

      <div ref={bottomRef} />
    </div>
  );
}

function formatTeachingText(text: string): string {
  // Strip any markdown that leaked through
  return text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
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
          content: `Create a multiple choice question to test understanding of ${step.concept_name}. The question should be specific and test real knowledge, not just ask "what do you know about X".`,
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
        setQuestion(`Which of the following best describes a key concept in ${step.concept_name}?`);
        setOptions(['Option A', 'Option B', 'Option C', 'Option D']);
        setCorrectAnswer('Option A');
      }
      setLoading(false);
    })();
  }, [step.concept_name, step.difficulty]);

  const handleReveal = () => {
    setRevealed(true);
    const isCorrect = selected === correctAnswer;
    setTimeout(() => onComplete(isCorrect ? 1.0 : 0.0), 2000);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0 capitalize">{step.mode === 'diagnose' ? 'Diagnostic' : 'Quiz'}</Badge>
        <span className="text-sm text-muted-foreground">{step.concept_name}</span>
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
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Flashcard</Badge>
        <span className="text-sm text-muted-foreground">{step.concept_name}</span>
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
        {!flipped && (
          <p className="text-xs text-muted-foreground mt-6">Tap to reveal</p>
        )}
      </button>

      {flipped && (
        <div className="animate-fade-in space-y-3">
          <p className="text-sm text-muted-foreground text-center">How well did you know this?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Didn\'t know', score: 0, style: 'border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400' },
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
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Explain it</Badge>
        <span className="text-sm text-muted-foreground">{step.concept_name}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium text-lg">Explain <span className="text-primary font-bold">{step.concept_name}</span> in your own words.</p>
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
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Recall</Badge>
        <span className="text-sm text-muted-foreground">{step.concept_name}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium text-lg">Write everything you remember about <span className="text-primary font-bold">{step.concept_name}</span>.</p>
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

// ── Review Step ──────────────────────────────────────────────

function ReviewStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  return (
    <div className="max-w-md mx-auto w-full text-center space-y-6 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-forest-600 flex items-center justify-center mx-auto">
        <TrendingUp className="w-8 h-8 text-white" />
      </div>
      <h2 className="font-display text-2xl font-bold">Session review</h2>
      <p className="text-muted-foreground leading-relaxed">
        Take a moment to reflect. What felt clearest? What still feels fuzzy?
      </p>
      <button
        onClick={() => onComplete(0.7)}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Finish session
      </button>
    </div>
  );
}

// ── Generic fallback Step ────────────────────────────────────

function GenericStep({ step, onComplete }: { step: SessionStep; onComplete: (score: number) => void }) {
  return (
    <div className="max-w-md mx-auto w-full text-center space-y-5 animate-fade-in">
      <Badge className="bg-forest-600 text-white border-0 capitalize">{step.mode}</Badge>
      <h2 className="font-semibold text-foreground text-xl">{step.concept_name}</h2>
      <p className="text-sm text-muted-foreground">{step.rationale}</p>
      <button
        onClick={() => onComplete(0.5)}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Continue
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
    <div className="max-w-sm mx-auto w-full flex flex-col items-center animate-fade-in space-y-5">
      <div className={cn(
        'w-20 h-20 rounded-2xl flex items-center justify-center',
        isGood ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
      )}>
        {isGood
          ? <Check className="w-10 h-10 text-green-600" />
          : <AlertCircle className="w-10 h-10 text-yellow-600" />
        }
      </div>

      <div className="text-center">
        <p className="text-4xl font-bold text-foreground">{pct}%</p>
        <p className="text-muted-foreground mt-1">{step.concept_name}</p>
      </div>

      {gap !== null && Math.abs(gap) > 5 && (
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          You felt {confPct}% confident — {gap > 10 ? 'you did better than expected!' : gap < -10 ? 'this needs more practice.' : 'good calibration.'}
        </p>
      )}

      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <span className="text-sm">Next step...</span>
      </div>
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
    <div className="max-w-md mx-auto w-full space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-forest-600 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Session complete</h2>
        <p className="text-muted-foreground mt-2">
          {summary.completed_steps} of {summary.total_steps} steps in {minutes} min
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{avgPct}%</p>
          <p className="text-xs text-muted-foreground mt-1">Score</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{summary.concepts_practiced.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Concepts</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{minutes}m</p>
          <p className="text-xs text-muted-foreground mt-1">Time</p>
        </div>
      </div>

      {summary.improved.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold text-foreground">Improved</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.improved.map(c => (
              <Badge key={c} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {summary.still_weak.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-semibold text-foreground">Needs more work</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.still_weak.map(c => (
              <Badge key={c} className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-0">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onContinue}
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
  );
}
