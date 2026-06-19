
import { BookOpen, Target, Brain, MessageCircle, PenTool, GraduationCap, FileText, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TECHNIQUES: Record<string, { label: string; icon: LucideIcon }> = {
  flashcards:    { label: 'Flashcards',   icon: BookOpen },
  feynman:       { label: 'Feynman',      icon: Brain },
  blurting:      { label: 'Blurting',     icon: PenTool },
  quiz:          { label: 'Quiz',         icon: Target },
  teaching:      { label: 'Teaching',     icon: GraduationCap },
  arlo_chat:     { label: 'ARLO Chat',    icon: MessageCircle },
  arlo_teaching: { label: 'ARLO',         icon: MessageCircle },
  'review-sheet':{ label: 'Review Sheet', icon: FileText },
  practice:      { label: 'Practice',     icon: Zap },
};

export type TechniqueKey = keyof typeof TECHNIQUES;

export const getTechniqueIcon = (technique: string): LucideIcon =>
  TECHNIQUES[technique.toLowerCase()]?.icon ?? BookOpen;

export const getTechniqueLabel = (technique: string): string =>
  TECHNIQUES[technique.toLowerCase()]?.label ?? 'Study';
