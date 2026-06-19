import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSessionTitle } from '@/utils/sessionTitle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Play, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AssignedSession {
  id: string;
  title: string;
  description: string;
  session_plan: any;
  assigned_at: string;
  status: 'pending' | 'in_progress' | 'completed';
  profiles: {
    full_name: string;
  };
}

interface AssignedSessionCardProps {
  onStartSession?: (session: AssignedSession) => void;
}

const AssignedSessionCard = ({ onStartSession }: AssignedSessionCardProps = {}) => {
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchAssignedSessions();
    }
  }, [user]);

  const fetchAssignedSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('assigned_sessions' as any)
        .select(`
          id,
          title,
          description,
          session_plan,
          assigned_at,
          status,
          tutor_profile:profiles!assigned_sessions_tutor_id_fkey (
            full_name
          )
        `)
        .eq('student_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Error fetching assigned sessions:', error);
        toast({
          title: "Error",
          description: "Failed to load assigned sessions.",
          variant: "destructive",
        });
      } else {
        setSessions(data?.map((session: any) => ({
          id: session.id,
          title: session.title,
          description: session.description,
          session_plan: session.session_plan,
          assigned_at: session.assigned_at,
          status: session.status as 'pending' | 'in_progress' | 'completed',
          profiles: session.tutor_profile
        })) || []);
      }
    } catch (error) {
      console.error('Error in fetchAssignedSessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSessionStatus = async (sessionId: string, status: 'in_progress' | 'completed') => {
    try {
      const { error } = await supabase
        .from('assigned_sessions' as any)
        .update({ 
          status,
          ...(status === 'completed' && { completed_at: new Date().toISOString() })
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session status:', error);
        toast({
          title: "Error",
          description: "Failed to update session status.",
          variant: "destructive",
        });
      } else {
        setSessions(prev => 
          prev.map(session => 
            session.id === sessionId 
              ? { ...session, status }
              : session
          )
        );
        
        toast({
          title: status === 'completed' ? "Session Completed! 🎉" : "Session Started",
          description: status === 'completed' 
            ? "Great job completing your study session!" 
            : "Your study session is now in progress.",
        });
      }
    } catch (error) {
      console.error('Error in updateSessionStatus:', error);
    }
  };

  const handleStartSession = async (session: AssignedSession) => {
    await updateSessionStatus(session.id, 'in_progress');
    if (onStartSession) {
      onStartSession(session);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assigned Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Assigned Sessions
          </CardTitle>
          <CardDescription>
            No sessions assigned yet. Connect with a tutor to receive personalized study sessions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Assigned Sessions ({sessions.length})
      </h3>
      
      {sessions.map((session) => (
        <Card key={session.id} className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{formatSessionTitle(session.title)}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {session.profiles?.full_name || 'Unknown Tutor'}
                  </span>
                </CardDescription>
              </div>
              <Badge 
                variant={
                  session.status === 'completed' ? 'default' : 
                  session.status === 'in_progress' ? 'secondary' : 
                  'outline'
                }
              >
                {session.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {session.description && (
              <p className="text-sm text-gray-600 mb-4">{session.description}</p>
            )}
            
            <div className="flex gap-2">
              {session.status === 'pending' && (
                <Button 
                  onClick={() => handleStartSession(session)}
                  size="sm"
                  className="bg-indigo-500 hover:bg-indigo-600"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Start Session
                </Button>
              )}
              
              {session.status === 'in_progress' && (
                <Button 
                  onClick={() => updateSessionStatus(session.id, 'completed')}
                  size="sm"
                  variant="outline"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Mark Complete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AssignedSessionCard;
