
import { useState, useEffect } from 'react';
import StudyBlockCard from './StudyBlockCard';
import StudyPlanHeader from './StudyPlanHeader';
import AddStudyBlockCard from './AddStudyBlockCard';
import { useStudyPlanState } from '@/hooks/useStudyPlanState';
import { useStudyPlanDragDrop } from '@/hooks/useStudyPlanDragDrop';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { StudyBlock, StudyPlan, TechniqueStep } from '@/types';
export type { StudyBlock, StudyPlan, TechniqueStep } from '@/types';

interface StudyPlanEditorProps {
  plan: StudyPlan;
  onSavePlan: (updatedPlan: StudyPlan) => void;
  onStartSession: (plan: StudyPlan) => void;
  onBack: () => void;
}

const StudyPlanEditor = ({ plan, onSavePlan, onStartSession, onBack }: StudyPlanEditorProps) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const { toast } = useToast();

  const {
    editingPlan,
    editingBlockId,
    setEditingBlockId,
    updateBlock,
    deleteBlock,
    addNewBlock,
    reorderBlocks,
  } = useStudyPlanState(plan);

  const {
    draggedIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
  } = useStudyPlanDragDrop(editingPlan.blocks, reorderBlocks);

  // Track changes to detect unsaved modifications
  useEffect(() => {
    const hasChanges = JSON.stringify(editingPlan) !== JSON.stringify(plan);
    setHasUnsavedChanges(hasChanges);
  }, [editingPlan, plan]);

  const handleSave = () => {
    onSavePlan(editingPlan);
  };

  const handleStartSession = () => {
    onStartSession(editingPlan);
  };

  const handleForceStartSession = () => {
    setShowUnsavedWarning(false);
    onStartSession(editingPlan);
  };

  const handleSaveAndStart = async () => {
    setShowUnsavedWarning(false);
    await onSavePlan(editingPlan);
    onStartSession(editingPlan);
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <StudyPlanHeader
            plan={editingPlan}
            onBack={onBack}
            onSave={handleSave}
            onStartSession={handleStartSession}
            hasUnsavedChanges={hasUnsavedChanges}
          />

          <div className="space-y-6">
            {editingPlan.blocks.map((block, index) => (
              <StudyBlockCard
                key={block.id}
                block={block}
                index={index}
                isEditing={editingBlockId === block.id}
                isDragged={draggedIndex === index}
                onEdit={() => setEditingBlockId(editingBlockId === block.id ? null : block.id)}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onDelete={() => deleteBlock(block.id)}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              />
            ))}

            <AddStudyBlockCard onAddBlock={addNewBlock} />
          </div>
        </div>
      </div>

      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your study plan. Would you like to save them before starting the session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedWarning(false)}>
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleForceStartSession} variant="outline">
              Start Without Saving
            </Button>
            <AlertDialogAction onClick={handleSaveAndStart}>
              Save & Start Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StudyPlanEditor;
