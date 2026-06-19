import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingButton, UniversalLoadingScreen } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Brain } from 'lucide-react';

interface BlockInfo {
  id: string;
  unit: string;
  technique: string;
  description: string;
  duration: number;
}

interface ModeSetupProps {
  technique: 'feynman' | 'blurting';
  currentBlock?: BlockInfo;
  onExit: () => void;
  onStart: (topic: string, useCustom: boolean) => void;
  isLoading: boolean;
}

const CONFIG = {
  feynman: {
    headerTitle: 'Feynman Technique',
    cardTitle: 'Feynman Technique',
    gradient: 'from-purple-50 via-violet-50 to-indigo-50',
    iconGradient: 'from-purple-500 to-violet-600',
    bubbleBorder: 'border-purple-100',
    inputBorder: 'border-purple-200 focus:border-purple-500',
    howItWorksBorder: 'border-purple-200',
    howItWorksTitle: 'text-purple-900',
    buttonGradient: 'from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700',
    mainMessage: 'Ready to teach like Einstein?',
    subMessage: "Let's explain this concept in simple terms!",
    buttonText: 'START LEARNING',
    loadingTitle: 'Setting up explanation mode...',
    loadingSubtitle: 'Generating Feynman questions for your topic',
    howItWorks: [
      'Explain the concept in simple terms',
      'Use analogies and examples',
      'Get feedback on your explanation',
      'Identify gaps in your understanding',
    ],
    showTopicToggle: false,
    showBlockUnit: false,
  },
  blurting: {
    headerTitle: 'Brain Dump (Blurting)',
    cardTitle: 'Brain Dump Technique',
    gradient: 'from-orange-50 via-amber-50 to-yellow-50',
    iconGradient: 'from-orange-500 to-amber-600',
    bubbleBorder: 'border-orange-100',
    inputBorder: 'border-orange-200 focus:border-orange-500',
    howItWorksBorder: 'border-orange-200',
    howItWorksTitle: 'text-orange-900',
    buttonGradient: 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700',
    mainMessage: 'Time for a memory challenge!',
    subMessage: "Let's see what you remember without looking!",
    buttonText: 'START BRAIN DUMP',
    loadingTitle: 'Starting brain dump...',
    loadingSubtitle: 'Generating recall exercises for your topic',
    howItWorks: [
      'Write everything you remember without notes',
      'Complete memory recall exercises',
      'Get AI feedback on your knowledge',
      'Identify gaps for focused review',
    ],
    showTopicToggle: true,
    showBlockUnit: true,
  },
} as const;

const ModeSetup = ({ technique, currentBlock, onExit, onStart, isLoading }: ModeSetupProps) => {
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const cfg = CONFIG[technique];

  const handleStart = () => {
    onStart(useCustomTopic ? customTopic : currentBlock?.unit ?? '', useCustomTopic);
  };

  if (isLoading) {
    return (
      <UniversalLoadingScreen
        technique={technique}
        title={cfg.loadingTitle}
        subtitle={cfg.loadingSubtitle}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onExit}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold mx-[100px]">{cfg.headerTitle}</h2>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-lg relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient}`} />
          <CardContent className="relative p-8">
            <div className="space-y-8">
              <div className="text-center relative">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${cfg.iconGradient} text-white text-3xl mb-4 shadow-lg`}>
                  <Brain className="w-10 h-10" />
                </div>
                <div className={`relative inline-block bg-white rounded-2xl px-6 py-4 shadow-md border ${cfg.bubbleBorder} mb-4`}>
                  <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t ${cfg.bubbleBorder} rotate-45`} />
                  <p className="text-lg font-medium text-gray-800">{cfg.mainMessage}</p>
                  <p className="text-sm text-gray-600 mt-1">{cfg.subMessage}</p>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">{cfg.cardTitle}</h3>
                {cfg.showBlockUnit && currentBlock && (
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-800">{currentBlock.unit}</p>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">
                      Write everything you remember to identify knowledge gaps
                    </p>
                  </div>
                )}
              </div>

              {(useCustomTopic || !currentBlock) && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Custom Topic</label>
                  <Input
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    placeholder="Enter your topic..."
                    className={`text-center border-2 ${cfg.inputBorder}`}
                  />
                </div>
              )}

              <div className={`bg-white/60 rounded-lg p-4 border ${cfg.howItWorksBorder}`}>
                <h4 className={`font-medium ${cfg.howItWorksTitle} mb-2`}>How it works:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {cfg.howItWorks.map(item => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>

              <LoadingButton
                isLoading={isLoading}
                loadingText={cfg.loadingTitle}
                onClick={handleStart}
                disabled={(useCustomTopic && !customTopic.trim()) || (!useCustomTopic && !currentBlock)}
                className={`w-full bg-gradient-to-r ${cfg.buttonGradient} text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200`}
                size="lg"
              >
                {cfg.buttonText}
              </LoadingButton>

              {cfg.showTopicToggle && !useCustomTopic && currentBlock && (
                <button
                  onClick={() => setUseCustomTopic(true)}
                  className="w-full text-sm text-orange-600 hover:text-orange-700 underline"
                >
                  Use a different topic instead
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ModeSetup;
