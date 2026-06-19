import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSessionTitle } from '@/utils/sessionTitle';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User, Play, BookOpen, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { StudyPlan } from '@/services/api';
import { format } from 'date-fns';
interface AssignedSession {
  id: string;
  title: string;
  description: string;
  session_plan: StudyPlan;
  assigned_at: string;
  completed_at?: string;
  status: 'pending' | 'in_progress' | 'completed';
  profiles: {
    full_name: string;
  };
}
interface TutorAssignedSession {
  id: string;
  title: string;
  description: string | null;
  session_plan: StudyPlan;
  assigned_at: string;
  status: 'pending' | 'in_progress' | 'completed';
  tutor_name: string | null;
}
interface StudentDashboardProps {
  onStartSession: (plan: StudyPlan) => void;
  onResumeSession?: (sessionId: string) => void;
}
const StudentDashboard = ({
  onStartSession,
  onResumeSession
}: StudentDashboardProps) => {
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [tutorAssignedSessions, setTutorAssignedSessions] = useState<TutorAssignedSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  useEffect(() => {
    if (user) {
      fetchTutorAssignedSessions();
    }
  }, [user]);
  const fetchTutorAssignedSessions = async () => {
    if (!user) return;
    try {
      // Fetch ALL sessions (pending, in_progress, completed)
      const {
        data: allSessionsData,
        error: allSessionsError
      } = await supabase.from('assigned_sessions').select(`
          id,
          title,
          description,
          session_plan,
          assigned_at,
          completed_at,
          status,
          tutor_profile:profiles!assigned_sessions_tutor_id_fkey (
            full_name
          )
        `).eq('student_id', user.id).order('assigned_at', {
        ascending: false
      });
      if (allSessionsError) {
        console.error('Error fetching sessions:', allSessionsError);
        toast({
          title: "Error",
          description: "Failed to load assigned sessions.",
          variant: "destructive"
        });
      } else {
        // Separate sessions by status
        const allSessions = allSessionsData?.map((session: any) => ({
          id: session.id,
          title: session.title,
          description: session.description,
          session_plan: session.session_plan,
          assigned_at: session.assigned_at,
          completed_at: session.completed_at,
          status: session.status as 'pending' | 'in_progress' | 'completed',
          tutor_name: session.tutor_profile?.full_name
        })) || [];

        // Only show truly pending and in-progress sessions
        const pendingSessions = allSessions.filter(s => s.status === 'pending' || s.status === 'in_progress');
        setTutorAssignedSessions(pendingSessions);

        // Set completed sessions for calendar view
        const completedSessionsFormatted = allSessions.filter(s => s.status === 'completed').slice(0, 10) // Limit to recent 10
        .map((session: any) => ({
          id: session.id,
          title: session.title,
          description: session.description,
          session_plan: session.session_plan,
          assigned_at: session.assigned_at,
          completed_at: session.completed_at,
          status: session.status,
          profiles: {
            full_name: session.tutor_name
          }
        }));
        setCompletedSessions(completedSessionsFormatted);

        // Also set the old sessions state to empty to avoid duplicate displays
        setSessions([]);
      }
    } catch (error) {
      console.error('Error in fetchTutorAssignedSessions:', error);
    } finally {
      setLoading(false);
    }
  };
  const updateSessionStatus = async (sessionId: string, status: 'in_progress' | 'completed') => {
    try {
      const {
        error
      } = await supabase.from('assigned_sessions' as any).update({
        status,
        ...(status === 'completed' && {
          completed_at: new Date().toISOString()
        })
      }).eq('id', sessionId);
      if (error) {
        console.error('Error updating session status:', error);
        toast({
          title: "Error",
          description: "Failed to update session status.",
          variant: "destructive"
        });
      } else {
        setSessions(prev => prev.map(session => session.id === sessionId ? {
          ...session,
          status
        } : session));
        toast({
          title: status === 'completed' ? "Session Completed! 🎉" : "Session Started",
          description: status === 'completed' ? "Great job completing your study session!" : "Your study session is now in progress."
        });
      }
    } catch (error) {
      console.error('Error in updateSessionStatus:', error);
    }
  };
  const handleStartSession = async (session: AssignedSession) => {
    await updateSessionStatus(session.id, 'in_progress');
    onStartSession(session.session_plan);
  };
  const handleStartTutorSession = async (session: TutorAssignedSession) => {
    try {
      // Validate session plan before starting
      if (!session.session_plan || !session.session_plan.blocks || session.session_plan.blocks.length === 0) {
        toast({
          title: "Error",
          description: "This assigned session has an invalid study plan. Please contact your tutor.",
          variant: "destructive"
        });
        return;
      }

      // Additional validation for plan structure
      const plan = session.session_plan;
      if (!plan.topic || !plan.total_duration) {
        toast({
          title: "Error",
          description: "This session plan is missing essential information. Please contact your tutor.",
          variant: "destructive"
        });
        return;
      }

      // Validate blocks have required properties
      const invalidBlocks = plan.blocks.filter(block => !block.id || !block.unit || !block.technique || !block.duration);
      if (invalidBlocks.length > 0) {
        toast({
          title: "Error",
          description: "Some study blocks in this session are incomplete. Please contact your tutor.",
          variant: "destructive"
        });
        return;
      }
      // Create the session plan first
      const sessionPlan = {
        ...session.session_plan,
        session_id: session.id,
        assigned_session_id: session.id
      };

      // Call onStartSession FIRST to initialize the session in the parent
      onStartSession(sessionPlan);

      // Then update the database status
      const {
        error
      } = await supabase.from('assigned_sessions').update({
        status: 'in_progress'
      }).eq('id', session.id);
      if (error) {
        console.error('Error updating tutor session status:', error);
        toast({
          title: "Warning",
          description: "Session started but failed to update status.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Session Started!",
          description: "Starting your tutor-assigned study session."
        });
      }

      // Remove from tutor assigned sessions list and refresh
      setTutorAssignedSessions(prev => prev.filter(s => s.id !== session.id));

      // Force refresh the tutor assigned sessions to ensure UI updates correctly
      setTimeout(() => {
        fetchTutorAssignedSessions();
      }, 100);
    } catch (error) {
      console.error('Error in handleStartTutorSession:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while starting the session.",
        variant: "destructive"
      });
    }
  };
  const getSessionDates = () => {
    return sessions.map(session => new Date(session.assigned_at));
  };
  const getSelectedDateSessions = () => {
    if (!selectedDate) return [];
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    return sessions.filter(session => {
      const sessionDateStr = format(new Date(session.assigned_at), 'yyyy-MM-dd');
      return sessionDateStr === selectedDateStr;
    });
  };
  if (loading) {
    return <Card>
        <CardHeader>
          <CardTitle>Study Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>;
  }

  // Get all assigned sessions for calendar highlighting (both pending and completed)
  const getAllSessionDates = () => {
    const pendingDates = sessions.map(session => new Date(session.assigned_at));
    const tutorAssignedDates = tutorAssignedSessions.map(session => new Date(session.assigned_at));
    const completedDates = completedSessions.map(session => new Date(session.assigned_at));
    return [...pendingDates, ...tutorAssignedDates, ...completedDates];
  };

  // Get sessions for selected date (all types)
  const getSelectedDateAllSessions = () => {
    if (!selectedDate) return {
      pending: [],
      completed: [],
      tutorAssigned: []
    };
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    return {
      pending: sessions.filter(session => {
        const sessionDateStr = format(new Date(session.assigned_at), 'yyyy-MM-dd');
        return sessionDateStr === selectedDateStr && session.status !== 'completed';
      }),
      completed: completedSessions.filter(session => {
        const sessionDateStr = format(new Date(session.assigned_at), 'yyyy-MM-dd');
        return sessionDateStr === selectedDateStr;
      }),
      tutorAssigned: tutorAssignedSessions.filter(session => {
        const sessionDateStr = format(new Date(session.assigned_at), 'yyyy-MM-dd');
        return sessionDateStr === selectedDateStr;
      })
    };
  };
  return <div className="space-y-6">
      {/* Unified Tutoring Dashboard */}
      <Card className="border-gradient bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Tutoring Dashboard
          </CardTitle>
          <CardDescription className="text-slate-600">
            Manage your tutor-assigned sessions and track your progress
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* New Assignments Alert */}
          {tutorAssignedSessions.length > 0 && <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-8 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    New Assignments
                  </h3>
                  <p className="text-slate-600 text-sm">Ready to start your tutor-assigned sessions</p>
                </div>
              </div>
              
              {tutorAssignedSessions.map(session => <Card key={session.id} className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-50 via-indigo-50/50 to-purple-50/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                  
                  <CardHeader className="pb-4 pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-slate-800 mb-1">
                            {formatSessionTitle(session.title)}
                          </CardTitle>
                          <CardDescription className="text-slate-600 font-medium">
                            Assigned by {session.tutor_name || 'Your Tutor'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border-indigo-200 font-semibold px-3 py-1">
                          {session.session_plan.total_duration}min
                        </Badge>
                        
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6 pt-0">
                    {session.description && <div className="bg-gradient-to-r from-white/80 to-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                          Session Notes
                        </h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{session.description}</p>
                      </div>}
                    
                    
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700">Ready to begin</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-600 font-medium">Available now</span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-white/60 rounded-full h-2 mb-3">
                        <div className="bg-gradient-to-r from-indigo-400 to-purple-400 h-2 rounded-full w-0 transition-all duration-500"></div>
                      </div>
                      
                      <Button onClick={() => handleStartTutorSession(session)} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 py-3">
                        <Play className="w-5 h-5 mr-2" />
                        Start Assignment
                      </Button>
                    </div>
                  </CardContent>
                </Card>)}
            </div>}

          {/* Calendar Section */}
          

          {/* Sessions for Selected Date */}
          {selectedDate && (() => {
          const datesSessions = getSelectedDateAllSessions();
          const hasAnySessions = datesSessions.pending.length > 0 || datesSessions.completed.length > 0 || datesSessions.tutorAssigned.length > 0;
          return <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                
                
                
              </div>;
        })()}

          {/* Overall Session History Summary */}
          

          {/* No sessions state */}
          {sessions.length === 0 && completedSessions.length === 0 && tutorAssignedSessions.length === 0 && <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Tutoring Sessions Yet</h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Connect with a tutor to receive personalized study sessions and start your learning journey.
              </p>
            </div>}
        </CardContent>
      </Card>
    </div>;
};
export default StudentDashboard;