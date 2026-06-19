import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Send, Brain, CheckCircle, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { sendBlurtingContent, BlurtingResponse } from '@/services/studyModeApi';
import { UniversalLoadingScreen } from '@/components/common/loading';
import { updateContext } from '@/services/studyModulesApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import ModeSetup from './ModeSetup';
import BlurtingScoreRing from '../session/BlurtingScoreRing';

interface BlurtingModeProps {
  onExit: () => void;
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  isLastBlock?: boolean;
  onCompleteSession?: () => void;
  onAddBlurtingData?: (feedback: string, missedConcepts: string[]) => void;
  onAddPhaseUsed?: (phase: string) => void;
  preloadedExercises?: Array<{
    prompt: string;
    focus: string;
  }> | null;
  preloadedTeachingContent?: {
    lessons?: any[];
    technique?: string;
    description?: string;
  } | null;
}

const BlurtingMode = ({
  onExit,
  currentBlock,
  isLastBlock = false,
  onCompleteSession,
  onAddBlurtingData,
  onAddPhaseUsed,
  preloadedExercises = null,
  preloadedTeachingContent = null
}: BlurtingModeProps) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'setup' | 'generating' | 'selection' | 'exercises' | 'complete'>('setup');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [responses, setResponses] = useState<string[]>(['', '']);
  const [feedbacks, setFeedbacks] = useState<BlurtingResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exercises, setExercises] = useState<Array<{prompt: string; focus: string}>>([]);
  const [selectedExercise, setSelectedExercise] = useState<{prompt: string; focus: string} | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (phase !== 'setup') {
      setPhase('setup');
      setCurrentExerciseIndex(0);
      setResponses(['', '']);
      setFeedbacks([]);
      setSelectedExercise(null);
    }
  }, [currentBlock?.id]);

  const handleSetupStart = async (topic: string, useCustom: boolean, generatedExercises?: Array<{prompt: string; focus: string}>) => {
    
    setIsProcessing(true);
    setPhase('generating');
    
    if (onAddPhaseUsed) {
      onAddPhaseUsed('blurting');
    }
    
    // Add small delay to show loading screen
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (generatedExercises && generatedExercises.length > 0) {
      setExercises(generatedExercises);
    } else {
      const fallbackExercises = [
        {
          prompt: `Write everything you can remember about: ${topic}`,
          focus: 'General recall'
        },
        {
          prompt: `List all the key concepts, terms, and examples you remember about: ${topic}`,
          focus: 'Detailed concepts'
        },
        {
          prompt: `Explain how ${topic} connects to real-world applications and examples`,
          focus: 'Applications & Examples'
        }
      ];
      setExercises(fallbackExercises);
    }
    
    setIsProcessing(false);
    setPhase('selection');
  };

  const handleExerciseSelect = (exercise: {prompt: string; focus: string}) => {
    setSelectedExercise(exercise);
    setPhase('exercises');
  };

  const handleResponseChange = (value: string) => {
    const newResponses = [...responses];
    newResponses[currentExerciseIndex] = value;
    setResponses(newResponses);
  };

  const getTeachingContent = (): string => {
    if (preloadedTeachingContent?.lessons && preloadedTeachingContent.lessons.length > 0) {
      return preloadedTeachingContent.lessons.map(lesson => {
        if (Array.isArray(lesson.content)) {
          return `${lesson.title}: ${lesson.content.join(' ')}`;
        }
        return `${lesson.title}: ${lesson.content}`;
      }).join('\n\n');
    }
    return currentBlock?.description || 'Study topic';
  };

  const handleSubmitResponse = async () => {
    if (!(responses[0] || '').trim() || !user) return;
    setIsProcessing(true);
    try {

      // Use full teaching content instead of just description
      const teachingContent = getTeachingContent();
      const response = await sendBlurtingContent({
        exercise_question: selectedExercise.prompt,
        blurted_response: responses[0] || '',
        user_id: user.id
      });
      const newFeedbacks = [...feedbacks];
      newFeedbacks[0] = response;
      setFeedbacks(newFeedbacks);

      // Add to session data
      if (onAddBlurtingData) {
        onAddBlurtingData(response.feedback, response.missed || []);
      }

      // Send learning event (non-blocking)
      if (currentBlock && user) {
        try {
          await updateContext({
            source: `user:${user.id}`,
            user_id: user.id,
            current_topic: currentBlock.description,
            learning_event: {
              concept: currentBlock.description,
              phase: 'blurting_analysis',
              confidence: 0.7,
              depth: 'intermediate',
              source_summary: `Brain dump: "${responses[0] || ''}" | AI feedback: "${response.feedback}"`,
              repetition_count: 1,
              review_scheduled: false
            },
            trigger_synthesis: isLastBlock
          });
          toast({
            title: "Response Analyzed",
            description: "Your brain dump has been analyzed by ARLO."
          });
        } catch (error) {
        }
      }
    } catch (error) {
      console.error('Failed to get Blurting analysis:', error);

      // Fallback analysis
      const wordCount = (responses[0] || '').split(/\s+/).length;
      let fallbackFeedback = `You've written ${wordCount} words about ${currentBlock?.description}. `;
      if (wordCount < 50) {
        fallbackFeedback += "Try to expand on your ideas - what are the key concepts, examples, or applications you can think of?";
      } else if (wordCount < 150) {
        fallbackFeedback += "Good start! Consider adding more details about how these concepts connect to each other and real-world examples.";
      } else {
        fallbackFeedback += "Great detail! Now think about organizing these ideas and identifying any gaps in your understanding.";
      }
      const newFeedbacks = [...feedbacks];
      newFeedbacks[0] = {
        mentioned: [],
        partial_mentions: [],
        missed: ['Key concepts', 'Examples', 'Applications'],
        mentioned_count: 0,
        total_key_concepts: 3,
        score_fraction: '0/3',
        feedback: fallbackFeedback
      };
      setFeedbacks(newFeedbacks);
      toast({
        title: "Analysis Complete",
        description: "Using fallback analysis due to connection issues.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryExercise = () => {
    const newResponses = [...responses];
    newResponses[0] = '';
    setResponses(newResponses);
    const newFeedbacks = [...feedbacks];
    newFeedbacks[0] = null;
    setFeedbacks(newFeedbacks);
  };
  
  const currentResponse = responses[0] || '';
  const currentFeedback = feedbacks[0];
  const hasSubmittedCurrent = !!currentFeedback;

  if (phase === 'setup') {
    return (
      <div className="h-full">
        <ModeSetup
          technique="blurting"
          currentBlock={currentBlock}
          onExit={onExit}
          onStart={handleSetupStart}
          isLoading={isProcessing}
        />
      </div>
    );
  }

  // Show loading screen when generating exercises
  if (isProcessing && phase === 'generating') {
    return (
      <UniversalLoadingScreen
        technique="blurting"
        title="Preparing recall session..."
        subtitle="Generating personalized brain dump exercises for your topic"
        showMessages={true}
      />
    );
  }


  // Exercise selection screen with enhanced design
  if (phase === 'selection' && exercises.length > 0) {
    return (
      <div className="h-full flex flex-col max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-gray-100 p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={onExit} className="hover:bg-white/80">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Choose Your Exercise
            </h2>
            <p className="text-slate-600 mt-1">Select the brain dump exercise that best fits your learning goals</p>
          </div>
        </div>

        <div className="grid gap-6 flex-1">
          {exercises.map((exercise, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-0 bg-white/80 backdrop-blur-sm group"
              onClick={() => handleExerciseSelect(exercise)}
            >
              <CardContent className="p-8">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center font-bold text-lg shadow-lg group-hover:shadow-xl transition-shadow flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 font-medium text-lg mb-4 leading-relaxed">{exercise.prompt}</p>
                    <Badge className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 border-orange-200 hover:bg-orange-200 transition-colors">
                      <Brain className="w-3 h-3 mr-1" />
                      {exercise.focus}
                    </Badge>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'exercises') {
    if (!selectedExercise) {
      return (
        <div className="h-full flex flex-col max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold text-slate-900">Loading Exercise...</h2>
          </div>
          <Card className="flex-1 bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6 text-center">
              <p className="text-slate-600">Setting up your exercise...</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-gray-100 p-6">
        {/* Enhanced Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setPhase('selection')} className="hover:bg-white/80">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Brain Dump Exercise
            </h2>
            <p className="text-slate-600 mt-1">Pour out everything you know about the topic</p>
          </div>
        </div>

        {/* Exercise Prompt Card */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-medium text-lg mb-3 leading-relaxed">{selectedExercise.prompt}</p>
                <Badge className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 border-orange-200">
                  <Brain className="w-3 h-3 mr-1" />
                  {selectedExercise.focus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <Card className="flex-1 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6 h-full">
            {!hasSubmittedCurrent ? (
              /* Enhanced Input Mode */
              <div className="space-y-6 h-full flex flex-col">
                <div className="flex-1">
                  <Textarea 
                    value={currentResponse} 
                    onChange={e => {
                      const newResponses = [...responses];
                      newResponses[0] = e.target.value;
                      setResponses(newResponses);
                    }} 
                    placeholder="Write everything you remember about this topic... Don't worry about organization or perfection - just let your thoughts flow!" 
                    className="resize-none text-base leading-relaxed h-full border-slate-200 focus:border-orange-400 focus:ring-orange-400/20 bg-slate-50/50" 
                    disabled={isProcessing} 
                  />
                </div>
                
                <div className="flex justify-between items-center bg-slate-50/80 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-slate-600 border-slate-300 bg-white/80">
                      {currentResponse.split(/\s+/).filter(word => word.length > 0).length} words
                    </Badge>
                    {currentResponse.length > 0 && (
                      <Badge variant="outline" className="text-slate-600 border-slate-300 bg-white/80">
                        {currentResponse.length} characters
                      </Badge>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleSubmitResponse} 
                    disabled={!currentResponse.trim() || isProcessing} 
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all px-8"
                    size="lg"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {isProcessing ? 'Analyzing...' : 'Submit Response'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Enhanced Feedback Mode with Original Ring */
              <div className="space-y-8 h-full flex flex-col">
                <div className="flex-grow overflow-auto">
                  <BlurtingScoreRing
                    scoreFraction={currentFeedback.score_fraction}
                    feedback={currentFeedback.feedback}
                    mentioned={currentFeedback.mentioned}
                    partialMentions={currentFeedback.partial_mentions}
                    missed={currentFeedback.missed}
                  />
                </div>

                {/* Enhanced Action Bar */}
                <div className="flex justify-between items-center bg-slate-50/80 rounded-xl p-4 mt-auto">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleRetryExercise} 
                      className="flex items-center gap-2 hover:bg-white border-slate-300"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Again
                    </Button>
                    
                    <Button 
                      onClick={() => setPhase('selection')} 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Switch Exercises
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Enhanced Complete phase
  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={onExit} className="hover:bg-white/80">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Session Complete
          </h2>
          <p className="text-slate-600 mt-1">Excellent work on your brain dump exercise!</p>
        </div>
      </div>

      <Card className="flex-1 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="pt-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-slate-900 mb-4">
            Excellent Memory Work!
          </h3>
          <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
            You've completed your brain dump exercise for <strong className="text-slate-900">{currentBlock?.description}</strong>.
            ARLO has analyzed your response and identified areas for review.
          </p>
          
          <Button 
            onClick={onExit} 
            className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-12 py-4 text-lg shadow-lg hover:shadow-xl transition-all" 
            size="lg"
          >
            Finish Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlurtingMode;