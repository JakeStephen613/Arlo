import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSessionTitle } from '@/utils/sessionTitle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface PausedSession {
  id: string;
  title: string;
  session_plan: any;
  current_block_index: number;
  paused_at: string;
  expires_at: string;
}

interface PausedSessionCardProps {
  session: PausedSession;
  onResume: (sessionId: string) => void;
}

// Helper function to calculate total steps (expanded blocks) based on techniques
const getTotalSteps = (sessionPlan: any) => {
  if (!sessionPlan?.blocks) return 0;
  
  // Calculate total steps by counting all techniques in all blocks
  let totalSteps = 0;
  sessionPlan.blocks.forEach((block: any) => {
    if (block.techniques && Array.isArray(block.techniques) && block.techniques.length > 1) {
      // Multiple techniques: teaching + each technique = 1 + techniques.length
      totalSteps += 1 + block.techniques.length;
    } else {
      // Single technique block (including teaching-only blocks)
      totalSteps += 1;
    }
  });
  
  return totalSteps;
};

const PausedSessionCard = ({ session, onResume }: PausedSessionCardProps) => {
  const totalSteps = getTotalSteps(session.session_plan);
  
  // Use the same logic as BlockNavigation: step number + 1 for display
  const currentStep = session.current_block_index + 1; // Same as "Step X" in navigator
  const progress = totalSteps > 0 ?
    Math.round((session.current_block_index / totalSteps) * 100) : 0;

  const timeLeft = new Date(session.expires_at).getTime() - new Date().getTime();
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  
  return (
    <Card className="border-gradient bg-gradient-to-br from-indigo-50 via-blue-50/30 to-purple-50/30 shadow-md border-indigo-200 max-w-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            <Play className="w-4 h-4 text-indigo-600" />
            Resume Session
          </CardTitle>
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">
            {progress}% Complete
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-0">
        <div className="bg-white/60 rounded-lg p-3">
          <h3 className="font-medium text-slate-800 mb-2 text-sm">{formatSessionTitle(session.title)}</h3>
          
          <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {format(new Date(session.paused_at), 'MMM d, h:mm a')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {session.session_plan?.total_duration || 0}min
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Progress</span>
              <span className="text-slate-800 font-medium">
                Step {currentStep} of {totalSteps}
              </span>
            </div>
            
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-indigo-400 to-purple-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {hoursLeft > 0 && (
            <p className="text-xs text-indigo-700 mt-2 bg-indigo-50 p-2 rounded">
              ⏰ Expires in {hoursLeft}h
            </p>
          )}
        </div>
        
        <Button 
          onClick={() => onResume(session.id)}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium shadow-sm text-sm py-2"
        >
          <Play className="w-3 h-3 mr-2" />
          Resume Session
        </Button>
      </CardContent>
    </Card>
  );
};

export default PausedSessionCard;