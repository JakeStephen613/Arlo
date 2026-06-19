import { useState, useEffect } from 'react';
import { formatSessionTitle } from '@/utils/sessionTitle';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, Clock, BookOpen, Brain, FileText, AlertCircle, ArrowLeft, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ExpandableContent from '@/components/session/ExpandableContent';
import AppHeader from '@/components/layout/AppHeader';

interface AssignedSessionHistory {
  id: string;
  title: string;
  description: string | null;
  assigned_at: string;
  completed_at: string | null;
  status: string;
  session_plan: any;
}

interface StudentInfo {
  id: string;
  full_name: string | null;
  email: string | null;
}

const StudentSessionHistory = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, userProfile, signOut } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AssignedSessionHistory[]>([]);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userProfile?.account_mode === 'tutor' && studentId) {
      fetchStudentInfo();
      fetchAssignedSessionHistory();
    }
  }, [user, userProfile, studentId]);

  const fetchStudentInfo = async () => {
    if (!user || !studentId) return;

    try {
      // First get student profile information
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', studentId)
        .single();

      if (profileError) {
        console.error('Error fetching student profile:', profileError);
        // Check if this is a tutor trying to access a student they're not connected to
        const { data: linkData, error: linkError } = await supabase
          .from('tutor_student_links')
          .select('student_id')
          .eq('tutor_id', user.id)
          .eq('student_id', studentId)
          .eq('status', 'active')
          .single();

        if (linkError || !linkData) {
          toast({
            title: "Access Denied",
            description: "You don't have access to view this student's sessions.",
            variant: "destructive",
          });
          navigate('/tutor');
          return;
        }
      } else {
        // Verify the tutor connection exists
        const { data: linkData, error: linkError } = await supabase
          .from('tutor_student_links')
          .select('student_id')
          .eq('tutor_id', user.id)
          .eq('student_id', studentId)
          .eq('status', 'active')
          .single();

        if (linkError || !linkData) {
          toast({
            title: "Access Denied",
            description: "You don't have access to view this student's sessions.",
            variant: "destructive",
          });
          navigate('/tutor');
          return;
        }

        setStudentInfo(profileData);
      }
    } catch (error) {
      console.error('Error in fetchStudentInfo:', error);
      toast({
        title: "Error",
        description: "Failed to load student information.",
        variant: "destructive",
      });
      navigate('/tutor');
    }
  };

  const fetchAssignedSessionHistory = async () => {
    if (!user || !studentId) return;

    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('assigned_sessions')
        .select(`
          id,
          title,
          description,
          assigned_at,
          completed_at,
          status,
          session_plan
        `)
        .eq('tutor_id', user.id)
        .eq('student_id', studentId)
        .order('assigned_at', { ascending: false });

      if (sessionError) {
        console.error('Error fetching assigned session history:', sessionError);
        toast({
          title: "Error",
          description: "Failed to load session history.",
          variant: "destructive",
        });
      } else {
        setSessions(sessionData || []);
      }
    } catch (error) {
      console.error('Error in fetchAssignedSessionHistory:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <AppHeader 
        userEmail={user?.email}
        appState="tutor-dashboard"
        onNewSession={() => {}}
        onSignOut={signOut}
        userAccountMode={userProfile?.account_mode}
      />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/tutor')}
          className="mb-6 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tutor Dashboard
        </Button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-6 h-6 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {studentInfo?.full_name || studentInfo?.email || 'Student'} - Assigned Sessions
              </h1>
            </div>
            <p className="text-gray-600">View all assigned study sessions and their completion status</p>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Sessions</h3>
                <p className="text-gray-500">You haven't assigned any sessions to this student yet.</p>
              </CardContent>
            </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Assigned Sessions ({sessions.length} sessions)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full space-y-2">
                {sessions.map((session) => (
                  <AccordionItem key={session.id} value={session.id} className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-start gap-3 text-left w-full">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{formatSessionTitle(session.title)}</h4>
                            <Badge 
                              variant={session.status === 'completed' ? 'default' : session.status === 'in_progress' ? 'secondary' : 'outline'}
                              className={
                                session.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : 
                                session.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                                'bg-gray-100 text-gray-800 border-gray-200'
                              }
                            >
                              {session.status === 'completed' ? '✓ Completed' : session.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Assigned {formatDate(session.assigned_at)}
                            </span>
                            {session.completed_at && (
                              <span className="flex items-center gap-1 text-green-600">
                                <Clock className="w-3 h-3" />
                                Completed {formatDate(session.completed_at)}
                              </span>
                            )}
                          </div>
                          {session.description && (
                            <p className="text-sm text-gray-600 mt-2">{session.description}</p>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 border-l-2 border-gray-100 pl-4">
                        {/* Only show completion data if session is completed */}
                        {session.status === 'completed' && session.session_plan?.completion_data && (
                          <>
                            {/* Bedtime Review Sheet */}
                            {session.session_plan.completion_data.review_sheet && Object.keys(session.session_plan.completion_data.review_sheet).length > 0 && (
                              <div className="bg-indigo-50 rounded-lg p-4">
                                <h5 className="font-medium text-indigo-900 mb-3 flex items-center gap-2">
                                  <Brain className="w-4 h-4" />
                                  Bedtime Review Sheet
                                </h5>
                                <div className="space-y-3">
                                  {session.session_plan.completion_data.review_sheet.summary && (
                                    <div className="bg-white rounded-lg p-3 border border-indigo-200">
                                      <p className="text-sm text-indigo-800 font-medium mb-2">Summary:</p>
                                      <p className="text-sm text-indigo-700">{session.session_plan.completion_data.review_sheet.summary}</p>
                                    </div>
                                  )}
                                  
                                  {session.session_plan.completion_data.review_sheet.memorization_facts?.length > 0 && (
                                    <div className="bg-white rounded-lg p-3 border border-indigo-200">
                                      <p className="text-sm font-medium text-indigo-700 mb-2">Key Facts to Remember:</p>
                                      <ScrollArea className="max-h-32">
                                        <ul className="text-sm text-indigo-700 space-y-1">
                                          {session.session_plan.completion_data.review_sheet.memorization_facts.map((fact: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                              <span className="text-indigo-500 mt-1">•</span>
                                              <span>{fact}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </ScrollArea>
                                    </div>
                                  )}

                                  {session.session_plan.completion_data.review_sheet.major_topics?.length > 0 && (
                                    <div className="bg-white rounded-lg p-3 border border-indigo-200">
                                      <p className="text-sm font-medium text-indigo-700 mb-2">Major Topics Covered:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {session.session_plan.completion_data.review_sheet.major_topics.map((topic: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-300">
                                            {topic}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {session.session_plan.completion_data.review_sheet.weak_areas?.length > 0 && (
                                    <div className="bg-white rounded-lg p-3 border border-orange-200">
                                      <p className="text-sm font-medium text-orange-700 mb-2">Areas to Review Further:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {session.session_plan.completion_data.review_sheet.weak_areas.map((area: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                            {area}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {session.session_plan.completion_data.review_sheet.key_concepts?.length > 0 && (
                                    <div className="bg-white rounded-lg p-3 border border-indigo-200">
                                      <p className="text-sm font-medium text-indigo-700 mb-2">Key Concepts:</p>
                                      <ScrollArea className="max-h-32">
                                        <ul className="text-sm text-indigo-700 space-y-1">
                                          {session.session_plan.completion_data.review_sheet.key_concepts.map((concept: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                              <span className="text-indigo-500 mt-1">•</span>
                                              <span>{concept}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </ScrollArea>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Quiz Mistakes */}
                            {Array.isArray(session.session_plan.completion_data.quiz_mistakes) && session.session_plan.completion_data.quiz_mistakes.length > 0 && (
                              <div className="bg-red-50 rounded-lg p-3">
                                <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  Quiz Mistakes ({session.session_plan.completion_data.quiz_mistakes.length})
                                </h5>
                                <ExpandableContent 
                                  items={session.session_plan.completion_data.quiz_mistakes.map(mistake => {
                                    const safeStringify = (value: any): string => {
                                      if (value === null || value === undefined) return '';
                                      if (typeof value === 'string') return value;
                                      if (typeof value === 'object') {
                                        if (value.text) return String(value.text);
                                        if (value.content) return String(value.content);
                                        if (value.value) return String(value.value);
                                        return JSON.stringify(value);
                                      }
                                      return String(value);
                                    };

                                    return {
                                      question: safeStringify(mistake.question),
                                      correct_answer: safeStringify(mistake.correct_answer || mistake.correctAnswer),
                                      user_answer: safeStringify(mistake.user_answer || mistake.userAnswer),
                                      explanation: safeStringify(mistake.explanation)
                                    };
                                  })} 
                                  type="quiz_mistakes" 
                                  maxInitialItems={3}
                                />
                              </div>
                            )}

                            {/* Flashcards */}
                            {Array.isArray(session.session_plan.completion_data.flashcards) && session.session_plan.completion_data.flashcards.length > 0 && (
                              <div className="bg-blue-50 rounded-lg p-3">
                                <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Generated Flashcards ({session.session_plan.completion_data.flashcards.length})
                                </h5>
                                <ExpandableContent 
                                  items={session.session_plan.completion_data.flashcards} 
                                  type="flashcards" 
                                  maxInitialItems={2}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Show session plan details if not completed */}
                        {session.status !== 'completed' && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h5 className="font-medium text-gray-900 mb-2">Session Plan</h5>
                            <p className="text-sm text-gray-600">
                              Topic: {formatSessionTitle(session.session_plan?.topic || session.title)}
                            </p>
                            {session.session_plan?.total_duration && (
                              <p className="text-sm text-gray-600">
                                Duration: {session.session_plan.total_duration} minutes
                              </p>
                            )}
                            {session.session_plan?.blocks?.length > 0 && (
                              <p className="text-sm text-gray-600">
                                Study blocks: {session.session_plan.blocks.length}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentSessionHistory;