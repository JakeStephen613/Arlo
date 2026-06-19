import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, Clock, BookOpen, Brain, FileText, AlertCircle, TrendingUp, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSessionHistory, SessionHistoryItem } from '@/services/sessionApi';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ExpandableContent from '@/components/session/ExpandableContent';
const SessionHistory = () => {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  useEffect(() => {
    const loadSessionHistory = async () => {
      if (!user?.id) return;
      try {
        const history = await fetchSessionHistory(user.id);
        setSessions(history.slice(0, 10)); // Show only 10 most recent
      } catch (error) {
        console.error('Failed to load session history:', error);
        toast({
          title: "Failed to load history",
          description: "Unable to fetch your session history. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    loadSessionHistory();
  }, [user?.id, toast]);
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Filter out generic "study" phases
  const filterPhases = (phases: string[]) => {
    return phases.filter(phase => phase.toLowerCase() !== 'study');
  };
  if (loading) {
    return <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">Recent Study Sessions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200"></div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent absolute top-0"></div>
            </div>
            <p className="text-indigo-600 font-medium">Loading your study journey...</p>
          </div>
        </CardContent>
      </Card>;
  }
  if (sessions.length === 0) {
    return <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">Recent Study Sessions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-800" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to Begin Your Journey?</h3>
              <p className="text-gray-600 mb-2">No study sessions yet</p>
              <p className="text-sm text-indigo-600 font-medium">Start your first study session to see your progress here</p>
            </div>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 backdrop-blur-sm shadow-xl">
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold">Recent Study Sessions</span>
              
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="text-white hover:bg-white/20 border border-white/30 rounded-lg px-4 py-2 transition-all duration-200">
            {isExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && <CardContent className="p-6 space-y-4">
          <Accordion type="multiple" className="w-full space-y-3">
            {sessions.map((session, index) => <AccordionItem key={session.id} value={session.id} className="border-2 border-indigo-100 rounded-xl bg-gradient-to-br from-white to-indigo-50/20 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
                <AccordionTrigger className="hover:no-underline px-6 py-4">
                  <div className="flex items-start gap-4 text-left w-full">
                    {/* Session Number Badge */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {sessions.length - index}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-gray-900 mb-2 leading-tight">{session.topic}</h4>
                          <div className="flex items-center gap-6 text-sm mb-3">
                            <span className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                              <Calendar className="w-4 h-4" />
                              {formatDate(session.timestamp)}
                            </span>
                            <span className="flex items-center gap-2 text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                              <Clock className="w-4 h-4" />
                              {formatDuration(session.duration)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border-l-4 border-indigo-400">{session.summary}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-4 border-l-4 border-gradient-to-b from-indigo-400 to-purple-400 pl-6 bg-gradient-to-br from-indigo-50/30 to-purple-50/30 rounded-r-lg">{/* ... keep existing code ... */}
                    {/* Bedtime Review Sheet */}
                    {session.review_sheet && Object.keys(session.review_sheet).length > 0 && <div className="bg-indigo-50 rounded-lg p-4">
                        <h5 className="font-medium text-indigo-900 mb-3 flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          Bedtime Review Sheet
                        </h5>
                        <div className="space-y-3">
                          {session.review_sheet.summary && <div className="bg-white rounded-lg p-3 border border-indigo-200">
                              <p className="text-sm text-indigo-800 font-medium mb-2">Summary:</p>
                              <p className="text-sm text-indigo-700">{session.review_sheet.summary}</p>
                            </div>}
                          
                          {session.review_sheet.memorization_facts?.length > 0 && <div className="bg-white rounded-lg p-3 border border-indigo-200">
                              <p className="text-sm font-medium text-indigo-700 mb-2">Key Facts to Remember:</p>
                              <ScrollArea className="max-h-32">
                                <ul className="text-sm text-indigo-700 space-y-1">
                                  {session.review_sheet.memorization_facts.map((fact, idx) => <li key={idx} className="flex items-start gap-2">
                                      <span className="text-indigo-500 mt-1">•</span>
                                      <span>{fact}</span>
                                    </li>)}
                                </ul>
                              </ScrollArea>
                            </div>}

                          {session.review_sheet.major_topics?.length > 0 && <div className="bg-white rounded-lg p-3 border border-indigo-200">
                              <p className="text-sm font-medium text-indigo-700 mb-2">Major Topics Covered:</p>
                              <div className="flex flex-wrap gap-2">
                                {session.review_sheet.major_topics.map((topic, idx) => <Badge key={idx} variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-300">
                                    {topic}
                                  </Badge>)}
                              </div>
                            </div>}

                          {session.review_sheet.weak_areas?.length > 0 && <div className="bg-white rounded-lg p-3 border border-orange-200">
                              <p className="text-sm font-medium text-orange-700 mb-2">Areas to Review Further:</p>
                              <div className="flex flex-wrap gap-2">
                                {session.review_sheet.weak_areas.map((area, idx) => <Badge key={idx} variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                    {area}
                                  </Badge>)}
                              </div>
                            </div>}

                          {session.review_sheet.key_concepts?.length > 0 && <div className="bg-white rounded-lg p-3 border border-indigo-200">
                              <p className="text-sm font-medium text-indigo-700 mb-2">Key Concepts:</p>
                              <ScrollArea className="max-h-32">
                                <ul className="text-sm text-indigo-700 space-y-1">
                                  {session.review_sheet.key_concepts.map((concept, idx) => <li key={idx} className="flex items-start gap-2">
                                      <span className="text-indigo-500 mt-1">•</span>
                                      <span>{concept}</span>
                                    </li>)}
                                </ul>
                              </ScrollArea>
                            </div>}
                        </div>
                      </div>}

                    {/* Quiz Mistakes */}
                    {session.quiz_mistakes?.length > 0 && <div className="bg-red-50 rounded-lg p-3">
                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Quiz Mistakes ({session.quiz_mistakes.length})
                        </h5>
                        <ExpandableContent items={session.quiz_mistakes.map(mistake => {
                  // Helper function to safely convert any value to string
                  const safeStringify = (value: any): string => {
                    if (value === null || value === undefined) {
                      return '';
                    }
                    if (typeof value === 'string') {
                      return value;
                    }
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
                })} type="quiz_mistakes" maxInitialItems={3} />
                      </div>}

                    {/* Flashcards */}
                    {session.flashcards?.length > 0 && <div className="bg-blue-50 rounded-lg p-3">
                        <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Generated Flashcards ({session.flashcards.length})
                        </h5>
                        <ExpandableContent items={session.flashcards} type="flashcards" maxInitialItems={2} />
                      </div>}

                    {/* Study Phases - only show if there are filtered phases */}
                    {filterPhases(session.phases_used).length > 0 && <div className="bg-gray-50 rounded-lg p-3">
                        <h5 className="font-medium text-gray-900 mb-2">Study Phases</h5>
                        <div className="flex flex-wrap gap-2">
                          {filterPhases(session.phases_used).map((phase, idx) => <span key={idx} className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                              {phase}
                            </span>)}
                        </div>
                      </div>}

                    {/* Notes */}
                    {session.notes && <div className="bg-yellow-50 rounded-lg p-3">
                        <h5 className="font-medium text-yellow-900 mb-2">Notes</h5>
                        <p className="text-sm text-yellow-800">{session.notes}</p>
                      </div>}
                  </div>
                </AccordionContent>
              </AccordionItem>)}
          </Accordion>
        </CardContent>}
    </Card>;
};
export default SessionHistory;