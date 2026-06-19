
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, AlertCircle, FileText, Clock } from 'lucide-react';
import ExpandableContent from './ExpandableContent';

interface SessionCompletionDetailsProps {
  completionData: {
    completed_at: string;
    duration_minutes: number;
    review_sheet?: any;
    quiz_mistakes?: any[];
    flashcards?: any[];
  };
  className?: string;
}

const SessionCompletionDetails = ({ completionData, className = "" }: SessionCompletionDetailsProps) => {
  const { duration_minutes, review_sheet, quiz_mistakes = [], flashcards = [] } = completionData;

  return (
    <Card className={`border-green-200 bg-green-50/50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Session Results
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
            {duration_minutes} minutes
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Review Sheet */}
        {review_sheet && Object.keys(review_sheet).length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <h6 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1">
              <Brain className="w-3 h-3" />
              Review Sheet Generated
            </h6>
            <div className="text-xs text-gray-700 space-y-1">
              {review_sheet.summary && (
                <p><strong>Summary:</strong> {review_sheet.summary}</p>
              )}
              {review_sheet.key_concepts && Array.isArray(review_sheet.key_concepts) && (
                <div>
                  <strong>Key Concepts:</strong>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {review_sheet.key_concepts.slice(0, 3).map((concept: string, idx: number) => (
                      <li key={idx}>{concept}</li>
                    ))}
                    {review_sheet.key_concepts.length > 3 && (
                      <li className="text-gray-500">...and {review_sheet.key_concepts.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz Mistakes */}
        {quiz_mistakes.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <h6 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Quiz Mistakes ({quiz_mistakes.length})
            </h6>
            <ExpandableContent 
              items={quiz_mistakes.map(mistake => {
                // Helper function to safely convert any value to string
                const safeStringify = (value: any): string => {
                  if (value === null || value === undefined) {
                    return '';
                  }
                  if (typeof value === 'string') {
                    return value;
                  }
                  if (typeof value === 'object') {
                    if (value.text) return String(value.text);
                    if (value.content) return String(value.content);
                    if (value.value) return String(value.value);
                    return JSON.stringify(value);
                  }
                  return String(value);
                };

                return {
                  question: safeStringify(mistake.question),
                  correct_answer: safeStringify(mistake.correct_answer || mistake.correctAnswer),
                  user_answer: safeStringify(mistake.user_answer || mistake.userAnswer),
                  explanation: safeStringify(mistake.explanation)
                };
              })}
              type="quiz_mistakes" 
              maxInitialItems={2}
            />
          </div>
        )}

        {/* Flashcards */}
        {flashcards.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <h6 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Flashcards Created ({flashcards.length})
            </h6>
            <ExpandableContent 
              items={flashcards} 
              type="flashcards" 
              maxInitialItems={2}
            />
          </div>
        )}

        {/* Empty state */}
        {!review_sheet && quiz_mistakes.length === 0 && flashcards.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No session details available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionCompletionDetails;
