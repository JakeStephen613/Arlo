
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Plus, BookOpen } from 'lucide-react';
import { useState } from 'react';
import QuizReview from '../QuizReview';
import { QuizQuestion } from '@/services/studyModulesApi';

interface QuizResultsProps {
  correct: number;
  total: number;
  onReview: () => void;
  onRetry: () => void;
  onNewQuiz: () => void;
  onContinue: () => void;
  isSubmitting: boolean;
  questions?: QuizQuestion[];
  answers?: Array<{ correct: boolean; user: string | undefined; explanation: string }>;
  isLastTechniqueOfSession?: boolean;
}

const QuizResults = ({
  correct,
  total,
  onReview,
  onRetry,
  onNewQuiz,
  onContinue,
  isSubmitting,
  questions = [],
  answers = [],
  isLastTechniqueOfSession = false
}: QuizResultsProps) => {
  const [showReview, setShowReview] = useState(false);
  const score = total ? Math.round((correct / total) * 100) : 0;
  const incorrect = total - correct;
  
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = () => {
    if (score >= 80) return 'Excellent!';
    if (score >= 60) return 'Good Job!';
    return 'Keep Practicing!';
  };

  const handleReviewAnswers = () => {
    if (questions.length > 0 && answers.length > 0) {
      setShowReview(true);
    } else {
      // Fallback to the original onReview if no questions/answers data
      onReview();
    }
  };

  const handleBackFromReview = () => {
    setShowReview(false);
  };

  if (showReview) {
    return (
      <QuizReview
        questions={questions}
        answers={answers}
        onBack={handleBackFromReview}
        onExit={onContinue}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      <Card className="w-full max-w-2xl border-2 shadow-2xl">
        <CardContent className="p-12 text-center">
          <div className="mb-8">
            <div className="mb-4">
              <div className={`text-6xl font-bold mb-2 ${getScoreColor()}`}>{score}%</div>
              <div className="text-2xl font-semibold text-gray-700 mb-2">{getScoreBadge()}</div>
              <div className="text-lg text-gray-600">
                You scored {correct} out of {total} questions correctly
              </div>
            </div>
            
            <div className="flex justify-center items-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{correct}</div>
                <div className="text-sm text-gray-500">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{incorrect}</div>
                <div className="text-sm text-gray-500">Incorrect</div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 justify-center flex-wrap">
            <Button 
              onClick={handleReviewAnswers} 
              variant="outline"
              className="px-6 py-3 text-base flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Review Answers
            </Button>
            <Button 
              onClick={onRetry} 
              variant="outline"
              className="px-6 py-3 text-base flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Quiz
            </Button>
            <Button 
              onClick={onNewQuiz} 
              variant="outline"
              className="px-6 py-3 text-base flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Quiz
            </Button>
            {/* Only show continue button if it's the last technique of the session */}
            {isLastTechniqueOfSession && (
              <Button 
                onClick={onContinue} 
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 text-base" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizResults;
