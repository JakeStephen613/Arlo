
import type { TechniqueStep, StudyBlock, StudyPlan } from '@/types';
export type { TechniqueStep, StudyBlock, StudyPlan } from '@/types';

// Valid study techniques mapping
const VALID_TECHNIQUES = {
  'flashcards': 'flashcards',
  'quiz': 'quiz',
  'feynman': 'feynman',
  'blurting': 'blurting',
  'blurring': 'blurting', // Fix the typo
  'arlo_chat': 'arlo_chat',
  'arlo_teaching': 'arlo_teaching',
  'mindmap': 'mindmap',
  'review-sheet': 'review-sheet'
} as const;

/**
 * Gets the total duration for a study block (handles both legacy and multi-technique blocks)
 */
export const getBlockDuration = (block: StudyBlock): number => {
  if (block.techniques && block.techniques.length > 0) {
    return block.techniques.reduce((total, step) => total + step.duration, 0);
  }
  return block.duration;
};

/**
 * Gets all techniques for a block (handles both legacy and multi-technique blocks)
 */
export const getBlockTechniques = (block: StudyBlock): string[] => {
  
  if (block.techniques && block.techniques.length > 0) {
    const techniques = block.techniques.map(step => step.technique);
    return techniques;
  }
  
  return [block.technique];
};

/**
 * Gets the primary technique for a block (first technique in sequence or legacy technique)
 */
export const getPrimaryTechnique = (block: StudyBlock): string => {
  if (block.techniques && block.techniques.length > 0) {
    return block.techniques[0].technique;
  }
  return block.technique;
};

/**
 * Helper function to extract technique name from various formats
 */
const extractTechniqueName = (techniqueItem: any): string => {
  if (typeof techniqueItem === 'string') {
    return techniqueItem;
  }
  if (typeof techniqueItem === 'object' && techniqueItem !== null) {
    return techniqueItem.technique || techniqueItem.name || 'flashcards';
  }
  return 'flashcards';
};

/**
 * Validates and corrects study plan data, fixing common typos like "blurring" -> "blurting"
 * Now preserves the actual technique data from backend instead of overriding it
 */
export const validateAndFixStudyPlan = (plan: StudyPlan): StudyPlan => {
  
  const correctedBlocks = plan.blocks.map((block, index) => {
    
    // If the block already has proper techniques array from backend, preserve it
    if (block.techniques && Array.isArray(block.techniques) && block.techniques.length > 0) {
      
      // Convert techniques array to proper format
      const validatedTechniques = block.techniques.map((techniqueItem, techniqueIndex) => {
        const rawTechnique = extractTechniqueName(techniqueItem);
        const validatedTechnique = VALID_TECHNIQUES[rawTechnique.toLowerCase() as keyof typeof VALID_TECHNIQUES] || rawTechnique;
        
        return {
          technique: validatedTechnique,
          duration: (typeof techniqueItem === 'object' && techniqueItem.duration) 
            ? techniqueItem.duration 
            : Math.floor(block.duration / block.techniques.length),
          order: (typeof techniqueItem === 'object' && techniqueItem.order) 
            ? techniqueItem.order 
            : techniqueIndex + 1,
          description: (typeof techniqueItem === 'object' && techniqueItem.description) 
            ? techniqueItem.description 
            : `${validatedTechnique} session`
        };
      });
      
      const primaryTechnique = validatedTechniques[0].technique;
      
      return {
        ...block,
        technique: primaryTechnique,
        techniques: validatedTechniques,
        phase: primaryTechnique,
        tool: primaryTechnique,
      };
    }

    // Handle legacy single technique blocks
    const validatedTechnique = VALID_TECHNIQUES[block.technique.toLowerCase() as keyof typeof VALID_TECHNIQUES] || block.technique;

    return {
      ...block,
      technique: validatedTechnique,
      phase: validatedTechnique,
      tool: validatedTechnique,
      techniques: [{
        technique: validatedTechnique,
        duration: block.duration,
        order: 1,
        description: `${validatedTechnique} session`
      }]
    };
  });
  
  const correctedPlan = {
    ...plan,
    blocks: correctedBlocks
  };
  
  return correctedPlan;
};

export const validateStudyBlock = (block: StudyBlock): StudyBlock => {
  const correctedTechnique = VALID_TECHNIQUES[block.technique.toLowerCase() as keyof typeof VALID_TECHNIQUES] || block.technique;
  return { ...block, technique: correctedTechnique, phase: correctedTechnique, tool: correctedTechnique };
};
