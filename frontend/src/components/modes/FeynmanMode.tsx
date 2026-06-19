import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Send, ChevronLeft, ChevronRight, Brain, CheckCircle, AlertTriangle } from 'lucide-react';
import { UniversalLoadingScreen } from '@/components/common/loading';
import { updateContext } from '@/services/studyModulesApi';
import { generateFeynmanExercises, assessFeynmanExplanation, FeynmanExercise } from '@/services/studyModeApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import FeedbackCard from './feynman/FeedbackCard';
import ModeSetup from './ModeSetup';

interface FeynmanModeProps {
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
  onAddFeynmanData?: (feedback: string, followUp?: string) => void;
  onAddPhaseUsed?: (phase: string) => void;
  preloadedExercises?: string[] | null;
  preloadedTeachingContent?: {
    lessons?: any[];
    technique?: string;
    description?: string;
  } | null;
}

const FeynmanMode = ({
  onExit,
  currentBlock,
  isLastBlock = false,
  onCompleteSession,
  onAddFeynmanData,
  onAddPhaseUsed,
  preloadedExercises = null,
  preloadedTeachingContent = null
}: FeynmanModeProps) => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<string[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [currentExplanation, setCurrentExplanation] = useState('');
  const [currentFeedback, setCurrentFeedback] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [showSetup, setShowSetup] = useState(true);
  const [showQuestionSelection, setShowQuestionSelection] = useState(false);
  const { toast } = useToast();

  const handleSetupStart = async (topic: string, useCustom: boolean) => {
    setShowSetup(false);
    setIsProcessing(true);  // Show loading screen during exercise generation
    
    // Generate exercises via API call
    try {
      
      const response = await generateFeynmanExercises({
        teaching_content: getTeachingContent(),
        user_id: user?.id,
        difficulty_level: 'intermediate'
      });
      
      
      if (response && response.questions && response.questions.length >= 3) {
        setExercises(response.questions);
        setIsProcessing(false);  // Hide loading screen
        setShowQuestionSelection(true);
      } else {
        throw new Error('Invalid exercise response format');
      }
    } catch (error) {
      console.error('❌ Failed to generate Feynman exercises:', error);
      
      // Fallback questions
      const fallbackQuestions = [
        `Explain ${topic} as if you're teaching it to a 12-year-old. Use simple language and everyday examples.`,
        `Describe the most important concepts of ${topic} and how they connect to each other.`,
        `What would happen if ${topic} didn't exist? How would things be different?`
      ];
      setExercises(fallbackQuestions);
      setIsProcessing(false);  // Hide loading screen
      setShowQuestionSelection(true);
    }
    
    if (onAddPhaseUsed) {
      onAddPhaseUsed('feynman');
    }
  };

  const handleQuestionSelect = (question: string) => {
    setSelectedQuestion(question);
    setShowQuestionSelection(false);
    setShowInput(true);
  };

  // Send context update when component mounts (non-blocking)
  useEffect(() => {
    const sendInitialContext = async () => {
      if (!currentBlock || !user) return;
      try {
        await updateContext({
          source: `user:${user.id}`,
          user_id: user.id,
          current_topic: currentBlock.unit,
          concept: currentBlock.description,
          phase: currentBlock.technique,
          duration: currentBlock.duration,
          timestamp: new Date().toISOString(),
          block_id: currentBlock.id,
          component_mounted: true
        });
      } catch (error) {
      }
    };
    sendInitialContext();
  }, [currentBlock, user]);

  // Helper function to get teaching content as string
  const getTeachingContent = (): string => {
    if (preloadedTeachingContent?.lessons && preloadedTeachingContent.lessons.length > 0) {
      return preloadedTeachingContent.lessons.map(lesson => {
        if (Array.isArray(lesson.content)) {
          return `${lesson.title}: ${lesson.content.join(' ')}`;
        }
        return `${lesson.title}: ${lesson.content}`;
      }).join('\n\n');
    }
    return currentBlock?.description || '';
  };

  // Parse Feynman response with ** ** markers
  const parseFeynmanResponse = (response: any) => {
    const message = response.message || '';

    // Extract mastery score
    const masteryMatch = message.match(/\*\*Mastery Score\*\*:\s*(\d+)/i);
    const masteryScore = masteryMatch ? parseInt(masteryMatch[1]) : response.concept_mastery_score || 0;

    // Extract sections using ** ** markers
    const sections = {
      immediate_affirmation: extractSection(message, 'Immediate Affirmation'),
      gap_analysis: extractSection(message, 'Gap Analysis'),
      conceptual_clarification: extractSection(message, 'Conceptual Clarification'),
      mastery_check: extractSection(message, 'Mastery Check'),
      follow_up_question: response.follow_up_question || extractSection(message, 'Mastery Check')
    };

    // Parse strengths and gaps from gap analysis
    const strengths = [];
    const keyGaps = [];
    if (sections.immediate_affirmation) {
      strengths.push(sections.immediate_affirmation);
    }
    if (sections.gap_analysis) {
      // Split gap analysis into individual points
      const gapLines = sections.gap_analysis.split(/\d+\./).filter(line => line.trim());
      keyGaps.push(...gapLines.map(line => line.trim()));
    }
    return {
      message: sections.conceptual_clarification || message,
      concept_mastery_score: masteryScore,
      strengths: strengths.length > 0 ? strengths : response.strengths || [],
      key_gaps: keyGaps.length > 0 ? keyGaps : response.key_gaps || [],
      follow_up_question: sections.mastery_check || response.follow_up_question,
      action_suggestion: response.action_suggestion || 'stay_in_phase',
      raw_sections: sections
    };
  };

  // Helper function to extract content between ** ** markers
  const extractSection = (text: string, sectionName: string): string => {
    const regex = new RegExp(`\\*\\*${sectionName}\\*\\*:?\\s*([^*]+?)(?=\\*\\*|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const submitExplanation = async () => {
    if (!currentExplanation.trim() || isProcessing || !user || !selectedQuestion) return;
    setIsProcessing(true);
    const userMessage = currentExplanation.trim();
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    
    try {

      // Use new assessment API
      const assessmentResponse = await assessFeynmanExplanation({
        question: selectedQuestion,
        user_explanation: userMessage,
        user_id: user.id
      });


      // Format response for display
      const formattedFeedback = {
        mastery_score: assessmentResponse.mastery_score,
        what_went_well: assessmentResponse.what_went_well,
        gaps_in_understanding: assessmentResponse.gaps_in_understanding,
        question: selectedQuestion,
        user_explanation: userMessage
      };

      setCurrentFeedback(formattedFeedback);
      setShowInput(false);
      setCurrentExplanation('');

      // Send learning event (non-blocking)
      if (currentBlock && user) {
        try {
          await updateContext({
            source: `user:${user.id}`,
            user_id: user.id,
            current_topic: currentBlock.unit,
            learning_event: {
              concept: currentBlock.description,
              phase: 'feynman',
              confidence: assessmentResponse.mastery_score / 100,
              depth: 'deep',
              source_summary: `Feynman explanation: "${userMessage}" | Mastery: ${assessmentResponse.mastery_score}%`,
              repetition_count: newAttempts,
              review_scheduled: false
            },
            trigger_synthesis: isLastBlock
          });
        } catch (error) {
        }
      }

      // Add to session data
      if (onAddFeynmanData) {
        onAddFeynmanData(`Mastery: ${assessmentResponse.mastery_score}% - ${assessmentResponse.what_went_well.join(', ')}`, selectedQuestion);
      }
    } catch (error) {
      console.error('Failed to assess Feynman explanation:', error);

      // Fallback feedback
      const fallbackFeedback = {
        mastery_score: 50,
        what_went_well: ["You engaged with the concept"],
        gaps_in_understanding: ["Could use more detail and examples"],
        question: selectedQuestion,
        user_explanation: userMessage
      };
      setCurrentFeedback(fallbackFeedback);
      setShowInput(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTryAgain = () => {
    setCurrentFeedback(null);
    setCurrentExplanation('');
    setShowInput(true);
  };

  const handleSelectNewQuestion = () => {
    setCurrentFeedback(null);
    setSelectedQuestion('');
    setCurrentExplanation('');
    setShowQuestionSelection(true);
    setShowInput(false);
  };

  const handleExit = async () => {
    // Send context update when exiting (non-blocking)
    if (currentBlock && user) {
      try {
        await updateContext({
          source: `user:${user.id}`,
          user_id: user.id,
          current_topic: currentBlock.unit,
          learning_event: {
            concept: currentBlock.description,
            phase: 'feynman_completed',
            confidence: 0.7,
            depth: 'deep',
            source_summary: `Feynman technique session completed for ${currentBlock.description}. Attempts: ${attempts}.`,
            repetition_count: attempts,
            review_scheduled: false
          },
          trigger_synthesis: isLastBlock
        });
      } catch (error) {
      }
    }
    onExit();
  };

  const handleComplete = () => {
    if (isLastBlock && onCompleteSession) {
      onCompleteSession();
    } else {
      onExit();
    }
  };

  if (showSetup) {
    return (
      <div className="h-full">
        <ModeSetup
          technique="feynman"
          currentBlock={currentBlock}
          onExit={onExit}
          onStart={handleSetupStart}
          isLoading={false}
        />
      </div>
    );
  }

  // Show loading screen only while generating exercises (not during analysis)
  if (isProcessing && !showSetup && !showQuestionSelection && !currentFeedback && !selectedQuestion) {
    return (
      <UniversalLoadingScreen 
        technique="feynman" 
        title="Setting up explanation mode..."
        subtitle="Generating Feynman questions for your topic"
      />
    );
  }

  // Show question selection screen with enhanced design matching BlurtingMode
  if (showQuestionSelection && exercises.length > 0) {
    return (
      <div className="h-full flex flex-col max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-gray-100 p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={handleExit} className="hover:bg-white/80">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Choose Your Question
            </h2>
            <p className="text-slate-600 mt-1">Select the Feynman question that best fits your learning goals</p>
          </div>
        </div>

        <div className="grid gap-6 flex-1">
          {exercises.map((question, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-0 bg-white/80 backdrop-blur-sm group"
              onClick={() => handleQuestionSelect(question)}
            >
              <CardContent className="p-8">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg shadow-lg group-hover:shadow-xl transition-shadow flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 font-medium text-lg mb-4 leading-relaxed">{question}</p>
                    <Badge className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 transition-colors">
                      <Brain className="w-3 h-3 mr-1" />
                      Teaching Exercise
                    </Badge>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Don't render if no exercises are available
  if (!exercises || exercises.length === 0) {
    return (
      <div className="h-full flex flex-col max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={handleExit}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Feynman Technique</h2>
        </div>
        <Card className="flex-1 flex items-center justify-center">
          <CardContent>
            <p className="text-gray-600">Loading exercises...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={handleExit}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">Feynman Technique</h2>
      </div>

      <div className="flex flex-col space-y-6 flex-1">
        {/* Selected Question Display */}
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-indigo-900">
                Your Selected Question
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleSelectNewQuestion}>
                Change Question
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white/60 rounded-lg p-4">
              <p className="text-gray-800 mb-3 font-medium">
                {selectedQuestion}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Processing state */}
        {isProcessing && (
          <div>
            <FeedbackCard isProcessing={true} />
          </div>
        )}

        {/* Feedback Display */}
        {currentFeedback && !isProcessing && (
          <div className="space-y-4">
            {/* Mastery Score */}
            <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-indigo-900">Mastery Score</span>
                  <span className="text-2xl font-bold text-indigo-600">{currentFeedback.mastery_score || 0}%</span>
                </div>
                <div className="w-full bg-indigo-200 rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all duration-1000 ease-out ${
                    (currentFeedback.mastery_score || 0) >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    (currentFeedback.mastery_score || 0) >= 51 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    'bg-gradient-to-r from-red-500 to-pink-500'
                  }`} style={{
                    width: `${Math.min(100, Math.max(0, currentFeedback.mastery_score || 0))}%`
                  }} />
                </div>
              </CardContent>
            </Card>

            {/* What You Did Well */}
            {currentFeedback.what_went_well && currentFeedback.what_went_well.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    What You Did Well
                  </h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {currentFeedback.what_went_well.map((item: string, index: number) => (
                      <li key={index} className="text-green-800">✅ {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Gaps in Understanding */}
            {currentFeedback.gaps_in_understanding && currentFeedback.gaps_in_understanding.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <h4 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Gaps in Understanding
                  </h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {currentFeedback.gaps_in_understanding.map((item: string, index: number) => (
                      <li key={index} className="text-red-800">❌ {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <Button onClick={handleTryAgain} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                Try Again
              </Button>
              <Button onClick={handleSelectNewQuestion} variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                New Question
              </Button>
              {/* Only show continue/complete buttons if it's the last technique of the session */}
              {isLastBlock && (
                <Button onClick={handleComplete} className="bg-green-500 hover:bg-green-600 text-white">
                  Complete Session
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        {showInput && !isProcessing && (
          <div className="flex gap-3 items-start">
            <Textarea 
              placeholder="Type your explanation here..." 
              value={currentExplanation} 
              onChange={e => setCurrentExplanation(e.target.value)} 
              rows={4} 
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitExplanation();
                }
              }} 
              disabled={isProcessing} 
              className="flex-1 resize-none rounded-lg border-2 border-indigo-200 focus:border-indigo-400" 
            />
            <Button 
              onClick={submitExplanation} 
              disabled={!currentExplanation.trim() || isProcessing} 
              className="bg-indigo-500 hover:bg-indigo-600" 
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              {isProcessing ? 'Analyzing...' : 'Explain'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeynmanMode;