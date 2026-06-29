import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Clock, Calendar, Pause, Play, Plus,
  Upload, FileText, Trash2, FolderOpen, Pencil, X, Check,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type Subject, getColorConfig, SUBJECT_COLORS } from './SubjectsPage';

interface CompletedSession {
  id: string;
  topic: string;
  duration_minutes: number;
  timestamp: string;
}

interface PausedSession {
  id: string;
  title: string;
  session_plan: any;
  current_block_index: number;
  paused_at: string;
  progress_data: any;
}

interface Resource {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

type Tab = 'sessions' | 'resources';

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [completed, setCompleted] = useState<CompletedSession[]>([]);
  const [paused, setPaused] = useState<PausedSession[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [tab, setTab] = useState<Tab>('sessions');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('blue');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user || !id) return;
    const [
      { data: sub },
      { data: comp },
      { data: paus },
      { data: res },
    ] = await Promise.all([
      supabase.from('subjects' as any).select('*').eq('id', id).single(),
      supabase.from('study_session_data').select('id, topic, duration_minutes, timestamp')
        .eq('subject_id' as any, id).order('timestamp', { ascending: false }),
      supabase.from('paused_sessions').select('*')
        .eq('subject_id' as any, id).order('paused_at', { ascending: false }),
      supabase.from('subject_resources' as any).select('*')
        .eq('subject_id', id).order('created_at', { ascending: false }),
    ]);

