
import { useState, useEffect } from 'react';
import { StudyPlan, StudyBlock } from '@/components/StudyPlanEditor';
import { getBlockDuration } from '@/utils/studyPlanValidation';

export const useStudyPlanState = (initialPlan: StudyPlan) => {
  const [editingPlan, setEditingPlan] = useState<StudyPlan>(initialPlan);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Recalculate total duration whenever blocks change
  useEffect(() => {
    const totalDuration = editingPlan.blocks.reduce((sum, block) => {
      const blockDuration = getBlockDuration(block);
      return sum + blockDuration;
    }, 0);

    // Get all techniques from all blocks (including multi-technique blocks)
    const allTechniques = editingPlan.blocks.flatMap(block => {
      if (block.techniques && block.techniques.length > 0) {
        return block.techniques.map(step => (step as any).name || step.technique);
      }
      return [block.technique];
    });

    const uniqueTechniques = [...new Set(allTechniques)];
    const unitsTocover = [...new Set(editingPlan.blocks.map(b => b.unit))];

    setEditingPlan(prev => ({
      ...prev,
      total_duration: totalDuration,
      techniques: uniqueTechniques,
      units_to_cover: unitsTocover
    }));
  }, [editingPlan.blocks]);

  const updateBlock = (blockId: string, updates: Partial<StudyBlock>) => {
    setEditingPlan(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId ? { ...block, ...updates } : block
      )
    }));
  };

  const deleteBlock = (blockId: string) => {
    setEditingPlan(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId)
        .map((block, index) => ({ ...block, position: index }))
    }));
  };

  const addNewBlock = () => {
    const newBlock: StudyBlock = {
      id: `block-${Date.now()}`,
      unit: 'New Topic',
      technique: 'flashcards',
      phase: 'study',
      tool: 'flashcards',
      duration: 15,
      description: 'Custom study block',
      position: editingPlan.blocks.length,
      custom: true,
      user_notes: null,
    };

    setEditingPlan(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
  };

  const reorderBlocks = (newBlocks: StudyBlock[]) => {
    setEditingPlan(prev => ({
      ...prev,
      blocks: newBlocks
    }));
  };

  return {
    editingPlan,
    editingBlockId,
    setEditingBlockId,
    updateBlock,
    deleteBlock,
    addNewBlock,
    reorderBlocks,
  };
};
