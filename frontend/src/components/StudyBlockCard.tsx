
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Edit3, Trash2, GripVertical, MessageCircle, Layers } from 'lucide-react';
import { StudyBlock, TechniqueStep, getBlockDuration, getBlockTechniques, getPrimaryTechnique } from '@/utils/studyPlanValidation';

interface StudyBlockCardProps {
  block: StudyBlock;
  index: number;
  isEditing: boolean;
  isDragged: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<StudyBlock>) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const TECHNIQUE_OPTIONS = [{
  value: 'flashcards',
  label: 'Flashcards',
  component: 'FlashcardsMode'
}, {
  value: 'feynman',
  label: 'Feynman Technique',
  component: 'FeynmanMode'
}, {
  value: 'blurting',
  label: 'Blurting Method',
  component: 'BlurtingMode'
}, {
  value: 'quiz',
  label: 'Quiz Mode',
  component: 'QuizMode'
}];

const StudyBlockCard = ({
  block,
  index,
  isEditing,
  isDragged,
  onEdit,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}: StudyBlockCardProps) => {
  // Initialize selectedTechniques from the actual backend data
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>(() => {
    // Get the actual techniques from the backend data
    const techniques = getBlockTechniques(block);

    // Remove duplicates and return
    const uniqueTechniques = [...new Set(techniques)];
    return uniqueTechniques;
  });

  const updateTechniques = (techniques: string[]) => {
    setSelectedTechniques(techniques);

    // Create technique steps with equal time distribution
    const timePerTechnique = Math.floor(block.duration / Math.max(techniques.length, 1));
    const techniqueSteps: TechniqueStep[] = techniques.map((technique, index) => ({
      technique,
      order: index + 1,
      duration: timePerTechnique,
      description: `${technique} session`
    }));

    // Update the block
    const primaryTechnique = techniques[0] || 'flashcards';
    const techniqueOption = TECHNIQUE_OPTIONS.find(opt => opt.value === primaryTechnique);
    onUpdate({
      techniques: techniqueSteps,
      technique: primaryTechnique,
      tool: primaryTechnique,
    });
  };

  const updateTechnique = (technique: string) => {
    const techniqueOption = TECHNIQUE_OPTIONS.find(opt => opt.value === technique);
    if (techniqueOption) {
      // Create a single technique step for backwards compatibility
      const singleTechniqueStep: TechniqueStep = {
        technique,
        order: 1,
        duration: block.duration,
        description: `${technique} session`
      };
      
      onUpdate({
        technique,
        tool: technique,
        techniques: [singleTechniqueStep]
      });
    }
  };

  const getTechniqueColor = (technique: string) => {
    const colors = {
      flashcards: 'bg-blue-100 text-blue-800 border-blue-200',
      feynman: 'bg-green-100 text-green-800 border-green-200',
      blurting: 'bg-purple-100 text-purple-800 border-purple-200',
      quiz: 'bg-orange-100 text-orange-800 border-orange-200',
      default: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[technique as keyof typeof colors] || colors.default;
  };

  return (
    <Card 
      className={`bg-white/80 backdrop-blur-sm border border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 cursor-move rounded-xl ${
        isDragged ? 'opacity-50 scale-95' : 'hover:scale-[1.02]'
      } ${isEditing ? 'ring-2 ring-primary/30 border-primary/30' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gradient-to-br from-muted/50 to-muted/20 rounded-lg">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab hover:text-foreground transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm font-semibold text-primary">Block {index + 1}</span>
              </div>
              {selectedTechniques.length > 1 ? (
                <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-secondary/20 to-secondary/10 rounded-lg border border-secondary/30">
                  <Layers className="w-3 h-3 text-secondary-foreground" />
                  <span className="text-xs font-medium text-secondary-foreground">{selectedTechniques.length} techniques</span>
                </div>
              ) : (
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border shadow-sm ${getTechniqueColor(getPrimaryTechnique(block))}`}>
                  {getPrimaryTechnique(block)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-lg">
              <Clock className="w-4 h-4" />
              {getBlockDuration(block)} min
            </div>
            <Button onClick={onEdit} variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button onClick={onDelete} variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        {isEditing ? (
          <div className="space-y-4 p-4 bg-muted/20 rounded-lg border border-border/50">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor={`unit-${block.id}`} className="text-sm">Topic/Unit</Label>
                <Input 
                  id={`unit-${block.id}`}
                  value={block.unit}
                  onChange={(e) => onUpdate({ unit: e.target.value })}
                />
              </div>
              
              <div className="w-24">
                <Label htmlFor={`duration-${block.id}`} className="text-sm">Duration (min)</Label>
                <Input 
                  id={`duration-${block.id}`}
                  type="number"
                  value={block.duration}
                  onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || 0 })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor={`description-${block.id}`} className="text-sm">Description</Label>
                <Textarea 
                  id={`description-${block.id}`}
                  value={block.description}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  className="min-h-[120px] resize-none"
                />
              </div>
              
              <div className="w-48">
                <Label className="text-sm">Study Techniques</Label>
                
                <div className="flex flex-wrap gap-1">
                  {TECHNIQUE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`px-2 py-1 text-xs border rounded-full transition-colors ${
                        selectedTechniques.includes(option.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (selectedTechniques.includes(option.value)) {
                          updateTechniques(selectedTechniques.filter(t => t !== option.value));
                        } else {
                          updateTechniques([...selectedTechniques, option.value]);
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h4 className="text-lg font-bold text-foreground mb-2">{block.unit}</h4>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{block.description}</p>
            
            {/* Show selected techniques */}
            {selectedTechniques.length > 1 && (
              <div className="space-y-3 p-3 bg-gradient-to-r from-secondary/10 to-secondary/5 rounded-lg border border-secondary/20">
                <h5 className="text-xs font-bold text-secondary-foreground uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-3 h-3" />
                  Technique Sequence
                </h5>
                <div className="flex flex-wrap gap-2">
                  {selectedTechniques.map((technique, index) => (
                    <div key={`${technique}-${index}`} className="flex items-center gap-2">
                      <span className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border shadow-sm ${getTechniqueColor(technique)}`}>
                        {technique}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                        ~{Math.floor(block.duration / selectedTechniques.length)}m
                      </span>
                      {index < selectedTechniques.length - 1 && (
                        <span className="text-muted-foreground text-lg">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudyBlockCard;
