
import { Button } from '@/components/ui/button';
import { BookOpen, LogOut, User, UserPlus } from 'lucide-react';

interface AppHeaderProps {
  userEmail?: string;
  appState: string;
  onNewSession: () => void;
  onSignOut: () => void;
  onConnectTutor?: () => void;
  userAccountMode?: 'arlo_tutoring' | 'hybrid' | 'tutor';
}

const AppHeader = ({ userEmail, appState, onNewSession, onSignOut, onConnectTutor, userAccountMode }: AppHeaderProps) => {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ARLO</h1>
              <p className="text-sm text-indigo-600 font-medium">AI Personal Tutor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {userEmail && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{userEmail}</span>
              </div>
            )}
            
            {appState === 'study-session' && (
              <Button 
                onClick={onNewSession}
                variant="outline"
                className="rounded-full px-6 py-2"
              >
                New Session
              </Button>
            )}

            {userAccountMode === 'arlo_tutoring' && onConnectTutor && (
              <Button
                onClick={onConnectTutor}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Connect a Tutor
              </Button>
            )}
            
            <Button
              onClick={onSignOut}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
