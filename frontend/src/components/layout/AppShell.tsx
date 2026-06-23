import { ReactNode, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Library,
  LogOut,
  Menu,
  X,
  Command,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import CommandPalette from './CommandPalette';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/session', label: 'Session', icon: BookOpen },
  { path: '/library', label: 'Library', icon: Library },
  { path: '/tutor', label: 'Tutor', icon: GraduationCap },
];

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 backdrop-blur-sm px-4 h-14">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-display text-lg font-bold text-primary tracking-tight">Arlo</span>
        <button
          onClick={() => setCommandOpen(true)}
          className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
        >
          <Command className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <nav className="relative w-64 h-full bg-card border-r animate-slide-in flex flex-col">
            <SidebarContent
              currentPath={location.pathname}
              onNavigate={navigate}
              onClose={() => setSidebarOpen(false)}
              onOpenCommand={() => { setSidebarOpen(false); setCommandOpen(true); }}
              userEmail={user?.email}
              onSignOut={signOut}
              accountMode={userProfile?.account_mode}
            />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-56 border-r bg-card">
        <SidebarContent
          currentPath={location.pathname}
          onNavigate={navigate}
          onOpenCommand={() => setCommandOpen(true)}
          userEmail={user?.email}
          onSignOut={signOut}
          accountMode={userProfile?.account_mode}
        />
      </nav>

      {/* Main content */}
      <main className="lg:pl-56 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}


interface SidebarContentProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onClose?: () => void;
  onOpenCommand: () => void;
  userEmail?: string;
  onSignOut: () => void;
  accountMode?: string;
}

function SidebarContent({ currentPath, onNavigate, onClose, onOpenCommand, userEmail, onSignOut, accountMode }: SidebarContentProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 h-14 border-b">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground tracking-tight">Arlo</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 py-3 px-2 space-y-0.5">
        {NAV_ITEMS.filter(item => item.path !== '/tutor' || accountMode === 'tutor').map(item => {
          const active = item.path === '/' ? currentPath === '/' : currentPath.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="border-t px-2 py-3 space-y-1">
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Command className="w-4 h-4" />
            Command
          </span>
          <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {userEmail && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground truncate">{userEmail}</div>
        )}

        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );
}
