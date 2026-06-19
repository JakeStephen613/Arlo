import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, BookOpen, Brain, Target } from 'lucide-react';
import type { StudyMode } from '@/hooks/useStudySession';

interface StudyTechnique {
  id: string;
  type: 'pomodoro' | 'flashcards' | 'quiz' | 'mindmap' | 'notes';
  title: string;
  description: string;
  duration: number;
  topic: string;
  isActive?: boolean;
  isCompleted?: boolean;
}

interface StudyTechniquesProps {
  onSelectTechnique: (mode: StudyMode) => void;
}

const StudyTechniques = ({ onSelectTechnique }: StudyTechniquesProps) => {
  const [techniques, setTechniques] = useState<StudyTechnique[]>([]);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Mock study techniques - replace with API call to /api/study-session
  useEffect(() => {
    const mockTechniques: StudyTechnique[] = [
      {
        id: '1',
        type: 'pomodoro',
        title: 'Pomodoro Focus Session',
        description: 'Deep focus session with 25-minute intervals',
        duration: 25,
        topic: 'Mathematics - Algebra Basics'
      },
      {
        id: '2',
        type: 'flashcards',
        title: 'Interactive Flashcards',
        description: 'Review key concepts with spaced repetition',
        duration: 15,
        topic: 'Mathematics - Key Formulas'
      },
      {
        id: '3',
        type: 'quiz',
        title: 'Knowledge Check Quiz',
        description: 'Test your understanding with adaptive questions',
        duration: 10,
        topic: 'Mathematics - Problem Solving'
      },
      {
        id: '4',
        type: 'mindmap',
        title: 'Concept Mind Map',
        description: 'Visualize connections between topics',
        duration: 20,
        topic: 'Mathematics - Concept Relationships'
      }
    ];
    setTechniques(mockTechniques);
  }, []);

  const getTechniqueIcon = (type: string) => {
    switch (type) {
      case 'pomodoro': return <Clock className="w-5 h-5" />;
      case 'flashcards': return <BookOpen className="w-5 h-5" />;
      case 'quiz': return <Target className="w-5 h-5" />;
      case 'mindmap': return <Brain className="w-5 h-5" />;
      default: return <BookOpen className="w-5 h-5" />;
    }
  };

  const getTechniqueColor = (type: string) => {
    switch (type) {
      case 'pomodoro': return 'bg-red-100 text-red-700 border-red-200';
      case 'flashcards': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'quiz': return 'bg-green-100 text-green-700 border-green-200';
      case 'mindmap': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const startTechnique = async (technique: StudyTechnique) => {
    // Map technique types to StudyMode
    const techniqueToModeMap: Record<string, StudyMode> = {
      'flashcards': 'flashcards',
      'quiz': 'quiz',
      'pomodoro': 'feynman', // Map pomodoro to feynman for now
      'mindmap': 'blurting', // Map mindmap to blurting for now
      'notes': 'blurting'
    };

    const mode = techniqueToModeMap[technique.type];
    if (mode) {
      onSelectTechnique(mode);
    }

    // TODO: Call respective API endpoint based on technique type
    // e.g., /api/techniques/pomodoro, /api/techniques/flashcards, etc.
    
    // Update context API
    try {
      // TODO: Replace with actual API call
      // await fetch('/api/context/update', { method: 'POST', body: JSON.stringify(contextData) });
    } catch (error) {
      console.error('Failed to update context:', error);
    }

    // Start timer for pomodoro technique
    if (technique.type === 'pomodoro') {
      setActiveTimer(technique.id);
      setTimeRemaining(technique.duration * 60); // Convert to seconds
    }

    // Mark as active
    setTechniques(prev => prev.map(t => 
      t.id === technique.id ? { ...t, isActive: true } : t
    ));
  };

  const pauseTechnique = (techniqueId: string) => {
    setActiveTimer(null);
    setTechniques(prev => prev.map(t => 
      t.id === techniqueId ? { ...t, isActive: false } : t
    ));
  };

  const completeTechnique = (techniqueId: string) => {
    setActiveTimer(null);
    setTechniques(prev => prev.map(t => 
      t.id === techniqueId ? { ...t, isActive: false, isCompleted: true } : t
    ));
  };

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTimer && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            completeTechnique(activeTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Study Plan</h2>
        <p className="text-gray-600">Complete each technique to master your topic</p>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
        {techniques.map((technique, index) => (
          <Card 
            key={technique.id} 
            className={`transition-all duration-200 hover:shadow-md ${
              technique.isActive ? 'ring-2 ring-indigo-500 bg-indigo-50' : 
              technique.isCompleted ? 'bg-green-50 opacity-75' : 'hover:shadow-lg'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getTechniqueColor(technique.type)}`}>
                    {getTechniqueIcon(technique.type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {technique.title}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{technique.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {technique.duration} min
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Topic:</p>
                  <p className="text-sm text-gray-600">{technique.topic}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {technique.isActive && activeTimer === technique.id && (
                    <div className="text-lg font-mono font-bold text-indigo-600">
                      {formatTime(timeRemaining)}
                    </div>
                  )}
                  
                  {technique.isCompleted ? (
                    <Badge className="bg-green-500 text-white">Completed ✓</Badge>
                  ) : technique.isActive ? (
                    <Button
                      onClick={() => pauseTechnique(technique.id)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={() => startTechnique(technique)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1"
                      size="sm"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default StudyTechniques;
