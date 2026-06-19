import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTechniqueIcon, getTechniqueLabel } from '@/lib/techniques';
import FlashcardsMode from './modes/FlashcardsMode';
import FeynmanMode from './modes/FeynmanMode';
import BlurtingMode from './modes/BlurtingMode';
import QuizMode from './modes/QuizMode';
import TeachingMode from './modes/TeachingMode';
import StudyBlockTimer from './session/StudyBlockTimer';
import type { StudyMode } from '@/hooks/useStudySessionWithSequence';
import { StudyBlock, TechniqueStep } from '@/utils/studyPlanValidation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface StudyWorkspaceWithSequenceProps {
  currentMode: StudyMode;
  onStartMode: (mode: StudyMode) => void;
  currentBlock?: StudyBlock;
  currentTechnique?: TechniqueStep;
  currentPhase?: 'teaching' | 'technique';
  onCompletePhase?: () => void;
  onNextPhase?: () => void;
  onPreviousPhase?: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  isLastPhase?: boolean;
  onCompleteSession?: () => void;
  onAddQuizMistakes?: (mistakes: any[]) => void;
  onAddFlashcards?: (flashcards: any[]) => void;
  onAddFeynmanData?: (feedback: string, followUp?: string) => void;
  onAddBlurtingData?: (feedback: string, missedConcepts: string[]) => void;
  onAddPhaseUsed?: (phase: string) => void;
  preloadedContent?: any;
  phaseTimeRemaining?: number;
}

