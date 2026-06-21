
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, Home, Loader2, Check, AlertCircle, Brain, BookOpen, Trophy, Star, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateBedtimeReviewSheet, saveSession, resetContext } from '@/services/sessionApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SessionCompleteProps {
  onEndSession: () => void;
  sessionData?: {
    topic: string;
    duration: number;
    phases_used: string[];
    feynman?: {
      feedback: string;
      follow_up_question?: string;
    };
    blurting?: {
      feedback: string;
      missed_concepts: string[];
    };
    flashcards?: any[];
    quiz?: {
      incorrect_questions: any[];
    };
  };
}

interface CompletionStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
}

const SessionComplete = ({ onEndSession, sessionData }: SessionCompleteProps) => {
  const [steps, setSteps] = useState<CompletionStep[]>([
    { id: 'bedtime-review', label: 'Generating personalized review sheet', status: 'pending' },
    { id: 'save-session', label: 'Saving your progress', status: 'pending' },
    { id: 'reset-context', label: 'Preparing for next session', status: 'pending' }
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [reviewSheetData, setReviewSheetData] = useState<any>(null);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const { toast } = useToast();

  const updateStepStatus = (stepId: string, status: CompletionStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  };

  const executeStep = async (stepIndex: number) => {
    if (stepIndex >= steps.length) {
      setIsComplete(true);
      return;
    }

    const step = steps[stepIndex];
    updateStepStatus(step.id, 'loading');

    try {
      // Get fresh auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get authentication session');
      }

      if (!session?.user) {
        throw new Error('No authenticated user found. Please sign in again.');
      }

      const userId = session.user.id;

      // Validate user ID format
      if (!userId || userId === "00000000-0000-0000-0000-000000000000") {
        throw new Error('Invalid user session - please sign out and sign in again');
      }

      switch (step.id) {
        case 'bedtime-review':
          await generateBedtimeReviewStep(userId);
          break;
        case 'save-session':
          await saveSessionStep(userId);
          break;
        case 'reset-context':
          await resetContextStep(userId);
          break;
      }

      updateStepStatus(step.id, 'success');
      
      setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error(`Failed to execute step ${step.id}:`, error);
      updateStepStatus(step.id, 'error', error instanceof Error ? error.message : 'Unknown error');
      
      // Continue to next step even if one fails
      setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, 2000);
    }
  };

  const generateBedtimeReviewStep = async (userId: string) => {
    
    try {
      const data = await generateBedtimeReviewSheet(userId);
      
      // Check if the review sheet has sufficient content
      const hasContent = data && (
        (data.summary && data.summary.trim().length > 20) ||
        (data.memorization_facts && data.memorization_facts.length > 0) ||
        (data.major_topics && data.major_topics.length > 0) ||
        (data.weak_areas && data.weak_areas.length > 0)
      );
      
      if (!hasContent) {
        // Set a message indicating insufficient content
        setReviewSheetData({
          summary: "Error generating spreadsheet, not enough session context",
          memorization_facts: [],
          major_topics: [],
          weak_areas: [],
          insufficient_content: true
        });
        
        toast({
          title: "Review sheet generation failed",
          description: "Error generating spreadsheet, not enough session context",
          variant: "destructive",
        });
      } else {
        setReviewSheetData(data);
        
        toast({
          title: "Bedtime review sheet generated!",
          description: "Your personalized review sheet is ready for tonight's review",
        });
      }
    } catch (error) {
      console.error('Failed to generate bedtime review sheet:', error);
      
      // Set fallback content
      setReviewSheetData({
        summary: "Error generating spreadsheet, not enough session context",
        memorization_facts: [],
        major_topics: [],
        weak_areas: [],
        insufficient_content: true
      });
      
      toast({
        title: "Review sheet generation failed",
        description: "Error generating spreadsheet, not enough session context",
        variant: "destructive",
      });
    }
  };

  const saveSessionStep = async (userId: string) => {
    
    try {
      // Prepare complete session data including all components
      const completeSessionData = {
        user_id: userId,
        timestamp: new Date().toISOString(),
        topic: sessionData?.topic || 'Study Session',
        duration: sessionData?.duration || 0,
        summary: `Completed study session on ${sessionData?.topic || 'general topics'} using ${sessionData?.phases_used?.join(', ') || 'various techniques'}`,
        phases_used: sessionData?.phases_used || [],
        
        // Bedtime review sheet
        review_sheet: reviewSheetData,
        
        // Quiz data with detailed mistake information
        quiz_mistakes: sessionData?.quiz?.incorrect_questions?.map(q => {
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
            question: safeStringify(q.question) || 'Question text not available',
            user_answer: safeStringify(q.user_answer || q.selected_answer) || 'No answer recorded',
            correct_answer: safeStringify(q.correct_answer) || 'Correct answer not available',
            explanation: safeStringify(q.explanation) || 'No explanation available'
          };
        }) || [],
        
        // Flashcards with front/back content
        flashcards: sessionData?.flashcards?.map(card => ({
          id: card.id || Math.random().toString(),
          front: card.front || 'Front content not available',
          back: card.back || 'Back content not available',
          difficulty: card.difficulty || 'medium',
          category: card.category || sessionData.topic
        })) || [],
        
        // Feynman technique data
        feynman_feedback: sessionData?.feynman?.feedback || null,
        feynman_follow_up: sessionData?.feynman?.follow_up_question || null,
        
        // Blurting method data
        blurting_feedback: sessionData?.blurting?.feedback || null,
        blurting_missed_concepts: sessionData?.blurting?.missed_concepts || [],
        
        // Additional notes field for any extra session info
        notes: `Session completed with ${sessionData?.phases_used?.length || 0} different study techniques`
      };


      await saveSession(completeSessionData);

      // Show detailed success message based on what was saved
      const savedComponents = [];
      if (reviewSheetData) savedComponents.push('bedtime review sheet');
      if (sessionData?.quiz?.incorrect_questions?.length) savedComponents.push(`${sessionData.quiz.incorrect_questions.length} quiz mistakes`);
      if (sessionData?.flashcards?.length) savedComponents.push(`${sessionData.flashcards.length} flashcards`);
      if (sessionData?.feynman?.feedback) savedComponents.push('Feynman explanation');
      if (sessionData?.blurting?.feedback) savedComponents.push('blurting exercise');

      toast({
        title: "Complete session saved!",
        description: `Saved: ${savedComponents.join(', ')} to your history`,
      });
    } catch (error) {
      console.error('Failed to save session:', error);
      toast({
        title: "Session save failed",
        description: "Unable to save session data. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const resetContextStep = async (userId: string) => {
    
    try {
      await resetContext(userId);
      
      toast({
        title: "Memory reset complete!",
        description: "Study context cleared - ready for your next session",
      });
    } catch (error) {
      console.error('Context reset failed:', error);
      
      toast({
        title: "Context reset failed",
        description: "Please try starting a new session manually if needed",
        variant: "destructive",
      });
      
      throw error;
    }
  };

  // Auto-start the completion flow when component mounts
  useEffect(() => {
    
    if (currentStepIndex < steps.length) {
      executeStep(currentStepIndex);
    } else if (currentStepIndex >= steps.length && !isComplete) {
      setIsComplete(true);
    }
  }, [currentStepIndex]);


  const handleViewReviewSheet = () => {
    setShowReviewSheet(true);
  };

  const getStepIcon = (step: CompletionStep) => {
    switch (step.status) {
      case 'loading':
        return <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />;
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getSessionStats = () => {
    const stats = [];
    if (sessionData?.quiz?.incorrect_questions?.length) {
      stats.push({ icon: Trophy, label: 'Quiz Completed', value: `${sessionData.quiz.incorrect_questions.length} mistakes reviewed` });
    }
    if (sessionData?.flashcards?.length) {
      stats.push({ icon: BookOpen, label: 'Flashcards', value: `${sessionData.flashcards.length} cards studied` });
    }
    if (sessionData?.feynman?.feedback) {
      stats.push({ icon: Brain, label: 'Feynman Method', value: 'Explanation completed' });
    }
    if (sessionData?.blurting?.feedback) {
      stats.push({ icon: Sparkles, label: 'Blurting Exercise', value: 'Recall practice done' });
    }
    if (sessionData?.phases_used?.length) {
      stats.push({ icon: Star, label: 'Techniques Used', value: `${sessionData.phases_used.length} study methods` });
    }
    return stats;
  };

  if (showReviewSheet && reviewSheetData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-4xl border-2 shadow-2xl bg-white">
          <CardHeader className="text-center pb-6 bg-indigo-500 text-white rounded-t-lg">
            <div className="mx-auto mb-4">
              <Brain className="w-16 h-16 mx-auto opacity-90" />
            </div>
            <CardTitle className="text-3xl font-bold mb-2">
              🌙 Bedtime Review Sheet
            </CardTitle>
            <p className="text-xl opacity-90">
              {reviewSheetData.insufficient_content 
                ? "Study more to generate comprehensive reviews"
                : "Review these key points before you sleep for better retention"
              }
            </p>
          </CardHeader>
          
          <CardContent className="pt-6">
            <ScrollArea className="h-[500px] w-full rounded-md border p-6">
              {reviewSheetData.insufficient_content ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Not Enough Material
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    {reviewSheetData.summary}
                  </p>
                  <p className="text-sm text-gray-500 mt-4">
                    Try spending more time studying or using multiple techniques to generate more comprehensive review materials.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  {reviewSheetData.summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Session Summary
                      </h3>
                      <p className="text-blue-800 leading-relaxed">{reviewSheetData.summary}</p>
                    </div>
                  )}

                  {/* Key Facts to Memorize */}
                  {reviewSheetData.memorization_facts && reviewSheetData.memorization_facts.length > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                      <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Key Facts to Memorize
                      </h3>
                      <ul className="space-y-3">
                        {reviewSheetData.memorization_facts.map((fact: string, index: number) => (
                          <li key={index} className="text-green-800 flex items-start gap-3 p-3 bg-white/50 rounded-lg">
                            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                              {index + 1}
                            </div>
                            <span className="leading-relaxed">{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Major Topics */}
                  {reviewSheetData.major_topics && reviewSheetData.major_topics.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                      <h3 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5" />
                        Major Topics Covered
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {reviewSheetData.major_topics.map((topic: string, index: number) => (
                          <Badge key={index} className="bg-purple-100 text-purple-800 border-purple-300 px-4 py-2 text-sm">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weak Areas */}
                  {reviewSheetData.weak_areas && reviewSheetData.weak_areas.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                      <h3 className="font-semibold text-orange-900 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Areas for Review
                      </h3>
                      <ul className="space-y-3">
                        {reviewSheetData.weak_areas.map((area: string, index: number) => (
                          <li key={index} className="text-orange-800 flex items-start gap-3 p-3 bg-white/50 rounded-lg">
                            <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                              !
                            </div>
                            <span className="leading-relaxed">{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Explanations */}
                  {reviewSheetData.explanations && reviewSheetData.explanations.length > 0 && (
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Key Explanations
                      </h3>
                      <div className="space-y-4">
                        {reviewSheetData.explanations.map((explanation: string, index: number) => (
                          <div key={index} className="text-gray-700 p-4 bg-white rounded-lg border-l-4 border-indigo-400 shadow-sm">
                            {explanation}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="mt-6 flex gap-4 justify-center">
              <Button
                onClick={() => setShowReviewSheet(false)}
                variant="outline"
                className="px-8 py-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                Back to Summary
              </Button>
              <Button
                onClick={onEndSession}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-3 shadow-lg"
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-3xl border-2 shadow-2xl bg-white overflow-hidden">
        <CardHeader className="text-center pb-6 bg-indigo-500 text-white">
          <div className="mx-auto mb-4 relative">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-yellow-800" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold mb-3">
            🎉 Amazing Work!
          </CardTitle>
          <p className="text-xl opacity-90">
            Your study session is complete
          </p>
        </CardHeader>
        
        <CardContent className="pt-8">
          {/* Session Statistics */}
          {sessionData && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Session Highlights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getSessionStats().map((stat, index) => (
                  <div key={index} className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{stat.label}</div>
                        <div className="text-sm text-gray-600">{stat.value}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Steps */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 text-center">Finalizing Your Session</h3>
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border">
                <div className="flex-shrink-0">
                  {getStepIcon(step)}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    step.status === 'success' ? 'text-green-700' :
                    step.status === 'error' ? 'text-red-700' :
                    step.status === 'loading' ? 'text-indigo-700' : 'text-gray-700'
                  }`}>
                    {step.label}
                  </p>
                  {step.message && (
                    <p className="text-sm text-gray-600 mt-1">{step.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Success notifications */}
          {isComplete && (
            <div className="space-y-3 mb-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">Bedtime review sheet saved to session history</p>
                </div>
              </div>
              {sessionData?.quiz?.incorrect_questions && sessionData.quiz.incorrect_questions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-blue-600" />
                    <p className="text-sm text-blue-800 font-medium">Quiz mistakes saved ({sessionData.quiz.incorrect_questions.length} questions)</p>
                  </div>
                </div>
              )}
              {sessionData?.flashcards && sessionData.flashcards.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <p className="text-sm text-purple-800 font-medium">Flashcards saved ({sessionData.flashcards.length} cards)</p>
                  </div>
                </div>
              )}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <p className="text-sm text-indigo-800 font-medium">Ready for your next learning adventure!</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isComplete && (
            <div className="space-y-4">
              <Button
                onClick={handleViewReviewSheet}
                variant="outline"
                className="w-full py-4 text-lg flex items-center justify-center gap-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                disabled={!reviewSheetData}
              >
                <FileText className="w-6 h-6" />
                View Bedtime Review Sheet
              </Button>
              
              <Button
                onClick={onEndSession}
                className="w-full py-4 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white flex items-center justify-center gap-3 shadow-lg"
              >
                <Home className="w-6 h-6" />
                Back to Dashboard
              </Button>
            </div>
          )}
          
          {/* Information Panel */}
          <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              What We've Accomplished
            </h4>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                Your personalized review sheet has been generated and saved
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                All study materials stored for future review
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                Session progress saved to your personal history
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                Study context optimized for your next session
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionComplete;
