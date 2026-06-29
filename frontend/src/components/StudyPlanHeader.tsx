
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, BookOpen } from 'lucide-react';
import { StudyPlan } from './StudyPlanEditor';

interface StudyPlanHeaderProps {
  plan: StudyPlan;
  onBack: () => void;
  onSave: () => void;
  onStartSession: () => void;
  hasUnsavedChanges?: boolean;
}

const StudyPlanHeader = ({ plan, onBack, onSave, onStartSession, hasUnsavedChanges }: StudyPlanHeaderProps) => {
  return (
    <div className="space-y-6">
      {/* Navigation and Actions */}
      <div className="flex items-center justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex items-center gap-2 hover:bg-background/80 border-border/50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Planner
        </Button>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={onSave} 
            variant="outline"
            className={`relative ${hasUnsavedChanges ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100' : ''}`}
          >
            {hasUnsavedChanges && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></div>
            )}
            Save Changes
          </Button>
          <Button 
            onClick={onStartSession} 
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Session
          </Button>
        </div>
      </div>

      {/* Plan Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-lg shadow-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {plan.topic}
                </h1>
                <p className="text-muted-foreground">
                  Customize your study session
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{plan.blocks?.length || 0}</div>
              <div className="text-muted-foreground">Blocks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{plan.total_duration || plan.blocks?.reduce((sum, b) => sum + (b.duration || 0), 0) || 0}</div>
              <div className="text-muted-foreground">Minutes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{plan.techniques?.length || 0}</div>
              <div className="text-muted-foreground">Techniques</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanHeader;
