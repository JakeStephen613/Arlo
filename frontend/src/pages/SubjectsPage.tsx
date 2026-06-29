import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, BookOpen, Clock, ChevronRight, Pencil, Trash2, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

interface SubjectWithStats extends Subject {
  sessionCount: number;
  totalMinutes: number;
  lastStudied: string | null;
  pausedCount: number;
}

export const SUBJECT_COLORS = [
  { name: 'blue',   bg: 'bg-blue-500',    light: 'bg-blue-50 dark:bg-blue-950',    ring: 'ring-blue-400',   text: 'text-blue-700 dark:text-blue-300',   banner: 'from-blue-500 to-blue-600' },
  { name: 'green',  bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950', ring: 'ring-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', banner: 'from-emerald-500 to-emerald-600' },
  { name: 'purple', bg: 'bg-violet-500',  light: 'bg-violet-50 dark:bg-violet-950',  ring: 'ring-violet-400', text: 'text-violet-700 dark:text-violet-300',  banner: 'from-violet-500 to-violet-600' },
  { name: 'orange', bg: 'bg-orange-500',  light: 'bg-orange-50 dark:bg-orange-950',  ring: 'ring-orange-400', text: 'text-orange-700 dark:text-orange-300',  banner: 'from-orange-500 to-orange-600' },
  { name: 'pink',   bg: 'bg-pink-500',    light: 'bg-pink-50 dark:bg-pink-950',    ring: 'ring-pink-400',   text: 'text-pink-700 dark:text-pink-300',   banner: 'from-pink-500 to-pink-600' },
  { name: 'teal',   bg: 'bg-teal-500',    light: 'bg-teal-50 dark:bg-teal-950',    ring: 'ring-teal-400',   text: 'text-teal-700 dark:text-teal-300',   banner: 'from-teal-500 to-teal-600' },
  { name: 'red',    bg: 'bg-red-500',     light: 'bg-red-50 dark:bg-red-950',      ring: 'ring-red-400',    text: 'text-red-700 dark:text-red-300',     banner: 'from-red-500 to-red-600' },
  { name: 'amber',  bg: 'bg-amber-500',   light: 'bg-amber-50 dark:bg-amber-950',   ring: 'ring-amber-400',  text: 'text-amber-700 dark:text-amber-300',  banner: 'from-amber-500 to-amber-600' },
];

export function getColorConfig(colorName: string) {
  return SUBJECT_COLORS.find(c => c.name === colorName) ?? SUBJECT_COLORS[0];
}

export default function SubjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadSubjects = async () => {
    if (!user) return;
    const { data: rawSubjects } = await supabase
      .from('subjects' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!rawSubjects) { setLoading(false); return; }

    // Fetch stats for each subject in parallel
    const withStats = await Promise.all((rawSubjects as Subject[]).map(async (s) => {
      const [{ data: completed }, { data: paused }] = await Promise.all([
        supabase
          .from('study_session_data')
          .select('duration_minutes, timestamp')
          .eq('subject_id' as any, s.id),
        supabase
          .from('paused_sessions')
          .select('id')
          .eq('subject_id' as any, s.id),
      ]);

      const sessionCount = completed?.length ?? 0;
      const totalMinutes = (completed ?? []).reduce((sum: number, c: any) => sum + (c.duration_minutes ?? 0), 0);
      const lastStudied = completed?.length
        ? (completed as any[]).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
        : null;

      return { ...s, sessionCount, totalMinutes, lastStudied, pausedCount: paused?.length ?? 0 };
    }));

    setSubjects(withStats);
    setLoading(false);
  };

  useEffect(() => { if (user) loadSubjects(); }, [user]);

  const formatDate = (ts: string | null) => {
    if (!ts) return null;
    const d = new Date(ts);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Organize your study sessions by subject.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Subject
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No subjects yet</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
            Create a subject folder to organize sessions, upload study materials, and track progress.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first subject
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map(s => {
            const color = getColorConfig(s.color);
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/subjects/${s.id}`)}
                className="group rounded-xl border bg-card overflow-hidden text-left hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                {/* Color bar */}
                <div className={cn('h-2 w-full bg-gradient-to-r', color.banner)} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', color.light)}>
                      <FolderOpen className={cn('w-5 h-5', color.text)} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors mt-1" />
                  </div>
                  <h3 className="font-semibold text-foreground text-base leading-tight">{s.name}</h3>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {s.sessionCount} session{s.sessionCount !== 1 ? 's' : ''}
                    </span>
                    {s.totalMinutes > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(s.totalMinutes)}
                      </span>
                    )}
                    {s.lastStudied && (
                      <span className="ml-auto">{formatDate(s.lastStudied)}</span>
                    )}
                  </div>
                  {s.pausedCount > 0 && (
                    <div className={cn('mt-3 rounded-md px-2.5 py-1.5 text-xs font-medium', color.light, color.text)}>
                      {s.pausedCount} paused — tap to resume
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateSubjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadSubjects(); }}
          userId={user!.id}
        />
      )}
    </div>
  );
}


function CreateSubjectModal({ onClose, onCreated, userId }: {
  onClose: () => void;
  onCreated: () => void;
  userId: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('subjects' as any).insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim() || null,
      color,
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-md p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">New Subject</h2>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); }}
              placeholder="e.g. AP Biology, Calculus II, Machine Learning"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Course details, goals, professor..."
              rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    c.bg,
                    color === c.name ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105',
                    color === c.name ? c.ring : ''
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Creating...' : 'Create Subject'}
          </button>
        </div>
      </div>
    </div>
  );
}
