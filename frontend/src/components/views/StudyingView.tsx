import StudySessionTracker from '@/components/StudySessionTracker';
import StudyWorkspaceWithSequence from '@/components/StudyWorkspaceWithSequence';
import ArloChatbot from '@/components/ArloChatbot';
import type { StudyPlan, StudyBlock } from '@/types';
import type { StudyMode } from '@/hooks/useStudySessionWithSequence';
import type { ExpandedBlock } from '@/utils/blockExpansion';

interface StudyingViewProps {
  plan: StudyPlan;
  currentBlockIndex: number;
  currentBlock: StudyBlock | undefined;
  expandedBlocks: ExpandedBlock[];
  currentExpandedIndex: number;
  currentMode: StudyMode;
  isChatbotExpanded: boolean;
  isSessionRunning: boolean;
  isLastBlock: boolean;
  sessionId: string;
  preloadedContent: unknown;
  onSkipToNext: () => void;
  onSkipToPrevious: () => void;
  onStartPause: () => void;
  onCompleteSession: () => void;
  onPauseSession: () => void;
  onTriggerBreak: () => void;
  onBreakComplete: () => void;
  onBlockClick: (index: number) => void;
  onToggleChatbot: () => void;
  onStartMode: (mode: StudyMode) => void;
  onAddQuizMistakes: (...args: unknown[]) => void;
  onAddFlashcards: (...args: unknown[]) => void;
  onAddFeynmanData: (...args: unknown[]) => void;
  onAddBlurtingData: (...args: unknown[]) => void;
  onAddPhaseUsed: (phase: string) => void;
}

const StudyingView = ({
  plan, currentBlockIndex, currentBlock, expandedBlocks, currentExpandedIndex,
  currentMode, isChatbotExpanded, isSessionRunning, isLastBlock, sessionId,
  preloadedContent, onSkipToNext, onSkipToPrevious, onStartPause, onCompleteSession,
  onPauseSession, onTriggerBreak, onBreakComplete, onBlockClick, onToggleChatbot,
  onStartMode, onAddQuizMistakes, onAddFlashcards, onAddFeynmanData, onAddBlurtingData,
  onAddPhaseUsed,
}: StudyingViewProps) => (
  <div className="space-y-6">
    <StudySessionTracker
      plan={plan}
      currentBlockIndex={currentBlockIndex}
      onSkipToNext={onSkipToNext}
      onSkipToPrevious={onSkipToPrevious}
      onStartPause={onStartPause}
      isRunning={isSessionRunning}
      onCompleteSession={onCompleteSession}
      onPauseSession={onPauseSession}
      isLastBlock={isLastBlock}
      onTriggerBreak={onTriggerBreak}
      isBreakActive={false}
      onBreakComplete={onBreakComplete}
      onPreloadTeachingContent={async () => {}}
      expandedBlocks={expandedBlocks}
      currentExpandedIndex={currentExpandedIndex}
      onBlockClick={onBlockClick}
    />

    <div className="flex flex-col gap-6 min-h-[calc(100vh-350px)]">
      <div className={isChatbotExpanded ? 'w-full flex flex-col gap-6' : 'flex gap-6 min-h-[calc(100vh-350px)]'}>
        {isChatbotExpanded && (
          <div className="w-full flex justify-center">
            <div className="w-2/3 max-w-4xl h-[120vh] max-h-[600px]">
              <ArloChatbot
                isExpanded={isChatbotExpanded}
                onToggleExpand={onToggleChatbot}
                currentBlock={currentBlock}
                isLastBlock={isLastBlock}
                sessionId={sessionId}
              />
            </div>
          </div>
        )}

        <div className={isChatbotExpanded ? 'w-full flex justify-center' : 'flex-1'}>
          <div className={isChatbotExpanded ? 'w-2/3 max-w-4xl' : ''}>
            <div className={isChatbotExpanded ? 'bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm' : ''}>
              {isChatbotExpanded && (
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    Study Module
                    <span className="text-sm font-normal text-gray-500">
                      {currentBlock?.technique.replace('_', ' ')} • {currentBlock?.unit}
                    </span>
                  </h3>
                </div>
              )}
              <div className={isChatbotExpanded ? 'p-4' : ''}>
                <StudyWorkspaceWithSequence
                  key="persistent-study-workspace"
                  currentMode={currentMode}
                  onStartMode={onStartMode}
                  currentBlock={currentBlock}
                  onCompleteSession={onCompleteSession}
                  onAddQuizMistakes={onAddQuizMistakes}
                  onAddFlashcards={onAddFlashcards}
                  onAddFeynmanData={onAddFeynmanData}
                  onAddBlurtingData={onAddBlurtingData}
                  onAddPhaseUsed={onAddPhaseUsed}
                  preloadedContent={preloadedContent}
                />
              </div>
            </div>
          </div>
        </div>

        {!isChatbotExpanded && (
          <div className="w-80 min-w-[300px] flex-shrink-0 mt-16">
            <div className="h-[calc(100vh-60px)]">
              <ArloChatbot
                isExpanded={isChatbotExpanded}
                onToggleExpand={onToggleChatbot}
                currentBlock={currentBlock}
                isLastBlock={isLastBlock}
                sessionId={sessionId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default StudyingView;
