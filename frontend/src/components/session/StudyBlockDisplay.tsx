
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudyBlock } from '@/types';
import type { ExpandedBlock } from '@/utils/blockExpansion';
import { getTechniqueIcon, getTechniqueLabel } from '@/lib/techniques';

interface StudyBlockDisplayProps {
  blocks: StudyBlock[];
  currentBlockIndex: number;
  isLastBlock?: boolean;
  onCompleteSession?: () => void;
  onPauseSession?: () => void;
  expandedBlocks?: ExpandedBlock[];
  currentExpandedIndex?: number;
  onBlockClick?: (blockIndex: number) => void;
}

const StudyBlockDisplay = ({ 
  blocks, 
  currentBlockIndex, 
  isLastBlock = false, 
  onCompleteSession,
  onPauseSession,
  expandedBlocks = [],
  currentExpandedIndex = 0,
  onBlockClick
}: StudyBlockDisplayProps) => {
  
  // Enhanced technique display for multi-technique blocks
  const TechniqueIndicators = ({ block, isActive, isCompleted }: { 
    block: StudyBlock; 
    isActive: boolean; 
    isCompleted: boolean;
  }) => {
    // Enhanced debug logging
    
    // Check if this is an expanded block with sub-techniques
    const blockIndex = blocks.findIndex(b => b.id === block.id);
    
    // Use expandedId for more reliable matching if available
    const relatedExpandedBlocks = expandedBlocks.filter(eb => {
      const matchByIndex = eb.originalBlockIndex === blockIndex;
      const matchByOriginalId = eb.originalBlockId === block.id;
      return matchByIndex || matchByOriginalId;
    });
    
    // Deduplicate related blocks by expandedId - only if expandedId exists
    const uniqueRelatedBlocks = relatedExpandedBlocks.filter((block, index, arr) => 
      !block.expandedId || index === arr.findIndex(b => b.expandedId === block.expandedId)
    );
    
    
    if (uniqueRelatedBlocks.length === 0) {
      // No sub-techniques, show single icon
      const TechniqueIcon = getTechniqueIcon(block.technique);
      return (
        <div className="flex items-center gap-1">
          <TechniqueIcon className="w-3 h-3" />
        </div>
      );
    }
    
    // Multiple techniques - show indicator dots using unique blocks
    return (
      <div className="flex items-center gap-1 mt-1">
        {uniqueRelatedBlocks.map((subBlock, index) => {
          const SubIcon = getTechniqueIcon(subBlock.technique);
          const currentBlockExpandedId = expandedBlocks[currentExpandedIndex]?.expandedId || expandedBlocks[currentExpandedIndex]?.id;
          const subBlockExpandedId = subBlock.expandedId || subBlock.id;
          const isCurrentSubBlock = isActive && currentExpandedIndex >= 0 && currentBlockExpandedId === subBlockExpandedId;
          const isCompletedSubBlock = isActive && currentExpandedIndex >= 0 && 
            expandedBlocks.findIndex(eb => (eb.expandedId || eb.id) === subBlockExpandedId) < currentExpandedIndex;
          
          return (
            <div
              key={subBlock.expandedId || subBlock.id} // Use expandedId for React key, fallback to id
              className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${
                isCurrentSubBlock
                  ? 'bg-white text-indigo-600 ring-2 ring-white shadow-sm scale-110' 
                  : isCompletedSubBlock
                  ? 'bg-white/80 text-indigo-600'
                  : isActive
                  ? 'bg-white/40 text-white/80'
                  : isCompleted
                  ? 'bg-white/60 text-indigo-600'
                  : 'bg-gray-300 text-gray-500'
              }`}
              title={getTechniqueLabel(subBlock.technique)}
            >
              <SubIcon className="w-3 h-3" />
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div className="w-full bg-gray-50 py-6 px-6 border-b border-gray-200">
      <div className="flex items-center justify-center max-w-7xl mx-auto">
        {/* Study blocks navigation with connecting lines */}
        <div className="flex items-center">
          {blocks.map((block, index) => {
            const BlockIcon = getTechniqueIcon(block.technique);
            const label = getTechniqueLabel(block.technique);
            const isActive = index === currentBlockIndex;
            const isCompleted = index < currentBlockIndex;
            const isUpcoming = index > currentBlockIndex;
            
            return (
              <div key={block.id} className="flex items-center">
                 <button
                   onClick={() => onBlockClick?.(index)}
                   disabled={!onBlockClick}
                   className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl transition-all duration-300 relative hover-scale ${
                     onBlockClick ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'
                   } ${
                     isActive 
                       ? 'bg-indigo-500 text-white shadow-lg ring-4 ring-indigo-200 ring-opacity-30' 
                       : isCompleted
                       ? 'bg-indigo-500 text-white shadow-md hover:bg-indigo-600'
                       : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                   }`}
                 >
                   <div className="flex items-center mb-2">
                     <div className="flex flex-col">
                       <div className="text-sm font-medium">
                         {block.unit}
                       </div>
                       <div className="text-xs opacity-80">
                         {block.duration}min
                       </div>
                     </div>
                   </div>
                   
                   {/* Professional technique indicators */}
                   <TechniqueIndicators 
                     block={block} 
                     isActive={isActive} 
                     isCompleted={isCompleted} 
                   />
                   
                   {/* Subtle active indicator */}
                   {isActive && (
                     <div className="absolute inset-0 rounded-xl bg-indigo-400 opacity-10 animate-pulse" style={{ animationDuration: '3s' }}></div>
                   )}
                 </button>
                
                {/* Dashed connecting line between blocks */}
                {index < blocks.length - 1 && (
                  <div className="flex items-center mx-4">
                    <div 
                      className={`h-0.5 w-8 transition-colors duration-300 ${
                        index < currentBlockIndex 
                          ? 'bg-indigo-500' 
                          : 'border-t-2 border-dashed border-gray-300'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Session Action Button - Always show */}
          <div className="flex items-center mx-4">
            <div className="h-0.5 w-8 border-t-2 border-dashed border-gray-300" />
          </div>
          
          <Button
            onClick={() => {
              if (isLastBlock) {
                onCompleteSession?.();
              } else {
                onPauseSession?.();
              }
            }}
            className={`${isLastBlock ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'} text-white px-4 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center min-h-[80px]`}
          >
            <Check className="w-5 h-5 mr-3" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {isLastBlock ? 'Complete' : 'Pause'}
              </span>
              <span className="text-xs opacity-80">Session</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudyBlockDisplay;
