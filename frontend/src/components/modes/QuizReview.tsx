
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, X, RotateCcw } from 'lucide-react';
import { QuizQuestion } from '@/services/studyModulesApi';

interface QuizReviewProps {
  questions: QuizQuestion[];
  answers: Array<{ correct: boolean; user: string | undefined; explanation: string }>;
  onBack: () => void;
  onExit: () => void;
  onRetry: () => void;
}

// Helper function to safely convert any value to string
const safeStringify = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    // If it's an object, try to extract meaningful content
    if (value.text) return String(value.text);
    if (value.content) return String(value.content);
    if (value.value) return String(value.value);
    return JSON.stringify(value);
  }
  return String(value);
};

const QuizReview = ({ questions, answers, onBack, onExit, onRetry }: QuizReviewProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const correctCount = answers.filter(a => a.correct).length;
  const totalQuestions = questions.length;
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex];
  const isCorrect = currentAnswer?.correct;

  const goToNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-indigo-500 text-white p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-white hover:bg-white/20">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold">Quiz Review</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onRetry} variant="outline" className="flex items-center gap-2 bg-white text-indigo-500 hover:bg-gray-50">
            <RotateCcw className="w-4 h-4" />
            Retry Quiz
          </Button>
          <Button onClick={onExit} variant="outline" className="bg-white text-indigo-500 hover:bg-gray-50">
            Exit Quiz
          </Button>
        </div>
      </div>

      {/* Score Summary */}
      <Card className={`mb-6 border-2 ${getScoreColor(scorePercentage)}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold mb-1">{scorePercentage}%</div>
              <div className="text-lg font-medium">
                {correctCount} out of {totalQuestions} correct
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-75 mb-1">
                {scorePercentage >= 80 ? 'Excellent work!' : 
                 scorePercentage >= 60 ? 'Good job, keep practicing!' : 
                 'Keep studying, you\'ll improve!'}
              </div>
              <Badge variant={isCorrect ? "secondary" : "destructive"}>
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          onClick={goToPrev}
          disabled={currentQuestionIndex === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                index === currentQuestionIndex
                  ? 'bg-indigo-500 text-white'
                  : answers[index]?.correct
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={goToNext}
          disabled={currentQuestionIndex === questions.length - 1}
          className="flex items-center gap-2"
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Current Question Review */}
      <div className="flex-1 overflow-y-auto">
        <Card className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Badge 
                  variant={isCorrect ? "secondary" : "destructive"}
                  className="text-xs mt-1"
                >
                  Q{currentQuestionIndex + 1}
                </Badge>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-lg mb-4">{safeStringify(currentQuestion.question)}</h3>
                  
                  {/* Multiple Choice Options */}
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                     <div className="space-y-3 mb-6">
                       {currentQuestion.options.map((option, optIndex) => {
                         const optionText = safeStringify(option);
                         const correctAnswer = safeStringify(currentQuestion.correct_answer);
                         const isCorrectAnswer = optionText === correctAnswer;
                         const isUserAnswer = optionText === currentAnswer?.user;
                         
                         return (
                           <div
                             key={optIndex}
                             className={`p-4 rounded-lg border text-sm ${
                               isCorrectAnswer
                                 ? 'bg-green-50 border-green-200 text-green-800'
                                 : isUserAnswer && !isCorrectAnswer
                                 ? 'bg-red-50 border-red-200 text-red-800'
                                 : 'bg-gray-50 border-gray-200'
                             }`}
                           >
                             <div className="flex items-center justify-between">
                               <span><strong>{String.fromCharCode(65 + optIndex)}.</strong> {optionText}</span>
                              <div className="flex gap-1">
                                {isCorrectAnswer && <Check className="w-4 h-4 text-green-600" />}
                                {isUserAnswer && !isCorrectAnswer && <X className="w-4 h-4 text-red-600" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True/False Display */}
                  {currentQuestion.type === 'true_false' && (
                     <div className="flex gap-4 mb-6">
                       {['True', 'False'].map((option) => {
                         const correctAnswer = safeStringify(currentQuestion.correct_answer);
                         const isCorrectAnswer = option === correctAnswer;
                         const isUserAnswer = option === currentAnswer?.user;
                        
                        return (
                          <div
                            key={option}
                            className={`p-4 rounded-lg border text-sm flex-1 text-center ${
                              isCorrectAnswer
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : isUserAnswer && !isCorrectAnswer
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span><strong>{option}</strong></span>
                              {isCorrectAnswer && <Check className="w-4 h-4 text-green-600" />}
                              {isUserAnswer && !isCorrectAnswer && <X className="w-4 h-4 text-red-600" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill in the Blank Display */}
                  {currentQuestion.type === 'fill_in_blank' && (
                    <div className="space-y-3 mb-6">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">
                          <strong>Your answer:</strong> <span className={`font-medium ml-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {currentAnswer?.user || 'No answer'}
                          </span>
                        </div>
                      </div>
                       <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                         <div className="text-sm text-green-800">
                           <strong>Correct answer:</strong> <span className="font-medium ml-2">{safeStringify(currentQuestion.correct_answer)}</span>
                         </div>
                       </div>
                    </div>
                  )}

                  {/* Result Badge */}
                  <div className="mb-4">
                    <Badge variant={isCorrect ? "secondary" : "destructive"} className="text-sm px-3 py-1">
                      {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </Badge>
                  </div>

                  {/* Explanation */}
                   <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                     <div className="text-sm font-medium text-blue-800 mb-2">💡 Explanation:</div>
                     <div className="text-sm text-blue-700 leading-relaxed">{safeStringify(currentAnswer?.explanation || currentQuestion.explanation)}</div>
                   </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizReview;
