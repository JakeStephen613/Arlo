import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingButton } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, HelpCircle } from 'lucide-react';
interface QuizSetupProps {
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  onExit: () => void;
  onStartQuiz: (count: number, topic: string, useCustom: boolean) => void;
  isLoading: boolean;
}
const QuizSetup = ({
  currentBlock,
  onExit,
  onStartQuiz,
  isLoading
}: QuizSetupProps) => {
  const [questionCount, setQuestionCount] = useState([5]);
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const handleStart = () => {
    const topic = useCustomTopic ? customTopic : currentBlock?.unit || '';
    onStartQuiz(questionCount[0], topic, useCustomTopic);
  };
  return <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onExit}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold">Quiz Setup</h2>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50" />
          <CardContent className="relative p-8">
            <div className="space-y-8">
              {/* Mascot and Speech Bubble */}
              <div className="text-center relative">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white text-3xl mb-4 shadow-lg">
                  <HelpCircle className="w-10 h-10" />
                </div>
                
                {/* Speech Bubble */}
                <div className="relative inline-block bg-white rounded-2xl px-6 py-4 shadow-md border border-green-100 mb-4">
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-green-100 rotate-45" />
                  <p className="text-lg font-medium text-gray-800">
                    Ready to test your knowledge?
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Let's see how well you understand this topic!
                  </p>
                </div>

                <h3 className="text-2xl font-semibold text-gray-900 mb-2 px-[40px] py-[40px]">
                  Generate Quiz
                </h3>
                
              </div>

              {(useCustomTopic || !currentBlock) && <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Custom Topic
                  </label>
                  <Input value={customTopic} onChange={e => setCustomTopic(e.target.value)} placeholder="Enter your topic..." className="text-center border-2 border-green-200 focus:border-green-500" />
                </div>}
              
              

              <LoadingButton
                isLoading={isLoading}
                loadingText="Generating quiz..."
                onClick={handleStart}
                disabled={useCustomTopic && !customTopic.trim() || !useCustomTopic && !currentBlock}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
              >
                START QUIZ
              </LoadingButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default QuizSetup;