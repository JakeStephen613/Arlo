import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Home, BookOpen, Library, BarChart3, Zap, BookMarked, Brain } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Where do you want to go?" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go('/')}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </CommandItem>
          <CommandItem onSelect={() => go('/session')}>
            <BookOpen className="mr-2 h-4 w-4" />
            Session
          </CommandItem>
          <CommandItem onSelect={() => go('/library')}>
            <Library className="mr-2 h-4 w-4" />
            Library
          </CommandItem>
          <CommandItem onSelect={() => go('/progress')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Progress
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Start studying">
          <CommandItem onSelect={() => go('/session?intent=quick_review')}>
            <Zap className="mr-2 h-4 w-4" />
            Quick Review
          </CommandItem>
          <CommandItem onSelect={() => go('/session?intent=learn_new')}>
            <BookMarked className="mr-2 h-4 w-4" />
            Learn Something New
          </CommandItem>
          <CommandItem onSelect={() => go('/session?intent=deep_session')}>
            <Brain className="mr-2 h-4 w-4" />
            Deep Session
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
