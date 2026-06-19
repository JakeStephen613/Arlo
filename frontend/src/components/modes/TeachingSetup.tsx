
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Play } from 'lucide-react';

interface TeachingSetupProps {
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  onStartTeaching: () => void;
  isLoading: boolean;
}

const TeachingSetup = ({
  currentBlock,
  onStartTeaching,
  isLoading
}: TeachingSetupProps) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Learning Phase</h2>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50" />
          <CardContent className="relative p-8">
            <div className="space-y-8">
              {/* Mascot and Speech Bubble */}
              <div className="text-center relative">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl mb-4 shadow-lg">
                  <BookOpen className="w-10 h-10" />
                </div>
                
                {/* Speech Bubble */}
                <div className="relative inline-block bg-white rounded-2xl px-6 py-4 shadow-md border border-blue-100 mb-4">
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-blue-100 rotate-45" />
                  <p className="text-lg font-medium text-gray-800">
                    Ready to learn the fundamentals?
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Let's build a strong foundation first!
                  </p>
                </div>

                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  Teaching Phase
                </h3>
                
                {currentBlock && (
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-800">
                      {currentBlock.unit}
                    </p>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">
                      Learn the core concepts before practicing with different techniques
                    </p>
                  </div>
                )}
              </div>

              <Button 
                onClick={onStartTeaching}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Play className="w-6 h-6 mr-3" />
                START LEARNING
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeachingSetup;
