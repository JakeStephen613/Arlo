import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, X, SkipForward, ChevronRight, Brain, Target, Timer } from 'lucide-react';
import { QuizQuestion } from '@/services/studyModulesApi';

interface QuizDisplayProps {
  questions: QuizQuestion[];
  currentQuestion: number;
  answers: Array<{ correct: boolean; user: string | undefined; explanation: string }>;
  onAnswer: (answer: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  showResult: boolean;
  fillInAnswer: string;
  onFillInChange: (value: string) => void;
  onFillInSubmit: () => void;
  topic: string;
}

const QuizDisplay = ({
  questions,
  currentQuestion,
  answers,
  onAnswer,
  onNext,
  onPrev,
  onExit,
  showResult,
  fillInAnswer,
  onFillInChange,
  onFillInSubmit,
  topic
}: QuizDisplayProps) => {
  const [skippedQuestions, setSkippedQuestions] = useState<number[]>([]);
  const [questionOrder, setQuestionOrder] = useState<number[]>(() => 
    Array.from({ length: questions.length }, (_, i) => i)
  );

  const progressPercentage = questions.length ? ((currentQuestion + 1) / questions.length) * 100 : 0;
  const userHasAnswered = answers.length > currentQuestion;
  const currentAnswer = answers[currentQuestion];
  const question = questions[currentQuestion];

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

  // Safety check to ensure we have a valid question
  if (!question || typeof question !== 'object') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <Card className="p-8 max-w-md text-center border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="text-lg font-semibold text-gray-800 mb-4">Question not available</div>
          <Button onClick={onExit} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
            Back to Quiz Setup
          </Button>
        </Card>
      </div>
    );
  }

  const handleAnswerClick = (selectedAnswer: string) => {
    onAnswer(selectedAnswer);
  };

  const handleSkipQuestion = () => {
    // Mark as skipped and move current question to end
    const newSkipped = [...skippedQuestions, currentQuestion];
    setSkippedQuestions(newSkipped);
    
    // Move to next question normally
    onNext();
  };

  const correctAnswers = answers.filter(a => a.correct).length;
  const totalAnswered = answers.length;

  const renderQuestion = () => {
    const questionText = safeStringify(question.question);
    
    if (question.type === 'multiple_choice' && Array.isArray(question.options)) {
      return (
        <div className="space-y-6" data-study-content>
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900 leading-relaxed mb-4">
              {questionText}
            </h3>
            <div className="flex items-center justify-center gap-6">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1">
                <Brain className="w-4 h-4 mr-1" />
                Multiple Choice
              </Badge>
              {skippedQuestions.includes(currentQuestion) && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-200 px-3 py-1">
                  <Timer className="w-4 h-4 mr-1" />
                  Revisiting
                </Badge>
              )}
            </div>
          </div>
          
          <div className="grid gap-3 max-w-2xl mx-auto">
            {question.options.map((option, idx) => {
              const optionText = safeStringify(option);
              const correctAnswer = safeStringify(question.correct_answer);
              const isCorrect = optionText === correctAnswer;
              const isUserAnswer = currentAnswer?.user === optionText;
              
              return (
                <Card
                  key={`option-${idx}-${optionText}`}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md border
                    ${userHasAnswered && isCorrect ? 'bg-green-50 border-green-300 text-green-800' : ''}
                    ${userHasAnswered && isUserAnswer && !isCorrect ? 'bg-red-50 border-red-300 text-red-800' : ''}
                    ${!userHasAnswered ? 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50' : ''}
                    ${userHasAnswered && !isUserAnswer && !isCorrect ? 'bg-slate-50 border-slate-200 text-slate-500' : ''}
                  `}
                  onClick={() => !userHasAnswered && handleAnswerClick(optionText)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
                          ${userHasAnswered && isCorrect ? 'bg-green-200 text-green-800' : ''}
                          ${userHasAnswered && isUserAnswer && !isCorrect ? 'bg-red-200 text-red-800' : ''}
                          ${!userHasAnswered ? 'bg-indigo-100 text-indigo-700' : ''}
                          ${userHasAnswered && !isUserAnswer && !isCorrect ? 'bg-slate-200 text-slate-400' : ''}
                        `}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-base font-medium">{optionText}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {userHasAnswered && isCorrect && (
                          <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-700" />
                          </div>
                        )}
                        {userHasAnswered && isUserAnswer && !isCorrect && (
                          <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center">
                            <X className="w-4 h-4 text-red-700" />
                          </div>
                        )}
                        {!userHasAnswered && (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    if (question.type === 'true_false') {
      const opts = ["True", "False"];
      const correctAnswer = safeStringify(question.correct_answer);
      
      return (
        <div className="space-y-6" data-study-content>
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900 leading-relaxed mb-4">
              {questionText}
            </h3>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1">
              <Target className="w-4 h-4 mr-1" />
              True or False
            </Badge>
          </div>
          
          <div className="flex gap-8 justify-center max-w-xl mx-auto">
            {opts.map((option) => {
              const isCorrect = option === correctAnswer;
              const isUserAnswer = currentAnswer?.user === option;
              
              return (
                <Card
                  key={`tf-${option}`}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 border-2 flex-1
                    ${userHasAnswered && isCorrect ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-400 text-white shadow-green-200 shadow-xl' : ''}
                    ${userHasAnswered && isUserAnswer && !isCorrect ? 'bg-gradient-to-r from-red-500 to-pink-500 border-red-400 text-white shadow-red-200 shadow-xl' : ''}
                    ${!userHasAnswered ? 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50' : ''}
                    ${userHasAnswered && !isUserAnswer && !isCorrect ? 'bg-slate-50 border-slate-200 text-slate-500' : ''}
                  `}
                  onClick={() => !userHasAnswered && handleAnswerClick(option)}
                >
                  <CardContent className="p-8 text-center">
                    <div className="text-2xl font-bold mb-2">{option}</div>
                    {userHasAnswered && isCorrect && <Check className="w-6 h-6 mx-auto text-white" />}
                    {userHasAnswered && isUserAnswer && !isCorrect && <X className="w-6 h-6 mx-auto text-white" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    if (question.type === 'fill_in_blank') {
      const correctAnswer = safeStringify(question.correct_answer);
      
      return (
        <div className="space-y-6 max-w-2xl mx-auto" data-study-content>
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900 leading-relaxed mb-4">
              {questionText}
            </h3>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-3 py-1">
              <Target className="w-4 h-4 mr-1" />
              Fill in the Blank
            </Badge>
          </div>
          
          {!userHasAnswered ? (
            <Card className="border-2 border-indigo-200 hover:border-indigo-300 transition-colors">
              <CardContent className="p-8">
                <div className="flex gap-4 items-center justify-center">
                  <Input
                    value={fillInAnswer}
                    onChange={(e) => onFillInChange(e.target.value)}
                    placeholder="Enter your answer..."
                    className="text-lg text-center border-2 border-slate-200 focus:border-indigo-400 py-3"
                    onKeyPress={(e) => e.key === 'Enter' && onFillInSubmit()}
                  />
                  <Button
                    onClick={onFillInSubmit}
                    disabled={!fillInAnswer.trim()}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 text-lg"
                    size="lg"
                  >
                    Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={`border-2 ${currentAnswer?.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
              <CardContent className="p-8 text-center space-y-4">
                <div className={`text-xl font-bold ${currentAnswer?.correct ? 'text-green-700' : 'text-red-700'}`}>
                  Your answer: {safeStringify(currentAnswer?.user) || 'No answer'}
                </div>
                <div className="text-slate-600 text-lg">
                  Correct answer: <span className="font-semibold text-green-700">{correctAnswer}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    return (
      <div className="text-center text-slate-600 bg-slate-50 p-8 rounded-lg">
        Unsupported question format
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Enhanced Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onExit}
              className="hover:bg-slate-100 rounded-full"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Quiz: {safeStringify(topic)}
              </h1>
              <p className="text-slate-600">Test your knowledge with interactive questions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Score Display */}
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {correctAnswers}/{totalAnswered}
              </div>
              <div className="text-sm text-slate-500">Score</div>
            </div>
            
            {/* Question Counter */}
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">
                {currentQuestion + 1}/{questions.length}
              </div>
              <div className="text-sm text-slate-500">Question</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Progress Bar */}
      <div className="bg-white/60 backdrop-blur-sm px-6 py-4 border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-sm font-medium text-slate-700">Progress</span>
            <div className="flex-1">
              <Progress 
                value={progressPercentage} 
                className="h-3 bg-slate-200"
              />
            </div>
            <span className="text-sm font-bold text-indigo-600">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {renderQuestion()}
          
          {/* Enhanced Explanation */}
          {userHasAnswered && currentAnswer && (
            <Card className="mt-8 border-0 bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-slate-900 mb-2">Explanation</h4>
                    <p className="text-slate-700 leading-relaxed">
                      {safeStringify(currentAnswer.explanation) || safeStringify(question.explanation) || 'No explanation available'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Enhanced Navigation */}
      <div className="bg-white/90 backdrop-blur-sm border-t border-slate-200 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={currentQuestion === 0}
            className="border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex items-center gap-4">
            {/* Skip Button - only show if user hasn't answered */}
            {!userHasAnswered && (
              <Button
                variant="outline"
                onClick={handleSkipQuestion}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip for Now
              </Button>
            )}
            
            {/* Next/Finish Button */}
            {userHasAnswered ? (
              <Button
                onClick={onNext}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-8 py-3 shadow-lg"
                size="lg"
              >
                {currentQuestion < questions.length - 1 ? (
                  <>
                    Next Question
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  'Finish Quiz'
                )}
              </Button>
            ) : (
              <div className="text-slate-500 italic px-8 py-3">
                Select an answer to continue
              </div>
            )}
          </div>
          
          <div className="w-24"></div> {/* Spacer for balance */}
        </div>
      </div>
    </div>
  );
};

export default QuizDisplay;