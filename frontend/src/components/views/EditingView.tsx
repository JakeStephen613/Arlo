import StudyPlanEditor from '@/components/StudyPlanEditor';
import type { StudyPlan } from '@/types';

interface EditingViewProps {
  plan: StudyPlan;
  onSavePlan: (plan: StudyPlan) => Promise<void>;
  onStartSession: (plan: StudyPlan) => Promise<void>;
  onBack: () => void;
}

const EditingView = ({ plan, onSavePlan, onStartSession, onBack }: EditingViewProps) => (
  <StudyPlanEditor
    plan={plan}
    onSavePlan={onSavePlan}
    onStartSession={onStartSession}
    onBack={onBack}
  />
);

export default EditingView;
