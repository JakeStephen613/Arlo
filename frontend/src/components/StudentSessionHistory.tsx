import { useState, useEffect } from 'react';
import { formatSessionTitle } from '@/utils/sessionTitle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, Clock, BookOpen, Brain, FileText, AlertCircle, ArrowLeft, User, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ExpandableContent from '@/components/session/ExpandableContent';

interface StudentSessionHistoryProps {
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  onBack: () => void;
}

interface CompletedSession {
  id: string;
  title: string;
  completed_at: string;
  session_plan: {
    topic: string;
    completion_data?: {
      completed_at: string;
      duration_minutes: number;
      review_sheet?: any;
      quiz_mistakes?: any[];
      flashcards?: any[];
      summary?: string;
      phases_used?: string[];
    };
  };
}

const StudentSessionHistory = ({ studentId, studentName, studentEmail, onBack }: StudentSessionHistoryProps) => {
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchStudentSessions();
  }, [studentId, user]);

  const fetchStudentSessions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('assigned_sessions')
        .select(`
          id,
          title,
          completed_at,
          session_plan
        `)
        .eq('tutor_id', user.id)
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching student sessions:', error);
        toast({
          title: "Error",
          description: "Failed to load student session history.",
          variant: "destructive",
        });
      } else {
        setSessions((data || []).map(session => ({
          ...session,
          session_plan: session.session_plan as any
        })));
      }
    } catch (error) {
      console.error('Error in fetchStudentSessions:', error);
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
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50/50 to-emerald-50/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/20 p-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  {studentName || studentEmail?.split('@')[0] || 'Student'}'s Completed Sessions
                </CardTitle>
                <p className="text-green-100 text-sm mt-1">{studentEmail}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200"></div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent absolute top-0"></div>
            </div>
            <p className="text-green-600 font-medium">Loading session history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50/50 to-emerald-50/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/20 p-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  {studentName || studentEmail?.split('@')[0] || 'Student'}'s Completed Sessions
                </CardTitle>
                <p className="text-green-100 text-sm mt-1">{studentEmail}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Completed Sessions Yet</h3>
              <p className="text-gray-600 mb-2">This student hasn't completed any assigned sessions</p>
              <p className="text-sm text-green-600 font-medium">Sessions will appear here once completed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-green-100 bg-gradient-to-br from-white to-green-50/30 backdrop-blur-sm shadow-xl">
      <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/20 p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">
                {studentName || studentEmail?.split('@')[0] || 'Student'}'s Completed Sessions
              </CardTitle>
              <p className="text-green-100 text-sm mt-1">
                {studentEmail} • {sessions.length} session{sessions.length !== 1 ? 's' : ''} completed
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4">
        <Accordion type="multiple" className="w-full space-y-3">
          {sessions.map((session, index) => {
            const completionData = session.session_plan.completion_data;
            
            return (
              <AccordionItem 
                key={session.id} 
                value={session.id} 
                className="border-2 border-green-100 rounded-xl bg-gradient-to-br from-white to-green-50/20 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline px-6 py-4">
                  <div className="flex items-start gap-4 text-left w-full">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {sessions.length - index}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-gray-900 mb-2 leading-tight">{formatSessionTitle(session.title)}</h4>
                          <div className="flex items-center gap-6 text-sm mb-3">
                            <span className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                              <Calendar className="w-4 h-4" />
                              {formatDate(session.completed_at)}
                            </span>
                            {completionData?.duration_minutes && (
                              <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                <Clock className="w-4 h-4" />
                                {formatDuration(completionData.duration_minutes)}
                              </span>
                            )}
                          </div>
                          {completionData?.summary && (
                            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border-l-4 border-green-400">
                              {completionData.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-4 border-l-4 border-gradient-to-b from-green-400 to-emerald-400 pl-6 bg-gradient-to-br from-green-50/30 to-emerald-50/30 rounded-r-lg">
                    {/* Review Sheet */}
                    {completionData?.review_sheet && Object.keys(completionData.review_sheet).length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <h5 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          Study Review Sheet
                        </h5>
                        <div className="space-y-3">
                          {completionData.review_sheet.summary && (
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <p className="text-sm text-green-800 font-medium mb-2">Summary:</p>
                              <p className="text-sm text-green-700">{completionData.review_sheet.summary}</p>
                            </div>
                          )}
                          
                          {completionData.review_sheet.memorization_facts?.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <p className="text-sm font-medium text-green-700 mb-2">Key Facts Learned:</p>
                              <ScrollArea className="max-h-32">
                                <ul className="text-sm text-green-700 space-y-1">
                                  {completionData.review_sheet.memorization_facts.map((fact: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-green-500 mt-1">•</span>
                                      <span>{fact}</span>
                                    </li>
                                  ))}
                                </ul>
                              </ScrollArea>
                            </div>
                          )}

                          {completionData.review_sheet.major_topics?.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <p className="text-sm font-medium text-green-700 mb-2">Topics Covered:</p>
                              <div className="flex flex-wrap gap-2">
                                {completionData.review_sheet.major_topics.map((topic: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {completionData.review_sheet.weak_areas?.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-orange-200">
                              <p className="text-sm font-medium text-orange-700 mb-2">Areas for Review:</p>
                              <div className="flex flex-wrap gap-2">
                                {completionData.review_sheet.weak_areas.map((area: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                    {area}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quiz Mistakes */}
                    {completionData?.quiz_mistakes?.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3">
                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Quiz Mistakes ({completionData.quiz_mistakes.length})
                        </h5>
                        <ExpandableContent 
                          items={completionData.quiz_mistakes.map((mistake: any) => ({
                            question: mistake.question || '',
                            correct_answer: mistake.correct_answer || mistake.correctAnswer || '',
                            user_answer: mistake.user_answer || mistake.userAnswer || '',
                            explanation: mistake.explanation || ''
                          }))} 
                          type="quiz_mistakes" 
                          maxInitialItems={3} 
                        />
                      </div>
                    )}

                    {/* Flashcards */}
                    {completionData?.flashcards?.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Generated Flashcards ({completionData.flashcards.length})
                        </h5>
                        <ExpandableContent 
                          items={completionData.flashcards} 
                          type="flashcards" 
                          maxInitialItems={2} 
                        />
                      </div>
                    )}

                    {/* Study Phases */}
                    {completionData?.phases_used?.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h5 className="font-medium text-gray-900 mb-2">Study Techniques Used</h5>
                        <div className="flex flex-wrap gap-2">
                          {completionData.phases_used
                            .filter((phase: string) => phase.toLowerCase() !== 'study')
                            .map((phase: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                {phase}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default StudentSessionHistory;