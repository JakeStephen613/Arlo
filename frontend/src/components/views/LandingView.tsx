import FastSessionPlanner from '@/components/FastSessionPlanner';
import SessionHistory from '@/components/SessionHistory';
import StudentDashboard from '@/components/StudentDashboard';
import PausedSessionsDisplay from '@/components/PausedSessionsDisplay';
import { PlanInputData } from '@/components/FastSessionPlanner';

interface LandingViewProps {
  onGeneratePlan: (data: PlanInputData) => void;
  isGenerating: boolean;
  hasConnectedTutor: boolean;
  showStudentDashboard: boolean;
  accountMode?: string;
  onStartSession: (session: unknown) => void;
  onResumeSession: (sessionId: string) => void;
}

const LandingView = ({
  onGeneratePlan,
  isGenerating,
  hasConnectedTutor,
  showStudentDashboard,
  accountMode,
  onStartSession,
  onResumeSession,
}: LandingViewProps) => {
  const showDashboard = hasConnectedTutor && accountMode === 'arlo_tutoring' && showStudentDashboard;

  return (
    <div className="space-y-8">
      <PausedSessionsDisplay onResumeSession={onResumeSession} />

      <FastSessionPlanner onGeneratePlan={onGeneratePlan} isGenerating={isGenerating} />

      <div className={`grid grid-cols-1 gap-8 ${showDashboard ? 'lg:grid-cols-3' : ''}`}>
        <div className={showDashboard ? 'lg:col-span-2' : ''}>
          <SessionHistory />
        </div>
        {showDashboard && (
          <div>
            <StudentDashboard onStartSession={onStartSession} onResumeSession={onResumeSession} />
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingView;
