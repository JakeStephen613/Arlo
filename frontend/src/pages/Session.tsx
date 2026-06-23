import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Layers,
  Zap,
  Brain,
  Pencil,
  RotateCcw,
  Pause,
  Play,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiPost } from '@/lib/apiClient';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import StudyPlanEditor from '@/components/StudyPlanEditor';
import ArloChatbot from '@/components/ArloChatbot';
import { usePomodoroClock } from '@/hooks/usePomodoroClock';
import { generateBedtimeReviewSheet } from '@/services/sessionApi';
import type { StudyPlan as SharedStudyPlan } from '@/types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

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
  custom?: boolean;
  user_notes?: string | null;
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

type SessionPhase = 'input' | 'plan-review' | 'studying' | 'summary';

interface BlockScore {
  blockIndex: number;
  mode: string;
  score: number;
}

// ── Main Component ───────────────────────────────────────────

const SESSION_STORAGE_KEY = 'arlo-session-state';

function saveSessionState(state: {
  phase: SessionPhase;
  topic: string;
  duration: number;
  plan: StudyPlan | null;
  subBlocks: ExpandedSubBlock[];
  currentSubBlockIndex: number;
  scores: BlockScore[];
}) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadSessionState(): {
  phase: SessionPhase;
  topic: string;
  duration: number;
  plan: StudyPlan | null;
  subBlocks: ExpandedSubBlock[];
  currentSubBlockIndex: number;
  scores: BlockScore[];
} | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSessionState() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export default function Session() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillTopic = (location.state as any)?.prefillTopic || '';
  const resumeSessionId = (location.state as any)?.resumeSessionId || null;

  // Try to restore a saved session
  const savedState = useRef(loadSessionState());

  const [phase, setPhase] = useState<SessionPhase>(savedState.current?.phase || 'input');
  const [topic, setTopic] = useState(savedState.current?.topic || prefillTopic);
  const [duration, setDuration] = useState(savedState.current?.duration || 60);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(savedState.current?.plan || null);
  const [error, setError] = useState<string | null>(null);

  // Studying state
  const [subBlocks, setSubBlocks] = useState<ExpandedSubBlock[]>(savedState.current?.subBlocks || []);
  const [currentSubBlockIndex, setCurrentSubBlockIndex] = useState(savedState.current?.currentSubBlockIndex || 0);
  const [scores, setScores] = useState<BlockScore[]>(savedState.current?.scores || []);
  const [preloadedContent, setPreloadedContent] = useState<Record<string, boolean>>({});

  const [planLoading, setPlanLoading] = useState(false);

  // Resume from Supabase paused session
  useEffect(() => {
    if (!resumeSessionId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('paused_sessions')
          .select('*')
          .eq('id', resumeSessionId)
          .single();
        if (error || !data) return;
        const sessionPlan = data.session_plan as unknown as StudyPlan;
        setPlan(sessionPlan);
        const expanded = expandBlocks(sessionPlan.blocks);
        setSubBlocks(expanded);
        setCurrentSubBlockIndex(data.current_block_index || 0);
        setTopic(data.title || '');
        setPhase('studying');
        setShowResumePrompt(false);
        // Remove the paused session from DB
        await supabase.from('paused_sessions').delete().eq('id', resumeSessionId);
      } catch (e) {
        console.error('Failed to resume paused session:', e);
      }
    })();
  }, [resumeSessionId]);

  // Persist session state on changes
  useEffect(() => {
    if (phase === 'studying' && plan) {
      saveSessionState({ phase, topic, duration, plan, subBlocks, currentSubBlockIndex, scores });
    } else if (phase === 'summary' || phase === 'input') {
      clearSessionState();
    }
  }, [phase, topic, duration, plan, subBlocks, currentSubBlockIndex, scores]);

  const [showResumePrompt, setShowResumePrompt] = useState(
    () => savedState.current?.phase === 'studying' && !!savedState.current?.plan
  );

  const discardSaved = () => {
    clearSessionState();
    setPhase('input');
    setTopic(prefillTopic);
    setDuration(60);
    setPlan(null);
    setSubBlocks([]);
    setCurrentSubBlockIndex(0);
    setScores([]);
    setShowResumePrompt(false);
  };

  const pauseAndExit = async () => {
    if (!plan) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('paused_sessions').upsert({
        user_id: user.id,
        title: plan.topic || topic,
        session_plan: plan as any,
        current_block_index: currentSubBlockIndex,
        paused_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Failed to save paused session:', e);
    }
    clearSessionState();
    navigate('/');
  };

  const generatePlan = async () => {
    if (!topic.trim() && !pdfContent) return;
    setPlanLoading(true);
    setPhase('plan-review');
    setError(null);
    try {
      const payload: Record<string, unknown> = { duration };
      if (topic.trim()) payload.objective = topic;
      if (pdfContent) payload.parsed_summary = pdfContent;
      const result = await apiPost<StudyPlan>('/study-session', payload, 60000);
      setPlan(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate study plan');
      setPhase('input');
    } finally {
      setPlanLoading(false);
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

  if (showResumePrompt) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-sm w-full rounded-xl border bg-card p-8 text-center shadow-card space-y-4">
          <RefreshCw className="w-8 h-8 text-primary mx-auto" />
          <h2 className="font-display text-xl font-bold">Resume session?</h2>
          <p className="text-sm text-muted-foreground">
            You have an unfinished session on <span className="font-medium text-foreground">{plan?.topic}</span>.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={discardSaved}
              className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              Start fresh
            </button>
            <button
              onClick={() => setShowResumePrompt(false)}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Resume
            </button>
          </div>
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
          onPdfParsed={setPdfContent}
          pdfContent={pdfContent}
          onSubmit={generatePlan}
        />
      )}
      {phase === 'plan-review' && (
        planLoading || !plan ? (
          <PlanReview
            plan={null}
            loading={planLoading}
            topic={topic}
            duration={duration}
            onStart={startStudying}
            onBack={() => { setPhase('input'); setPlan(null); }}
          />
        ) : (
          <StudyPlanEditor
            plan={plan as unknown as SharedStudyPlan}
            onSavePlan={(updated) => setPlan(updated as unknown as StudyPlan)}
            onStartSession={(updated) => { setPlan(updated as unknown as StudyPlan); setTimeout(startStudying, 0); }}
            onBack={() => { setPhase('input'); setPlan(null); }}
          />
        )
      )}
      {phase === 'studying' && plan && subBlocks.length > 0 && (
        <StudyingView
          plan={plan}
          subBlocks={subBlocks}
          currentIndex={currentSubBlockIndex}
          scores={scores}
          onComplete={handleSubBlockComplete}
          onPause={pauseAndExit}
          onSkipTo={(index: number) => setCurrentSubBlockIndex(index)}
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

function TopicInput({ topic, setTopic, duration, setDuration, onPdfParsed, pdfContent, onSubmit }: {
  topic: string;
  setTopic: (t: string) => void;
  duration: number;
  setDuration: (d: number) => void;
  onPdfParsed: (content: string | null) => void;
  pdfContent: string | null;
  onSubmit: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) return;
    setUploading(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
      const res = await fetch(`${base}/pdf/parse`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      onPdfParsed(data.summary || data.text || '');
    } catch {
      setFileName(null);
      onPdfParsed(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-lg mx-auto w-full space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Start a study session</h1>
          <p className="text-muted-foreground mt-2">Enter a topic or upload study materials and Arlo will build a structured curriculum for you.</p>
        </div>

        <div className="space-y-5">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (topic.trim() || pdfContent)) onSubmit(); }}
            placeholder="e.g. Cell Biology, Linear Algebra, World War 2..."
            className="w-full rounded-xl border-2 bg-card px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-center text-lg"
            autoFocus
          />

          <div className="flex items-center justify-center">
            <label className={cn(
              'cursor-pointer rounded-lg border border-dashed px-4 py-2.5 text-sm transition-colors',
              fileName ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-muted-foreground/30 text-muted-foreground hover:border-primary/30'
            )}>
              {uploading ? 'Parsing...' : fileName ? `${fileName}` : 'Upload PDF (optional)'}
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            </label>
            {fileName && (
              <button
                onClick={() => { setFileName(null); onPdfParsed(null); }}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

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
            disabled={!topic.trim() && !pdfContent}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            Generate Study Plan
          </button>
        </div>
      </div>
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

function PlanReview({ plan, loading, topic, duration, onStart, onBack }: {
  plan: StudyPlan | null;
  loading: boolean;
  topic: string;
  duration: number;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 py-8">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {plan?.topic || topic || 'Your study plan'}
          </h1>
          {plan ? (
            <p className="text-muted-foreground mt-1">
              {plan.blocks.length} blocks · {plan.total_duration} min · {plan.pomodoro} pomodoro
            </p>
          ) : (
            <p className="text-muted-foreground mt-1">Building your {duration}-minute curriculum...</p>
          )}
        </div>

        <div className="space-y-3">
          {plan ? plan.blocks.map((block, i) => (
            <div key={block.id} className="rounded-xl border bg-card p-5 space-y-2 animate-fade-in">
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
          )) : (
            Array.from({ length: Math.max(6, Math.floor(duration / 10)) }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-muted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-1/3 bg-muted rounded" />
                    <div className="h-3 w-16 bg-muted/60 rounded" />
                  </div>
                </div>
                <div className="h-3 w-full bg-muted/40 rounded ml-10" />
                <div className="h-3 w-2/3 bg-muted/40 rounded ml-10" />
              </div>
            ))
          )}
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
            disabled={loading || !plan}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {loading ? 'Generating...' : 'Start Studying'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Studying View (Sidebar + Content) ────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StudyingView({ plan, subBlocks, currentIndex, scores, onComplete, onPause, onSkipTo }: {
  plan: StudyPlan;
  subBlocks: ExpandedSubBlock[];
  currentIndex: number;
  scores: BlockScore[];
  onComplete: (score: number) => void;
  onPause: () => void;
  onSkipTo: (index: number) => void;
}) {
  const current = subBlocks[currentIndex];
  const currentBlockIndex = current.blockIndex;
  const preloadedRef = useRef<Set<string>>(new Set());
  const [chatExpanded, setChatExpanded] = useState(false);

  const currentBlock = current.block;
  const blockDurationSec = currentBlock.duration * 60;

  const {
    timeRemaining,
    totalTimeRemaining,
    timerState,
    isRunning,
    progress: timerProgress,
    startTimer,
    pauseTimer,
    skipBreak,
  } = usePomodoroClock({
    studyDuration: blockDurationSec,
    totalSessionDuration: plan.total_duration * 60,
    currentBlockIndex: currentIndex,
    autoStart: true,
    onSessionTimeUp: () => {},
  });

  // Preload next block's teaching content
  useEffect(() => {
    const nextTeach = subBlocks.find((sb, i) => i > currentIndex && sb.mode === 'teach');
    if (!nextTeach || preloadedRef.current.has(nextTeach.block.id)) return;
    preloadedRef.current.add(nextTeach.block.id);
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
    <div className="fixed inset-0 lg:left-56 flex gap-6 p-4 bg-background z-10">
      {/* Study plan sidebar — fixed, scrolls independently */}
      <div className="hidden md:flex md:flex-col w-56 shrink-0 space-y-2 overflow-y-auto">
        {/* Pomodoro Timer */}
        <div className="rounded-lg border bg-card p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {timerState === 'break' ? 'Break' : 'Timer'}
              </span>
            </div>
            <button
              onClick={isRunning ? pauseTimer : startTimer}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-2xl font-bold text-foreground text-center tabular-nums">
            {formatTime(timeRemaining)}
          </p>
          <div className="h-1 bg-secondary rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${timerProgress}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Session: {formatTime(totalTimeRemaining)}
          </p>
          {timerState === 'break' && (
            <button onClick={skipBreak} className="w-full mt-2 text-xs text-primary hover:underline">
              Skip break
            </button>
          )}
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Study Plan</p>
        {plan.blocks.map((block, i) => {
          const isDone = completedBlocks.has(i);
          const isCurrent = i === currentBlockIndex;
          return (
            <div
              key={block.id}
              onClick={() => {
                const targetSubIndex = subBlocks.findIndex(sb => sb.blockIndex === i);
                if (targetSubIndex >= 0) onSkipTo(targetSubIndex);
              }}
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm transition-all border cursor-pointer hover:bg-primary/10',
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

        <button
          onClick={onPause}
          className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Pause className="w-3 h-3" />
          Pause & Exit
        </button>
      </div>

      {/* Main content — fills remaining space, scrolls independently */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Progress bar */}
        <div className="mb-4 shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Block {currentBlockIndex + 1} of {plan.blocks.length}</span>
            <span>{current.block.unit}</span>
          </div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Scrollable content with top/bottom edge fade */}
        <div
          className="flex-1 overflow-y-auto pr-2"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          <div className="py-[15vh]">
            <ModeView subBlock={current} onComplete={onComplete} />
          </div>
        </div>

        {/* Navigation controls */}
        <div className="shrink-0 flex items-center justify-between pt-2 pb-1 border-t">
          <button
            onClick={() => { if (currentIndex > 0) onSkipTo(currentIndex - 1); }}
            disabled={currentIndex === 0}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3 rotate-180" /> Previous
          </button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {subBlocks.length}
          </span>
          <button
            onClick={() => onComplete(0)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Skip <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Chatbot */}
      <div className={cn(
        'hidden md:block shrink-0 transition-all',
        chatExpanded ? 'w-80' : 'w-10'
      )}>
        {chatExpanded ? (
          <ArloChatbot
            isExpanded={chatExpanded}
            onToggleExpand={() => setChatExpanded(false)}
            currentBlock={{
              id: currentBlock.id,
              unit: currentBlock.unit,
              technique: current.mode,
              description: currentBlock.description,
              duration: currentBlock.duration,
            }}
            sessionId={plan.session_id}
          />
        ) : (
          <button
            onClick={() => setChatExpanded(true)}
            className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-secondary transition-colors"
            title="Ask Arlo"
          >
            <MessageSquare className="w-4 h-4 text-primary" />
          </button>
        )}
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
  const [checkQuestions, setCheckQuestions] = useState<{ question: string; afterSection: number }[]>([]);
  const [checkAnswers, setCheckAnswers] = useState<Record<number, string>>({});
  const [checkResults, setCheckResults] = useState<Record<number, { correct: boolean; explanation: string }>>({});
  const [followUp, setFollowUp] = useState('');
  const [followUpContent, setFollowUpContent] = useState('');
  const [followUpStreaming, setFollowUpStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
        const res = await fetch(`${base}/teaching/stream`, {
          method: 'POST',
          headers,
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
  }, [block.id, retryCount]);

  const containerRef = useRef<HTMLDivElement>(null);



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
      const headers = await getAuthHeaders();
      const base = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
      const res = await fetch(`${base}/teaching/followup`, {
        method: 'POST',
        headers,
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
          onClick={() => { setError(null); setStreaming(true); setSections([]); setCurrentSection(''); setRetryCount(c => c + 1); }}
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

      {(sections.length > 0 || currentSection) && (
        <div className="space-y-6" ref={containerRef}>
          {sections.map((section, i) => (
            <div key={i}>
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  {!streaming && (
                    <span className="text-xs text-muted-foreground">{i + 1} of {sections.length}</span>
                  )}
                </div>
                <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                  {formatTeachingText(section)}
                </div>
              </div>
              {!streaming && checkQuestions.map((cq, ci) => cq.afterSection === i ? renderCheck(ci) : null)}
            </div>
          ))}

          {streaming && currentSection && (
            <div className="rounded-xl border bg-card/60 p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {sections.length + 1}
                </div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </div>
              <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                {formatTeachingText(currentSection)}
              </div>
            </div>
          )}

          {streaming && sections.length === 0 && !currentSection && (
            <div className="rounded-xl border bg-card p-6 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">Generating lesson...</span>
            </div>
          )}

          {!streaming && <div className="space-y-4 pt-2">
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
          </div>}
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
  interface QuizQ { question: string; options: string[]; correct_answer: string; explanation: string }
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<any>('/quiz/generate', {
        content: `Test understanding of ${block.unit}. Focus on: ${block.description}`,
        difficulty: 'medium',
        concept_name: block.unit,
        max_questions: 5,
      }, 45000);
      if (res.questions?.length) {
        setQuestions(res.questions);
      } else {
        setError('No questions were generated');
      }
    } catch {
      setError('Quiz generation failed');
    }
    setLoading(false);
  }, [block.unit, block.description]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const handleReveal = () => {
    setRevealed(true);
    const isCorrect = selected === questions[currentQ].correct_answer;
    setScores(prev => [...prev, isCorrect ? 1.0 : 0.0]);
  };

  const handleNext = () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      onComplete(avg);
    }
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

  const q = questions[currentQ];

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Quiz</Badge>
        <span className="text-sm text-muted-foreground">{block.unit} · {currentQ + 1}/{questions.length}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium leading-relaxed text-lg">{q.question}</p>
      </div>

      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const isCorrect = revealed && opt === q.correct_answer;
          const isWrong = revealed && opt === selected && opt !== q.correct_answer;
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

      {revealed && q.explanation && (
        <div className="rounded-xl border bg-forest-50 dark:bg-forest-900/20 p-5 text-sm animate-fade-in">
          <p className="font-semibold text-foreground mb-1">Why?</p>
          <p className="text-muted-foreground leading-relaxed">{q.explanation}</p>
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

      {revealed && (
        <button
          onClick={handleNext}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors animate-fade-in"
        >
          {currentQ + 1 < questions.length ? 'Next question' : 'Finish quiz'}
        </button>
      )}
    </div>
  );
}

// ── Flashcard Step ───────────────────────────────────────────

function FlashcardStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [cards, setCards] = useState<{ front: string; back: string }[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<any>('/flashcards', {
        content: `Create flashcards about: ${block.unit}. Focus on: ${block.description}`,
        concept_name: block.unit,
        num_cards: 5,
      }, 30000);
      if (res.flashcards?.length) {
        setCards(res.flashcards);
      } else {
        setError('No flashcards were generated');
      }
    } catch {
      setError('Flashcard generation failed');
    }
    setLoading(false);
  }, [block.unit, block.description]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleScore = (score: number) => {
    apiPost('/flashcards/review', { card_id: block.id, concept_name: block.unit, score }).catch(() => {});
    const newScores = [...scores, score];
    setScores(newScores);
    if (currentCard + 1 < cards.length) {
      setCurrentCard(prev => prev + 1);
      setFlipped(false);
    } else {
      const avg = newScores.reduce((a, b) => a + b, 0) / newScores.length;
      onComplete(avg);
    }
  };

  if (loading) return <LoadingMode label="Creating flashcards..." />;

  if (error) {
    return (
      <div className="max-w-lg mx-auto w-full text-center space-y-4 animate-fade-in">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-foreground font-semibold">{error}</p>
        <button
          onClick={loadCards}
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

  const card = cards[currentCard];

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Flashcard</Badge>
        <span className="text-sm text-muted-foreground">{block.unit} · {currentCard + 1}/{cards.length}</span>
      </div>

      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[240px] rounded-xl border-2 bg-card p-8 flex flex-col items-center justify-center text-center transition-all hover:shadow-card"
      >
        <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          {flipped ? 'Answer' : 'Question'}
        </p>
        <p className="text-xl font-medium text-foreground leading-relaxed max-w-md">
          {flipped ? card.back : card.front}
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
                onClick={() => handleScore(score)}
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
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ score: number; wellDone: string[]; gaps: string[] } | null>(null);
  const [allScores, setAllScores] = useState<number[]>([]);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ questions: string[] }>('/feynman/exercises', {
        teaching_content: `${block.unit}: ${block.description}`,
        concept_name: block.unit,
      }, 20000);
      setQuestions(res.questions?.length ? res.questions : [`Explain ${block.unit} in your own words.`]);
    } catch {
      setQuestions([`Explain ${block.unit} in your own words.`]);
    }
    setLoading(false);
  }, [block.unit, block.description]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  const handleSubmit = async () => {
    if (!explanation.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/feynman/assess', {
        question: questions[currentQ],
        user_explanation: explanation,
        concept_name: block.unit,
      }, 20000);
      const score = res.score ?? 0.5;
      setAllScores(prev => [...prev, score]);
      setFeedback({
        score: res.mastery_score ?? Math.round(score * 100),
        wellDone: res.what_went_well || [],
        gaps: res.gaps_in_understanding || [],
      });
    } catch {
      setError('Failed to assess explanation');
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(prev => prev + 1);
      setExplanation('');
      setFeedback(null);
      setSubmitting(false);
    } else {
      const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0.5;
      onComplete(avg);
    }
  };

  if (loading) return <LoadingMode label="Generating questions..." />;

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Explain it</Badge>
        <span className="text-sm text-muted-foreground">{block.unit} · {currentQ + 1}/{questions.length}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium text-lg leading-relaxed">{questions[currentQ]}</p>
        <p className="text-sm text-muted-foreground mt-2">Explain as if teaching someone who has never heard of this.</p>
      </div>

      {!feedback ? (
        <>
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
              disabled={explanation.split(/\s+/).filter(Boolean).length < 3 || submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Score</span>
              <span className={cn('text-2xl font-bold', feedback.score >= 70 ? 'text-green-600' : feedback.score >= 40 ? 'text-yellow-600' : 'text-red-500')}>
                {feedback.score}%
              </span>
            </div>
            {feedback.wellDone.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-green-600 mb-1">What you got right</p>
                {feedback.wellDone.map((item, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">• {item}</p>
                ))}
              </div>
            )}
            {feedback.gaps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-500 mb-1">Gaps to review</p>
                {feedback.gaps.map((item, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">• {item}</p>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleNext}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {currentQ + 1 < questions.length ? 'Next question' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Blurting Step ────────────────────────────────────────────

function BlurtingStep({ block, onComplete }: { block: StudyBlock; onComplete: (score: number) => void }) {
  const [exercises, setExercises] = useState<{ prompt: string; focus: string }[]>([]);
  const [currentEx, setCurrentEx] = useState(0);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ mentioned: string[]; missed: string[]; score: string; text: string } | null>(null);
  const [allScores, setAllScores] = useState<number[]>([]);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<any>('/blurting/exercises', {
        teaching_block: `${block.unit}: ${block.description}`,
        concept_name: block.unit,
      }, 20000);
      const exs = [res.exercise_1, res.exercise_2, res.exercise_3].filter(Boolean);
      setExercises(exs.length ? exs : [{ prompt: `Write everything you remember about ${block.unit}.`, focus: 'General recall' }]);
    } catch {
      setExercises([{ prompt: `Write everything you remember about ${block.unit}.`, focus: 'General recall' }]);
    }
    setLoading(false);
  }, [block.unit, block.description]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  const handleSubmit = async () => {
    if (!response.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/blurting/feedback', {
        exercise_question: exercises[currentEx].prompt,
        blurted_response: response,
        concept_name: block.unit,
      }, 20000);
      const score = res.score ?? 0.5;
      setAllScores(prev => [...prev, score]);
      setFeedback({
        mentioned: res.mentioned || [],
        missed: res.missed || [],
        score: res.score_fraction || `${Math.round(score * 100)}%`,
        text: res.feedback || '',
      });
    } catch {
      setError('Failed to assess response');
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentEx + 1 < exercises.length) {
      setCurrentEx(prev => prev + 1);
      setResponse('');
      setFeedback(null);
      setSubmitting(false);
    } else {
      const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0.5;
      onComplete(avg);
    }
  };

  if (loading) return <LoadingMode label="Generating recall exercises..." />;

  const ex = exercises[currentEx];

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-forest-600 text-white border-0">Recall</Badge>
        <span className="text-sm text-muted-foreground">{block.unit} · {currentEx + 1}/{exercises.length}</span>
      </div>

      <div className="rounded-xl border-2 border-forest-200 dark:border-forest-700 bg-card p-6">
        <p className="text-foreground font-medium text-lg leading-relaxed">{ex.prompt}</p>
        <p className="text-sm text-muted-foreground mt-2">No peeking — just write what comes to mind.</p>
      </div>

      {!feedback ? (
        <>
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
        </>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Recall score</span>
              <span className="text-lg font-bold text-primary">{feedback.score}</span>
            </div>
            {feedback.mentioned.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">Remembered</p>
                <div className="flex flex-wrap gap-1.5">
                  {feedback.mentioned.map((item, i) => (
                    <span key={i} className="rounded-md bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">{item}</span>
                  ))}
                </div>
              </div>
            )}
            {feedback.missed.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-500 mb-1">Missed</p>
                <div className="flex flex-wrap gap-1.5">
                  {feedback.missed.map((item, i) => (
                    <span key={i} className="rounded-md bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs text-red-700 dark:text-red-300">{item}</span>
                  ))}
                </div>
              </div>
            )}
            {feedback.text && (
              <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">{feedback.text}</p>
            )}
          </div>
          <button
            onClick={handleNext}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {currentEx + 1 < exercises.length ? 'Next exercise' : 'Continue'}
          </button>
        </div>
      )}
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

interface ReviewSheet {
  summary: string;
  memorization_facts: string[];
  weak_areas: string[];
  major_topics: string[];
  study_tips: string[];
}

function SummaryView({ plan, scores, onHome, onAnother }: {
  plan: StudyPlan;
  scores: BlockScore[];
  onHome: () => void;
  onAnother: () => void;
}) {
  const savedRef = useRef(false);
  const [reviewSheet, setReviewSheet] = useState<ReviewSheet | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    (async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { saveStudySessionData } = await import('@/services/sessionApi');
        await saveStudySessionData({
          topic: plan.topic,
          duration_minutes: plan.total_duration,
          user_id: session.user.id,
        });

        // Generate review sheet
        setReviewLoading(true);
        try {
          const sheet = await generateBedtimeReviewSheet(session.user.id) as ReviewSheet;
          setReviewSheet(sheet);
        } catch {}
        setReviewLoading(false);
      } catch (e) {
        console.error('Failed to save session data:', e);
      }
    })();
  }, [plan]);

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

        {/* Review Sheet */}
        {reviewLoading && (
          <div className="rounded-xl border bg-card p-5 text-center">
            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground mt-2">Generating review sheet...</p>
          </div>
        )}
        {reviewSheet && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Review Sheet
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{reviewSheet.summary}</p>
            {reviewSheet.memorization_facts?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Key facts to remember</p>
                <ul className="space-y-1">
                  {reviewSheet.memorization_facts.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {reviewSheet.study_tips?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Study tips</p>
                <ul className="space-y-1">
                  {reviewSheet.study_tips.map((t, i) => (
                    <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
