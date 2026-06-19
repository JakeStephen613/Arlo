import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { updateContext, fetchQuiz, QuizQuestion } from '@/services/studyModulesApi';
import { UniversalLoadingScreen } from '@/components/common/loading';
import { useAuth } from '@/contexts/AuthContext';
import QuizSetup from './quiz/QuizSetup';
import QuizDisplay from './quiz/QuizDisplay';
import QuizResults from './quiz/QuizResults';

interface QuizModeProps {
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
  onAddQuizMistakes?: (mistakes: any[]) => void;
  onAddPhaseUsed?: (phase: string) => void;
  teachingLessons?: any[] | null;
}

const QuizMode = ({ 
  onExit, 
  currentBlock, 
  isLastBlock = false,
  onCompleteSession,
  onAddQuizMistakes,
  onAddPhaseUsed,
  teachingLessons = null
}: QuizModeProps) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ correct: boolean; user: string | undefined; explanation: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [topic, setTopic] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Prevent duplicate API calls and notifications
  const hasGeneratedRef = useRef(false);
  const hasNotifiedRef = useRef(false);
  const hasProcessedPreloadedRef = useRef(false);

  // Helper function to flatten teaching lessons into content string
  const flattenLessonsToContent = (lessons: any[]): string => {
    return lessons
      .map(block => {
        const body = Array.isArray(block.content)
          ? block.content.join("\n- ")
          : block.content;
        return `${block.title}\n- ${body}`;
      })
      .join("\n\n");
  };

  // No more preloading - removed for manual generation approach

  // Send context update when quiz starts (without waiting for response)
  const sendContextUpdate = async (quizTopic: string) => {
    if (!user || !currentBlock) return;
    
    try {
      await updateContext({
        source: `user:${user.id}`,
        user_id: user.id,
        current_topic: quizTopic,
        concept: currentBlock.description,
        phase: 'quiz',
        duration: currentBlock.duration,
        timestamp: new Date().toISOString(),
        block_id: currentBlock.id
      });
    } catch (error) {
    }
  };

  const generateQuiz = async (count: number, quizTopic: string, useCustom: boolean) => {
    // Prevent duplicate calls
    if (hasGeneratedRef.current) {
      return;
    }

    hasGeneratedRef.current = true;
    setIsLoading(true);
    setTopic(quizTopic);
    
    sendContextUpdate(quizTopic);

    try {

      let requestPayload;
      
      if (teachingLessons && teachingLessons.length > 0) {
        // Use teaching lessons as primary input - flatten to string
        const content = flattenLessonsToContent(teachingLessons);
        requestPayload = {
          content,
          difficulty: 'medium',
          question_types: ['multiple_choice'],
          user_id: user.id
        };
      } else if (useCustom) {
        // Fallback to custom topic
        requestPayload = {
          content: quizTopic,
          difficulty: 'medium',
          question_types: ['multiple_choice'],
          user_id: user.id
        };
      } else {
        // Fallback to current block description
        requestPayload = {
          content: currentBlock?.description || quizTopic,
          difficulty: 'medium',
          question_types: ['multiple_choice'],
          user_id: user.id
        };
      }

      const response = await fetchQuiz(requestPayload);

      if (!response.questions || response.questions.length === 0) {
        throw new Error('No questions were generated. Please try again.');
      }

      setQuestions(response.questions);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setShowResults(false);

      if (onAddPhaseUsed) {
        onAddPhaseUsed('quiz');
      }

    } catch (error) {
      console.error('Failed to generate quiz:', error);
      hasGeneratedRef.current = false; // Reset on error
      onExit();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = (selectedAnswer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const correctAnswer = String(currentQuestion.correct_answer || '');
    const isCorrect = selectedAnswer === correctAnswer;
    
    
    const newAnswer = {
      correct: isCorrect,
      user: selectedAnswer,
      explanation: currentQuestion.explanation || ''
    };
    
    setAnswers(prev => [...prev, newAnswer]);
    
    // Don't auto-advance - user must click Next
  };

  const handleQuizComplete = async () => {
    setIsSubmitting(true);
    
    try {
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

      const incorrectAnswers = answers.map((answer, index) => ({
        question: safeStringify(questions[index].question),
        userAnswer: answer.user,
        correctAnswer: safeStringify(questions[index].correct_answer),
        explanation: safeStringify(answer.explanation)
      })).filter((_, index) => !answers[index].correct);

      if (onAddQuizMistakes && incorrectAnswers.length > 0) {
        onAddQuizMistakes(incorrectAnswers);
      }

      if (isLastBlock && onCompleteSession) {
        onCompleteSession();
      } else {
        onExit();
      }
    } catch (error) {
      console.error('Error completing quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    hasGeneratedRef.current = false; // Allow regeneration
    hasNotifiedRef.current = false; // Allow new notifications
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setShowResults(false);
    setQuestions([]);
  };

  const handleNewQuiz = () => {
    hasGeneratedRef.current = false; // Allow new generation
    hasNotifiedRef.current = false; // Allow new notifications  
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setShowResults(false);
    setQuestions([]);
    setTopic('');
  };

  const correctAnswers = answers.filter(answer => answer.correct).length;

  if (questions.length === 0 && !isLoading) {
    return (
      <Card className="h-full">
        <div className="p-6 h-full">
          <QuizSetup
            currentBlock={currentBlock}
            onExit={onExit}
            onStartQuiz={generateQuiz}
            isLoading={isLoading}
          />
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <UniversalLoadingScreen
        technique="quiz"
        title="Generating your quiz..."
        subtitle="ARLO is creating personalized questions to test your knowledge"
        showMessages={true}
      />
    );
  }

  if (showResults) {
    return (
      <Card className="h-full">
        <div className="p-6 h-full">
          <QuizResults
            correct={correctAnswers}
            total={questions.length}
            onReview={() => setShowResults(false)}
            onRetry={handleRetry}
            onNewQuiz={handleNewQuiz}
            onContinue={handleQuizComplete}
            isSubmitting={isSubmitting}
            questions={questions}
            answers={answers}
            isLastTechniqueOfSession={isLastBlock}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <div className="p-6 h-full">
        <QuizDisplay
          questions={questions}
          currentQuestion={currentQuestionIndex}
          answers={answers}
          onAnswer={handleAnswerSubmit}
          onNext={() => {
            if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(prev => prev + 1);
            } else {
              setShowResults(true);
            }
          }}
          onPrev={() => {
            if (currentQuestionIndex > 0) {
              setCurrentQuestionIndex(prev => prev - 1);
            }
          }}
          onExit={onExit}
          showResult={false}
          fillInAnswer=""
          onFillInChange={() => {}}
          onFillInSubmit={() => {}}
          topic={topic}
        />
      </div>
    </Card>
  );
};

export default QuizMode;
