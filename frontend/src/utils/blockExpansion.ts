import { StudyPlan } from '@/services/api';
import { StudyBlock } from '@/utils/studyPlanValidation';

export interface ExpandedBlock extends StudyBlock {
  originalBlockId: string;
  originalBlockIndex: number;
  subBlockIndex: number;
  totalSubBlocks: number;
  isLastSubBlock: boolean;
  expandedId: string; // Unique ID for expanded blocks
}

/**
 * Generates a unique ID for expanded blocks
 */
function generateUniqueExpandedId(originalId: string, suffix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `${originalId}-${suffix}-${timestamp}-${random}`;
}

/**
 * Deduplicates blocks by expanded ID
 */
function deduplicateBlocks(blocks: ExpandedBlock[]): ExpandedBlock[] {
  const seen = new Set<string>();
  const deduplicated = blocks.filter(block => {
    if (seen.has(block.expandedId)) {
      return false;
    }
    seen.add(block.expandedId);
    return true;
  });
  
  if (deduplicated.length !== blocks.length) {
  }
  
  return deduplicated;
}

/**
 * Expands multi-technique blocks into individual sequential blocks
 * Each technique becomes its own block with the same teaching content
 */
export function expandStudyBlocks(plan: StudyPlan): ExpandedBlock[] {
  const expandedBlocks: ExpandedBlock[] = [];
  
  // Clear any existing state
  const uniqueBlockIds = new Set<string>();
  
  // Sort blocks by position to ensure correct order
  const sortedBlocks = [...plan.blocks].sort((a, b) => a.position - b.position);
  
  // Validate input blocks for duplicates
  const inputBlockIds = sortedBlocks.map(b => b.id);
  const uniqueInputIds = new Set(inputBlockIds);
  if (inputBlockIds.length !== uniqueInputIds.size) {
  }
  
  sortedBlocks.forEach((block, originalIndex) => {
    
    // First, add a teaching block if this block has a description
    if (block.description) {
      const teachingExpandedId = generateUniqueExpandedId(block.id, 'teaching');
      
      // Check for duplicates before adding
      if (uniqueBlockIds.has(teachingExpandedId)) {
      } else {
        uniqueBlockIds.add(teachingExpandedId);
        
        const teachingBlock: ExpandedBlock = {
          ...block,
          id: `${block.id}-teaching`,
          expandedId: teachingExpandedId,
          technique: 'teaching',
          phase: 'teaching',
          tool: 'teaching',
          duration: 15, // Standard teaching duration
          originalBlockId: block.id,
          originalBlockIndex: originalIndex,
          subBlockIndex: -1, // Teaching comes before sub-blocks
          totalSubBlocks: (block.techniques?.length || 1) + 1, // +1 for teaching
          isLastSubBlock: false,
          techniques: undefined
        };
        
        
        expandedBlocks.push(teachingBlock);
      }
    }
    
    if (block.techniques && block.techniques.length > 1) {
      // Multi-technique block - expand into individual blocks
      
      // Sort techniques by order to ensure correct sequence
      const sortedTechniques = [...block.techniques].sort((a, b) => a.order - b.order);
      
      sortedTechniques.forEach((technique, subIndex) => {
        const tech = technique.technique;
        
        const expandedId = generateUniqueExpandedId(block.id, `${tech}-${subIndex}`);
        
        // Check for duplicates before adding
        if (uniqueBlockIds.has(expandedId)) {
        } else {
          uniqueBlockIds.add(expandedId);
          
          const expandedBlock: ExpandedBlock = {
            ...block,
            id: `${block.id}-${subIndex}`,
            expandedId: expandedId,
            technique: tech,
            phase: tech,
            tool: tech,
            duration: technique.duration,
            originalBlockId: block.id,
            originalBlockIndex: originalIndex, // Use array index, not block.position
            subBlockIndex: subIndex,
            totalSubBlocks: (block.techniques?.length || 1) + (block.description ? 1 : 0), // Include teaching if present
            isLastSubBlock: subIndex === block.techniques!.length - 1,
            // Remove techniques array for expanded blocks
            techniques: undefined
          };
          
          
          expandedBlocks.push(expandedBlock);
        }
      });
    } else {
      // Single technique block - keep as is but add expansion metadata
      const expandedId = generateUniqueExpandedId(block.id, 'single');
      
      // Check for duplicates before adding
      if (uniqueBlockIds.has(expandedId)) {
      } else {
        uniqueBlockIds.add(expandedId);
        
        const expandedBlock: ExpandedBlock = {
          ...block,
          expandedId: expandedId,
          originalBlockId: block.id,
          originalBlockIndex: originalIndex, // Use array index, not block.position
          subBlockIndex: 0,
          totalSubBlocks: 1 + (block.description ? 1 : 0), // Include teaching if present
          isLastSubBlock: true
        };
        
        
        expandedBlocks.push(expandedBlock);
      }
    }
  });
  
  // Apply deduplication as final safety measure
  const deduplicatedBlocks = deduplicateBlocks(expandedBlocks);
  
  // Final validation
  const finalIds = deduplicatedBlocks.map(b => b.expandedId);
  const finalUniqueIds = new Set(finalIds);
  
  
  if (finalIds.length !== finalUniqueIds.size) {
    console.error('CRITICAL: Final blocks still contain duplicates', {
      totalBlocks: finalIds.length,
      uniqueBlocks: finalUniqueIds.size,
      duplicateIds: finalIds.filter((id, index) => finalIds.indexOf(id) !== index)
    });
  }
  
  return deduplicatedBlocks;
}

/**
 * Groups expanded blocks back into their original block structure for navigation display
 */
export function getOriginalBlockNavigation(expandedBlocks: ExpandedBlock[], currentExpandedIndex: number) {
  const currentBlock = expandedBlocks[currentExpandedIndex];
  if (!currentBlock) return { originalIndex: 0, totalOriginalBlocks: 0 };
  
  const uniqueOriginalBlocks = new Set(expandedBlocks.map(b => b.originalBlockIndex));
  
  return {
    originalIndex: currentBlock.originalBlockIndex,
    totalOriginalBlocks: uniqueOriginalBlocks.size,
    subBlockProgress: `${currentBlock.subBlockIndex + 1}/${currentBlock.totalSubBlocks}`
  };
}
