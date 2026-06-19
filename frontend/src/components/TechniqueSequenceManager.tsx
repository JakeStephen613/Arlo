import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, Clock, CheckCircle, PlayCircle } from 'lucide-react';
import { TechniqueStep } from '@/utils/studyPlanValidation';

interface TechniqueSequenceManagerProps {
  techniques: TechniqueStep[];
  currentTechniqueIndex: number;
  onTechniqueComplete: () => void;
  onSequenceComplete: () => void;
  blockName: string;
  isActive: boolean;
}

export const TechniqueSequenceManager: React.FC<TechniqueSequenceManagerProps> = ({
  techniques,
  currentTechniqueIndex,
  onTechniqueComplete,
  onSequenceComplete,
  blockName,
  isActive
}) => {
  const currentTechnique = techniques[currentTechniqueIndex];
  const progress = ((currentTechniqueIndex + 1) / techniques.length) * 100;
  const totalDuration = techniques.reduce((sum, step) => sum + step.duration, 0);
  const completedDuration = techniques.slice(0, currentTechniqueIndex).reduce((sum, step) => sum + step.duration, 0);

  if (!currentTechnique) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {blockName} - Technique Sequence
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            Step {currentTechniqueIndex + 1} of {techniques.length}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{completedDuration + (isActive ? currentTechnique.duration : 0)}/{totalDuration} min</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Technique */}
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border">
          <PlayCircle className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h4 className="font-medium capitalize">{currentTechnique.technique}</h4>
            {currentTechnique.description && (
              <p className="text-sm text-muted-foreground mt-1">{currentTechnique.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {currentTechnique.duration} min
          </div>
        </div>

        {/* Upcoming Techniques */}
        {techniques.slice(currentTechniqueIndex + 1).length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-muted-foreground">Coming Next:</h5>
            <div className="space-y-2">
              {techniques.slice(currentTechniqueIndex + 1, currentTechniqueIndex + 3).map((technique, index) => {
                const actualIndex = currentTechniqueIndex + 1 + index;
                return (
                  <div key={actualIndex} className="flex items-center gap-3 p-2 bg-muted/30 rounded text-sm">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                      {actualIndex + 1}
                    </div>
                    <span className="flex-1 capitalize">{technique.technique}</span>
                    <span className="text-muted-foreground">{technique.duration}m</span>
                  </div>
                );
              })}
              {techniques.slice(currentTechniqueIndex + 3).length > 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{techniques.slice(currentTechniqueIndex + 3).length} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completed Techniques */}
        {currentTechniqueIndex > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-muted-foreground">Completed:</h5>
            <div className="flex flex-wrap gap-2">
              {techniques.slice(0, currentTechniqueIndex).map((technique, index) => (
                <div key={index} className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  <CheckCircle className="h-3 w-3" />
                  <span className="capitalize">{technique.technique}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {currentTechniqueIndex === techniques.length - 1 ? 'Final technique in sequence' : 'Complete this technique to continue'}
          </div>
          <Button 
            onClick={currentTechniqueIndex === techniques.length - 1 ? onSequenceComplete : onTechniqueComplete}
            className="ml-auto"
          >
            {currentTechniqueIndex === techniques.length - 1 ? 'Complete Block' : 'Next Technique'}
            {currentTechniqueIndex < techniques.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};