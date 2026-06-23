
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, BookOpen, Play, Brain, Target, MessageCircle } from 'lucide-react';
import { fetchTeachingContent } from '@/services/teachingApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import UniversalLoadingScreen from '@/components/common/loading/UniversalLoadingScreen';
import TeachingSetup from './TeachingSetup';

interface TeachingLesson {
  title: string;
  content: string | string[];
}

interface TeachingModeProps {
  description: string;
  onComplete: (preloadedData?: any) => void;
  onBack?: () => void;
  techniqueName: string;
  technique: string;
  preloadedContent?: {
    lessons?: any[];
    technique?: string;
    description?: string;
  } | null;
  isLastTechniqueOfSession?: boolean;
}

const TeachingMode = ({ description, onComplete, onBack, techniqueName, technique, preloadedContent, isLastTechniqueOfSession = false }: TeachingModeProps) => {
  const { user, getAuthToken } = useAuth();
  const [lessons, setLessons] = useState<TeachingLesson[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const { toast } = useToast();
  const hasLoadedRef = useRef(false);

  // Helper function to validate user session
  const validateSession = async () => {
    try {
      const token = await getAuthToken();
      if (!token || !user) {
        console.error('Session validation failed - no token or user');
        toast({
          title: "Session expired",
          description: "Please sign in again to continue",
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  };

  // Enhanced content parsing function that handles the backend's escaped formatting
  const parseContent = (content: string | string[]) => {
    if (!content) return <div></div>;
    
    // Handle array content by joining with double newlines
    let contentString = '';
    if (Array.isArray(content)) {
      contentString = content.join('\n\n');
    } else {
      contentString = content;
    }
    
    // First, properly unescape the content from the backend
    let processedContent = contentString
      .replace(/\\n\\n/g, '\n\n') // Double newlines become paragraph breaks
      .replace(/\\n/g, '\n')       // Single newlines
      .replace(/\\\"/g, '"')       // Escaped quotes
      .replace(/\\\\/g, '\\');     // Escaped backslashes

    // Split into sections by double newlines (paragraph breaks)
    const sections = processedContent.split('\n\n').filter(section => section.trim());

    return (
      <div className="space-y-4">
        {sections.map((section, sectionIndex) => {
          const trimmedSection = section.trim();
          
          // Handle sections that start with **bold text:**
          if (trimmedSection.includes('**') && trimmedSection.includes(':')) {
            const lines = trimmedSection.split('\n');
            const processedLines = [];
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              // Check if this line starts a bullet list
              if (line.startsWith('* ')) {
                // Collect all bullet points from this position
                const bulletPoints = [];
                let j = i;
                
                while (j < lines.length) {
                  const bulletLine = lines[j].trim();
                  if (bulletLine.startsWith('* ')) {
                    bulletPoints.push(bulletLine.substring(2).trim());
                    j++;
                  } else if (bulletLine.startsWith('  * ') || bulletLine.startsWith('   * ')) {
                    // Nested bullet point
                    bulletPoints.push(bulletLine.substring(bulletLine.indexOf('* ') + 2).trim());
                    j++;
                  } else if (bulletLine === '') {
                    j++;
                  } else {
                    break;
                  }
                }
                
                if (bulletPoints.length > 0) {
                  processedLines.push(
                    <ul key={`bullets-${i}`} className="space-y-3 my-3 ml-1">
                      {bulletPoints.map((point, idx) => (
                        <li key={idx} className="text-gray-700 leading-relaxed flex items-start gap-2">
                          <span className="inline-block w-2 h-2 mt-2 rounded-full bg-forest-400 flex-shrink-0" />
                          <span dangerouslySetInnerHTML={{ __html: parseBoldText(point) }} />
                        </li>
                      ))}
                    </ul>
                  );
                  i = j - 1; // Skip processed lines
                  continue;
                }
              }
              
              // Check if this line starts a numbered list
              if (/^\d+\.\s/.test(line)) {
                // Collect all numbered items from this position
                const numberedItems = [];
                let j = i;
                
                while (j < lines.length) {
                  const numberedLine = lines[j].trim();
                  if (/^\d+\.\s/.test(numberedLine)) {
                    numberedItems.push(numberedLine.replace(/^\d+\.\s/, ''));
                    j++;
                  } else if (numberedLine === '') {
                    j++;
                  } else {
                    break;
                  }
                }
                
                if (numberedItems.length > 0) {
                  processedLines.push(
                    <ol key={`numbers-${i}`} className="space-y-3 my-3 ml-1 list-none">
                      {numberedItems.map((item, idx) => (
                        <li key={idx} className="text-gray-700 leading-relaxed flex items-start gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-forest-100 text-forest-700 text-xs font-bold flex-shrink-0">{idx + 1}</span>
                          <span dangerouslySetInnerHTML={{ __html: parseBoldText(item) }} />
                        </li>
                      ))}
                    </ol>
                  );
                  i = j - 1; // Skip processed lines
                  continue;
                }
              }
              
              // Regular line - check for bold formatting
              if (line) {
                processedLines.push(
                  <div key={`line-${i}`} className="mb-2 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: parseBoldText(line) }} />
                  </div>
                );
              }
            }
            
            return (
              <div key={sectionIndex} className="mb-4">
                {processedLines}
              </div>
            );
          }
          
          // Handle sections that are primarily bullet points
          if (trimmedSection.includes('\n* ') || trimmedSection.startsWith('* ')) {
            const lines = trimmedSection.split('\n');
            const beforeBullets = [];
            const bulletPoints = [];
            let inBullets = false;
            
            lines.forEach(line => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('* ')) {
                inBullets = true;
                bulletPoints.push(trimmedLine.substring(2).trim());
              } else if (inBullets && (trimmedLine.startsWith('  * ') || trimmedLine.startsWith('   * '))) {
                bulletPoints.push(trimmedLine.substring(trimmedLine.indexOf('* ') + 2).trim());
              } else if (!inBullets && trimmedLine) {
                beforeBullets.push(trimmedLine);
              }
            });
            
            return (
              <div key={sectionIndex} className="mb-4">
                {beforeBullets.length > 0 && (
                  <div className="mb-3">
                    {beforeBullets.map((line, lineIndex) => (
                      <div key={lineIndex} className="mb-2 leading-relaxed">
                        <span dangerouslySetInnerHTML={{ __html: parseBoldText(line) }} />
                      </div>
                    ))}
                  </div>
                )}
                {bulletPoints.length > 0 && (
                  <ul className="space-y-3 ml-1">
                    {bulletPoints.map((point, index) => (
                      <li key={index} className="text-gray-700 leading-relaxed flex items-start gap-2">
                        <span className="inline-block w-2 h-2 mt-2 rounded-full bg-forest-400 flex-shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: parseBoldText(point) }} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }
          
          // Handle sections that are primarily numbered lists
          if (trimmedSection.includes('\n1. ') || /^\d+\.\s/.test(trimmedSection)) {
            const lines = trimmedSection.split('\n');
            const beforeNumbers = [];
            const numberedItems = [];
            let inNumbers = false;
            
            lines.forEach(line => {
              const trimmedLine = line.trim();
              if (/^\d+\.\s/.test(trimmedLine)) {
                inNumbers = true;
                numberedItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
              } else if (!inNumbers && trimmedLine) {
                beforeNumbers.push(trimmedLine);
              }
            });
            
            return (
              <div key={sectionIndex} className="mb-4">
                {beforeNumbers.length > 0 && (
                  <div className="mb-3">
                    {beforeNumbers.map((line, lineIndex) => (
                      <div key={lineIndex} className="mb-2 leading-relaxed">
                        <span dangerouslySetInnerHTML={{ __html: parseBoldText(line) }} />
                      </div>
                    ))}
                  </div>
                )}
                {numberedItems.length > 0 && (
                  <ol className="space-y-3 ml-1 list-none">
                    {numberedItems.map((item, index) => (
                      <li key={index} className="text-gray-700 leading-relaxed flex items-start gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-forest-100 text-forest-700 text-xs font-bold flex-shrink-0">{index + 1}</span>
                        <span dangerouslySetInnerHTML={{ __html: parseBoldText(item) }} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          }
          
          // Handle regular paragraph sections
          const lines = trimmedSection.split('\n').filter(line => line.trim());
          return (
            <div key={sectionIndex} className="mb-4">
              {lines.map((line, lineIndex) => (
                <div key={lineIndex} className="mb-2 leading-relaxed">
                  <span dangerouslySetInnerHTML={{ __html: parseBoldText(line.trim()) }} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const parseBoldText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-forest-900 font-semibold">$1</strong>')
      .replace(/__(.*?)__/g, '<span class="underline decoration-forest-300 decoration-2 underline-offset-2">$1</span>');
  };

  const loadTeachingContent = async () => {
    if (hasLoadedRef.current) return;
    
    try {
      
      setIsLoading(true);
      setError(null);
      hasLoadedRef.current = true;

      // Validate session before making API calls
      const isValidSession = await validateSession();
      if (!isValidSession) {
        console.error('[TEACHING MODE] Session validation failed');
        setError('Session expired. Please sign in again.');
        return;
      }
      
      
      const response = await fetchTeachingContent(description);
      
      let lessonData: TeachingLesson[] = [];
      
      if (response.lesson && Array.isArray(response.lesson)) {
        lessonData = response.lesson;
      } else if (response.lessons && Array.isArray(response.lessons)) {
        lessonData = response.lessons;
      } else if (Array.isArray(response)) {
        lessonData = response;
      }

      if (lessonData && lessonData.length > 0) {
        // Merge title-only blocks with the next block
        const merged: TeachingLesson[] = [];
        for (let i = 0; i < lessonData.length; i++) {
          const lesson = lessonData[i];
          const contentStr = Array.isArray(lesson.content) ? lesson.content.join('') : (lesson.content || '');
          const isEmptyContent = !contentStr.trim() || contentStr.trim() === '---' || contentStr.trim() === lesson.title?.trim();

          if (isEmptyContent && i + 1 < lessonData.length) {
            // Merge this title into the next block
            const next = lessonData[i + 1];
            merged.push({ title: lesson.title || next.title, content: next.content });
            i++; // skip next since we merged it
          } else if (!isEmptyContent) {
            merged.push(lesson);
          }
        }
        setLessons(merged.length > 0 ? merged : lessonData);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to load teaching content:', error);
      
      // SAFEGUARD 2: Don't use filler content, show error and go back to start
      setError('Failed to load teaching content. Please try again.');
      setIsLoading(false);
      setHasStarted(false);
      setShowSetup(true);
      
      toast({
        title: "Error Loading Content", 
        description: "An error occurred while loading teaching content. Please retry.",
        variant: "destructive",
      });
      
      // Don't call onComplete() on error - force user to retry
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTeaching = async () => {
    setShowSetup(false);
    setHasStarted(true);
    await loadTeachingContent();
  };

  const totalContent = lessons.length;
  const isLastContent = currentLessonIndex === totalContent - 1;
  const currentLesson = lessons[currentLessonIndex];
  const canGoBack = currentLessonIndex > 0;
  const progressPercentage = totalContent > 0 ? ((currentLessonIndex + 1) / totalContent) * 100 : 0;

  const handleNext = () => {
    if (isLastContent) {
      onComplete({ teachingLessons: lessons });
    } else {
      setCurrentLessonIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (canGoBack) {
      setCurrentLessonIndex(prev => prev - 1);
    }
  };

  // Show setup page first
  if (showSetup) {
    return (
      <TeachingSetup
        currentBlock={{
          id: 'current',
          unit: techniqueName,
          technique: technique,
          description: description,
          duration: 15
        }}
        onStartTeaching={handleStartTeaching}
        isLoading={false}
      />
    );
  }

  // Show loading screen after start button is clicked
  if (hasStarted && isLoading) {
    return (
      <UniversalLoadingScreen
        technique="teaching"
        title="Preparing Your Learning Experience"
        subtitle="ARLO is crafting personalized content just for you"
        showMessages={true}
        showSkeleton={true}
      />
    );
  }

  if (error || (hasStarted && lessons.length === 0 && !isLoading)) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-600 mb-4">{error || 'No teaching content available'}</p>
            <Button onClick={onBack} variant="outline" className="mr-3">
              Back to Study Plan
            </Button>
            <Button 
              onClick={() => {
                setError(null);
                setHasStarted(false);
                setShowSetup(true);
              }} 
              className="bg-forest-600 hover:bg-forest-700"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only show lesson content after successful load
  if (!hasStarted || lessons.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Progress Bar */}
      {totalContent > 1 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>
              Lesson {currentLessonIndex + 1} of {totalContent} {totalContent === 1 ? 'item' : 'items'}
            </span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
        </div>
      )}

      {/* Content Display */}
      <Card className="border-2 border-forest-200 bg-gradient-to-br from-forest-50 to-green-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-forest-100 rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-forest-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-forest-900">
                Arlo Teaching
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/60 rounded-lg p-6">
            {currentLesson.title && (
              <h2 className="text-lg font-bold text-forest-900 mb-4 pb-2 border-b border-forest-100">
                {currentLesson.title}
              </h2>
            )}
            <div className="text-gray-700 leading-relaxed">
              {parseContent(currentLesson.content)}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!canGoBack}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{currentLessonIndex + 1} / {totalContent}</span>
            </div>

            {(isLastContent && isLastTechniqueOfSession) ? (
              <Button
                onClick={handleNext}
                className="flex items-center gap-2 bg-forest-600 hover:bg-forest-700"
              >
                <Play className="w-4 h-4" />
                Start {techniqueName}
              </Button>
            ) : !isLastContent ? (
              <Button
                onClick={handleNext}
                className="flex items-center gap-2 bg-forest-600 hover:bg-forest-700"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <div className="w-[130px]" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back to Block Button */}
      {onBack && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onBack} className="text-gray-500">
            ← Back to Study Block
          </Button>
        </div>
      )}
    </div>
  );
};

export default TeachingMode;
