import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { TechniqueStep } from '@/utils/studyPlanValidation';

const TECHNIQUE_OPTIONS = [
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'feynman', label: 'Feynman Technique' },
  { value: 'blurting', label: 'Blurting' },
  { value: 'arlo_chat', label: 'ARLO Chat' },
  { value: 'arlo_teaching', label: 'ARLO Teaching' },
  { value: 'mindmap', label: 'Mind Map' },
  { value: 'review-sheet', label: 'Review Sheet' }
];

interface TechniqueSequenceEditorProps {
  techniques: TechniqueStep[];
  onChange: (techniques: TechniqueStep[]) => void;
}

export const TechniqueSequenceEditor: React.FC<TechniqueSequenceEditorProps> = ({
  techniques,
  onChange
}) => {
  const addTechnique = () => {
    const newTechnique: TechniqueStep = {
      technique: 'flashcards',
      duration: 15,
      order: techniques.length + 1,
      description: ''
    };
    onChange([...techniques, newTechnique]);
  };

  const updateTechnique = (index: number, updates: Partial<TechniqueStep>) => {
    const updated = techniques.map((technique, i) => 
      i === index ? { ...technique, ...updates } : technique
    );
    onChange(updated);
  };

  const removeTechnique = (index: number) => {
    const updated = techniques.filter((_, i) => i !== index)
      .map((technique, i) => ({ ...technique, order: i + 1 }));
    onChange(updated);
  };

  const moveTechnique = (fromIndex: number, toIndex: number) => {
    const updated = [...techniques];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    
    // Update order numbers
    const reordered = updated.map((technique, i) => ({ ...technique, order: i + 1 }));
    onChange(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Study Techniques Sequence</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addTechnique}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Technique
        </Button>
      </div>

      {techniques.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No techniques added yet</p>
              <Button onClick={addTechnique} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Technique
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {techniques.map((technique, index) => (
            <Card key={index} className="relative">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <span>Step {technique.order}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTechnique(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Technique</Label>
                    <Select
                      value={technique.technique}
                      onValueChange={(value) => updateTechnique(index, { technique: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TECHNIQUE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Duration (minutes)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={technique.duration}
                      onChange={(e) => updateTechnique(index, { 
                        duration: parseInt(e.target.value) || 15 
                      })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Step Instructions (optional)</Label>
                  <Textarea
                    value={technique.description || ''}
                    onChange={(e) => updateTechnique(index, { description: e.target.value })}
                    placeholder="Optional instructions for this technique step..."
                    className="text-sm"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};