const StudyWorkspaceWithSequence = ({
  currentMode,
  onStartMode,
  currentBlock,
  currentTechnique,
  currentPhase,
  onCompletePhase,
  onNextPhase,
  onPreviousPhase,
  canGoNext = false,
  canGoPrevious = false,
  isLastPhase = false,
  onCompleteSession,
  onAddQuizMistakes,
  onAddFlashcards,
  onAddFeynmanData,
  onAddBlurtingData,
  onAddPhaseUsed,
  preloadedContent,
  phaseTimeRemaining = 0
}: StudyWorkspaceWithSequenceProps) => {
  const { toast } = useToast();
  

  // Add component lifecycle debugging
  useEffect(() => {
    
    return () => {
    };
  }, [currentMode, currentBlock?.id]);

  const getTechniqueColor = (technique: string) => {
    switch (technique.toLowerCase()) {
      case 'flashcards':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'quiz':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'feynman':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'blurting':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleTeachingComplete = (data?: any) => {
    
    // SAFEGUARD 1: Only allow progression if teaching content was generated
    if (!data || !data.teachingLessons || data.teachingLessons.length === 0) {
      toast({
        title: "Teaching Content Required",
        description: "Teaching session must generate content before proceeding to other modules.",
        variant: "destructive",
      });
      return;
    }
    
    if (onCompletePhase) {
      onCompletePhase();
    }
  };

  const handleTechniqueComplete = () => {
    if (onCompletePhase) {
      onCompletePhase();
    }
  };

  const handleExitMode = () => {
    onStartMode(null);
  };

  const ModeHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );

  const handleBlockTimeUp = () => {
    if (onCompletePhase) {
      onCompletePhase();
    }
  };

  const handleBlockComplete = () => {
    if (onCompletePhase) {
      onCompletePhase();
    }
  };

  // Teaching Mode - Enhanced condition check with safe preloadedContent access
  if (currentMode === 'teaching' || (currentMode === null && currentBlock?.technique === 'teaching')) {
    const contentKey = `block-${currentBlock?.id}`;
    const hasPreloadedContent = preloadedContent && preloadedContent[contentKey];
    
    
    return (
      <div className="relative h-full min-h-[75vh]">
        <ModeHeader 
          title={`Learning: ${currentBlock?.unit || 'Study Material'}`}
          subtitle={`Preparing for ${currentTechnique?.technique || 'study techniques'}`}
        />
        
        <TeachingMode 
          key={`teaching-${currentBlock?.id}-${currentBlock?.technique}`}
          description={currentBlock?.description || 'Study material'}
          onComplete={handleTeachingComplete}
          onBack={handleExitMode}
          techniqueName={currentTechnique ? getTechniqueLabel(currentTechnique.technique) : 'Study'}
          technique={currentTechnique?.technique || currentBlock?.technique || 'study'}
          preloadedContent={preloadedContent || {}}
          isLastTechniqueOfSession={isLastPhase}
        />
        
        <StudyBlockTimer 
          duration={currentTechnique?.duration || 5} 
          onTimeUp={handleBlockTimeUp} 
          onComplete={handleBlockComplete} 
          isActive={true} 
          blockName="Teaching" 
        />
      </div>
    );
  }
  
  // Flashcards Mode
  if (currentMode === 'flashcards') {
    return (
      <div className="relative h-full min-h-[75vh]">
        <ModeHeader 
          title="Flashcards Mode"
          subtitle={`Studying ${currentBlock?.unit || 'Study Material'}`}
        />
        
        <FlashcardsMode 
          key={`flashcards-${currentBlock?.id}-${currentBlock?.technique}`}
          onExit={handleTechniqueComplete} 
          currentBlock={currentBlock} 
          isLastBlock={isLastPhase} 
          onCompleteSession={onCompleteSession} 
          onAddFlashcards={onAddFlashcards} 
          onAddPhaseUsed={onAddPhaseUsed}
          teachingLessons={preloadedContent?.teachingLessons || preloadedContent?.lessons || []}
        />
        
        {currentTechnique && (
          <StudyBlockTimer 
            duration={currentTechnique.duration} 
            onTimeUp={handleBlockTimeUp} 
            onComplete={handleBlockComplete} 
            isActive={true} 
            blockName="Flashcards" 
          />
        )}
      </div>
    );
  }
  
  // Feynman Mode
  if (currentMode === 'feynman') {
    return (
      <div className="relative h-full min-h-[75vh]">
        <ModeHeader 
          title="Feynman Technique"
          subtitle={`Explaining ${currentBlock?.unit || 'Study Material'}`}
        />
        
        <FeynmanMode 
          key={`feynman-${currentBlock?.id}-${currentBlock?.technique}`}
          onExit={handleTechniqueComplete} 
          currentBlock={currentBlock} 
          isLastBlock={isLastPhase} 
          onCompleteSession={onCompleteSession} 
          onAddFeynmanData={onAddFeynmanData} 
          onAddPhaseUsed={onAddPhaseUsed}
          preloadedExercises={preloadedContent?.preloadedData || preloadedContent?.exercises || []}
          preloadedTeachingContent={preloadedContent || {}}
        />
        
        {currentTechnique && (
          <StudyBlockTimer 
            duration={currentTechnique.duration} 
            onTimeUp={handleBlockTimeUp} 
            onComplete={handleBlockComplete} 
            isActive={true} 
            blockName="Feynman" 
          />
        )}
      </div>
    );
  }
  
  // Blurting Mode
  if (currentMode === 'blurting') {
    return (
      <div className="relative h-full min-h-[75vh]">
        <ModeHeader 
          title="Blurting Method"
          subtitle={`Recalling ${currentBlock?.unit || 'Study Material'}`}
        />
        
        <BlurtingMode 
          key={`blurting-${currentBlock?.id}-${currentBlock?.technique}`}
          onExit={handleTechniqueComplete} 
          currentBlock={currentBlock} 
          isLastBlock={isLastPhase} 
          onCompleteSession={onCompleteSession} 
          onAddBlurtingData={onAddBlurtingData} 
          onAddPhaseUsed={onAddPhaseUsed}
          preloadedExercises={preloadedContent?.preloadedData || preloadedContent?.exercises || []}
          preloadedTeachingContent={preloadedContent || {}}
        />
        
        {currentTechnique && (
          <StudyBlockTimer 
            duration={currentTechnique.duration} 
            onTimeUp={handleBlockTimeUp} 
            onComplete={handleBlockComplete} 
            isActive={true} 
            blockName="Blurting" 
          />
        )}
      </div>
    );
  }
  
  // Quiz Mode
  if (currentMode === 'quiz') {
    return (
      <div className="relative h-full min-h-[75vh]">
        <ModeHeader 
          title="Quiz Mode"
          subtitle={`Testing ${currentBlock?.unit || 'Study Material'}`}
        />
        
        <QuizMode 
          key={`quiz-${currentBlock?.id}-${currentBlock?.technique}`}
          onExit={handleTechniqueComplete} 
          currentBlock={currentBlock} 
          isLastBlock={isLastPhase} 
          onAddQuizMistakes={onAddQuizMistakes} 
          onAddPhaseUsed={onAddPhaseUsed}
          teachingLessons={preloadedContent?.teachingLessons || preloadedContent?.lessons || []}
        />
        
        {currentTechnique && (
          <StudyBlockTimer 
            duration={currentTechnique.duration} 
            onTimeUp={handleBlockTimeUp} 
            onComplete={handleBlockComplete} 
            isActive={true} 
            blockName="Quiz" 
          />
        )}
      </div>
    );
  }

  // Default state - show current phase info and start button
  return (
    <Card className="relative h-full min-h-[80vh] w-full mx-auto">
      <CardHeader className="pb-8">
        <CardTitle className="flex items-center gap-3 text-2xl">
          Current Study Phase
          {currentBlock && (
            <span className="text-lg font-normal text-gray-500">
              • {currentBlock.unit}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-12">
        <div className="space-y-8">
          <div className="text-center">
            <p className="text-gray-600 mb-8 text-xl leading-relaxed">
              {currentPhase === 'teaching' 
                ? `Ready to start learning about ${currentBlock?.unit || 'the study material'}`
                : `Ready to practice ${currentTechnique?.technique || 'study techniques'} for ${currentBlock?.unit || 'the study material'}`
              }
            </p>
          </div>

          {currentTechnique && (
            <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-12 mx-8 my-12">
              <CardContent className="p-0">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-12">
                    <div className="relative">
                      <div className={`p-8 rounded-2xl ${getTechniqueColor(currentTechnique.technique)}`}>
                        <div className="w-16 h-16 flex items-center justify-center">
                          <div className="scale-[1.8]">
                            {(() => { const Icon = getTechniqueIcon(currentTechnique.technique); return <Icon className="w-6 h-6" />; })()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="absolute -right-6 top-4 flex items-center">
                        <div className="w-0 h-0 border-l-[16px] border-l-white border-r-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent shadow-sm"></div>
                        
                        <div className="bg-white px-8 py-4 rounded-2xl shadow-lg border border-gray-200 min-w-[240px] ml-2">
                          <p className="text-lg font-medium text-gray-800">
                            {currentPhase === 'teaching' ? 'Ready to learn?' : 'Ready to begin?'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-3xl mb-3">
                        {currentPhase === 'teaching' ? 'Teaching Phase' : getTechniqueLabel(currentTechnique.technique)}
                      </h3>
                      <p className="text-gray-600 text-lg">
                        {currentPhase === 'teaching' 
                          ? `Learn the fundamentals before practicing`
                          : `Practice with ${currentTechnique.technique} technique`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <Badge variant="outline" className="flex items-center gap-3 text-lg px-6 py-3">
                    <Clock className="w-6 h-6" />
                    {currentTechnique.duration} min
                  </Badge>
                </div>

                <div className="flex justify-center mt-12">
                  <Button 
                    onClick={() => onStartMode(getTechniqueMode(currentTechnique.technique, currentPhase))}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-16 py-6 text-2xl rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    <Play className="w-8 h-8 mr-4" />
                    {currentPhase === 'teaching' ? 'START LEARNING' : 'START PRACTICE'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function to get technique mode - updated to handle teaching phase
const getTechniqueMode = (technique: string, currentPhase?: 'teaching' | 'technique'): StudyMode => {
  // If we're in teaching phase, return teaching mode
  if (currentPhase === 'teaching') {
    return 'teaching';
  }
  
  const correctedTechnique = technique === 'blurring' ? 'blurting' : technique;
  
  switch (correctedTechnique.toLowerCase()) {
    case 'flashcards':
      return 'flashcards';
    case 'quiz':
      return 'quiz';
    case 'feynman':
      return 'feynman';
    case 'blurting':
      return 'blurting';
    case 'teaching':
      return 'teaching';
    default:
      return 'flashcards';
  }
};

export default StudyWorkspaceWithSequence;