import ProtectedRoute from '@/components/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import ConnectTutorDialog from '@/components/ConnectTutorDialog';
import StudySessionTracker from '@/components/StudySessionTracker';
import LandingView from '@/components/views/LandingView';
import EditingView from '@/components/views/EditingView';
import StudyingView from '@/components/views/StudyingView';
import CompleteView from '@/components/views/CompleteView';
import { useIndexState } from '@/hooks/useIndexState';

const Index = () => {
  const {
    session, user, userProfile, sessionId,
    connectTutorOpen, setConnectTutorOpen,
    showStudentDashboard, hasConnectedTutor,
    handleStartSession, handleResumeSessionFromHook,
    savePlan, startStudySession,
    handleSkipToNext, handleSkipToPrevious, handleBlockClick,
    handleCompleteSession, handleEndSession, handlePauseSession,
    handleTriggerBreak, handleBreakComplete, handleSignOut,
    handleConnectTutor, handleTutorConnected,
  } = useIndexState();

  const {
    appState, isBreakActive, currentPlan, currentMode, isChatbotExpanded,
    setIsChatbotExpanded, isSessionRunning, setIsSessionRunning, expandedBlocks,
    currentExpandedIndex, isGenerating, handleGeneratePlan, getNavigation,
    getCurrentBlock, isLastBlock, setCurrentMode, addQuizMistakes, addFlashcards,
    addFeynmanData, addBlurtingData, addPhaseUsed, getPreloadedContentForCurrentBlock,
    sessionData,
  } = session;

  const showHeader = appState !== 'session-complete' && !isBreakActive;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-16">
        {showHeader && (
          <>
            <AppHeader
              userEmail={user?.email}
              appState={appState}
              onNewSession={() => session.setAppState('planning')}
              onSignOut={handleSignOut}
              onConnectTutor={userProfile?.account_mode === 'arlo_tutoring' ? handleConnectTutor : undefined}
              userAccountMode={userProfile?.account_mode}
            />
            <main className="max-w-7xl mx-auto px-6 py-8">
              {appState === 'planning' && (
                <LandingView
                  onGeneratePlan={handleGeneratePlan}
                  isGenerating={isGenerating}
                  hasConnectedTutor={hasConnectedTutor}
                  showStudentDashboard={showStudentDashboard}
                  accountMode={userProfile?.account_mode}
                  onStartSession={handleStartSession}
                  onResumeSession={handleResumeSessionFromHook}
                />
              )}
              {appState === 'editing-plan' && currentPlan && (
                <EditingView
                  plan={currentPlan}
                  onSavePlan={savePlan}
                  onStartSession={startStudySession}
                  onBack={() => session.setAppState('planning')}
                />
              )}
              {appState === 'study-session' && currentPlan && (
                <StudyingView
                  plan={currentPlan}
                  currentBlockIndex={getNavigation().originalIndex}
                  currentBlock={getCurrentBlock()}
                  expandedBlocks={expandedBlocks}
                  currentExpandedIndex={currentExpandedIndex}
                  currentMode={currentMode}
                  isChatbotExpanded={isChatbotExpanded}
                  isSessionRunning={isSessionRunning}
                  isLastBlock={isLastBlock()}
                  sessionId={sessionId.current}
                  preloadedContent={getPreloadedContentForCurrentBlock()}
                  onSkipToNext={handleSkipToNext}
                  onSkipToPrevious={handleSkipToPrevious}
                  onStartPause={() => setIsSessionRunning(prev => !prev)}
                  onCompleteSession={handleCompleteSession}
                  onPauseSession={handlePauseSession}
                  onTriggerBreak={handleTriggerBreak}
                  onBreakComplete={handleBreakComplete}
                  onBlockClick={handleBlockClick}
                  onToggleChatbot={() => setIsChatbotExpanded(!isChatbotExpanded)}
                  onStartMode={setCurrentMode}
                  onAddQuizMistakes={addQuizMistakes}
                  onAddFlashcards={addFlashcards}
                  onAddFeynmanData={addFeynmanData}
                  onAddBlurtingData={addBlurtingData}
                  onAddPhaseUsed={addPhaseUsed}
                />
              )}
            </main>
          </>
        )}

        {isBreakActive && appState === 'study-session' && currentPlan && (
          <StudySessionTracker
            plan={currentPlan}
            currentBlockIndex={getNavigation().originalIndex}
            onSkipToNext={handleSkipToNext}
            onSkipToPrevious={handleSkipToPrevious}
            onStartPause={() => setIsSessionRunning(prev => !prev)}
            isRunning={isSessionRunning}
            onCompleteSession={handleCompleteSession}
            onPauseSession={handlePauseSession}
            isLastBlock={isLastBlock()}
            onTriggerBreak={handleTriggerBreak}
            expandedBlocks={expandedBlocks}
            currentExpandedIndex={currentExpandedIndex}
            isBreakActive={isBreakActive}
            onBreakComplete={handleBreakComplete}
            onPreloadTeachingContent={async () => {}}
            onBlockClick={handleBlockClick}
          />
        )}

        {appState === 'session-complete' && (
          <CompleteView onEndSession={handleEndSession} sessionData={sessionData} />
        )}

        <ConnectTutorDialog
          open={connectTutorOpen}
          onOpenChange={setConnectTutorOpen}
          onTutorConnected={handleTutorConnected}
        />
      </div>
    </ProtectedRoute>
  );
};

export default Index;