    if (sub) { setSubject(sub as Subject); setEditName((sub as any).name); setEditDesc((sub as any).description ?? ''); setEditColor((sub as any).color); }
    setCompleted((comp as CompletedSession[]) ?? []);
    setPaused((paus as PausedSession[]) ?? []);
    setResources((res as Resource[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, id]);

  const saveEdit = async () => {
    if (!editName.trim() || !id) return;
    await supabase.from('subjects' as any).update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      color: editColor,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setSubject(prev => prev ? { ...prev, name: editName, description: editDesc || null, color: editColor } : prev);
    setEditing(false);
  };

  const deleteSubject = async () => {
    if (!id || !confirm('Delete this subject and all its data?')) return;
    await supabase.from('subjects' as any).delete().eq('id', id);
    navigate('/subjects');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;
    setUploading(true);
    try {
      const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('subject-resources').upload(path, file);
      if (error) throw error;
      await supabase.from('subject_resources' as any).insert({
        subject_id: id,
        user_id: user.id,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        size_bytes: file.size,
      });
      await load();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteResource = async (res: Resource) => {
    await supabase.storage.from('subject-resources').remove([res.file_path]);
    await supabase.from('subject_resources' as any).delete().eq('id', res.id);
    setResources(prev => prev.filter(r => r.id !== res.id));
  };

  const downloadResource = async (res: Resource) => {
    const { data } = await supabase.storage.from('subject-resources').createSignedUrl(res.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const resumeSession = (s: PausedSession) => {
    navigate('/session', { state: { resumeSessionId: s.id } });
  };

  const studyAgain = (topic: string, previousSession?: CompletedSession) => {
    navigate('/session', { state: { prefillTopic: topic, subjectId: id, subjectName: subject?.name } });
  };

  const startNewSession = () => {
    navigate('/session', { state: { subjectId: id, subjectName: subject?.name } });
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Subject not found.
        <button onClick={() => navigate('/subjects')} className="block mt-4 mx-auto text-primary text-sm hover:underline">
          Back to Subjects
        </button>
      </div>
    );
  }

  const color = getColorConfig(subject.color);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/subjects')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Subjects
        </button>

        {editing ? (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Subject name"
              autoFocus
            />
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              placeholder="Description (optional)"
            />
            <div className="flex gap-2">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setEditColor(c.name)}
                  className={cn('w-7 h-7 rounded-full transition-all', c.bg, editColor === c.name ? `ring-2 ring-offset-2 ring-offset-card scale-110 ${c.ring}` : 'hover:scale-105')}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={saveEdit} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Save</button>
            </div>
          </div>
        ) : (
          <div className={cn('rounded-xl overflow-hidden border')}>
            <div className={cn('h-1.5 w-full bg-gradient-to-r', color.banner)} />
            <div className="bg-card p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color.light)}>
                  <FolderOpen className={cn('w-6 h-6', color.text)} />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">{subject.name}</h1>
                  {subject.description && (
                    <p className="text-sm text-muted-foreground mt-1">{subject.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{completed.length} session{completed.length !== 1 ? 's' : ''}</span>
                    {paused.length > 0 && <span className={cn('font-medium', color.text)}>{paused.length} paused</span>}
                    <span>{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={deleteSubject}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={startNewSession}
        className={cn(
          'w-full flex items-center justify-between rounded-xl p-5 transition-all hover:shadow-md group bg-gradient-to-r text-white',
          color.banner
        )}
      >
        <div>
          <p className="text-sm font-medium opacity-80">Study this subject</p>
          <p className="text-lg font-bold mt-0.5">{subject.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium opacity-80 hidden sm:block">Start session</span>
          <ChevronRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['sessions', 'resources'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'sessions' ? `Sessions (${completed.length + paused.length})` : `Resources (${resources.length})`}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {paused.length === 0 && completed.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No sessions yet. Start studying to build your history.</p>
              <button
                onClick={startNewSession}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Start first session
              </button>
            </div>
          ) : (
            <>
              {/* Paused sessions */}
              {paused.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Continue where you left off</p>
                  {paused.map(s => {
                    const plan = s.session_plan as any;
                    const totalBlocks = plan?.blocks?.length ?? 0;
                    const progress = totalBlocks > 0 ? Math.round((s.current_block_index / totalBlocks) * 100) : 0;
                    return (
                      <div key={s.id} className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                        <div className={cn('rounded-lg p-2.5', color.light)}>
                          <Pause className={cn('w-5 h-5', color.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{s.title || plan?.topic || 'Untitled'}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">paused</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDate(s.paused_at)}</span>
                            {totalBlocks > 0 && (
                              <span className="text-xs text-muted-foreground">{s.current_block_index}/{totalBlocks} blocks</span>
                            )}
                          </div>
                          {totalBlocks > 0 && (
                            <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full bg-gradient-to-r', color.banner)}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => resumeSession(s)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors bg-gradient-to-r',
                            color.banner
                          )}
                        >
                          <Play className="w-3.5 h-3.5" />
                          Resume
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed sessions */}
              {completed.length > 0 && (
                <div className="space-y-2">
                  {paused.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-4">Completed</p>}
                  {completed.map(s => (
                    <div
                      key={s.id}
                      className="rounded-xl border bg-card p-4 flex items-center gap-4 group hover:bg-secondary/20 transition-colors"
                    >
                      <div className="rounded-lg bg-secondary p-2.5">
                        <BookOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{s.topic}</span>
                        <div className="flex items-center gap-3 mt-1">
                          {s.duration_minutes > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {s.duration_minutes}m
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(s.timestamp)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => studyAgain(s.topic, s)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      >
                        Study again
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resources tab */}
      {tab === 'resources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Upload study materials — PDFs, notes, slides — to keep them organized here and use them when starting sessions.</p>
            <label className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer flex-shrink-0 bg-gradient-to-r',
              color.banner
            )}>
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload'}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {resources.length === 0 ? (
            <label className="block rounded-xl border-2 border-dashed bg-card p-12 text-center cursor-pointer hover:border-primary/30 transition-colors">
              <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Drop files here or click to upload</p>
              <p className="text-xs text-muted-foreground/60 mt-1">PDF, Word, images, and text files</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          ) : (
            <div className="space-y-2">
              {resources.map(r => (
                <div key={r.id} className="rounded-xl border bg-card p-4 flex items-center gap-4 group hover:bg-secondary/20 transition-colors">
                  <div className="rounded-lg bg-secondary p-2.5">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => downloadResource(r)}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors text-left truncate block"
                    >
                      {r.file_name}
                    </button>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {r.file_type && <span>{r.file_type.split('/')[1]?.toUpperCase() ?? r.file_type}</span>}
                      {r.size_bytes && <span>{formatSize(r.size_bytes)}</span>}
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteResource(r)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
