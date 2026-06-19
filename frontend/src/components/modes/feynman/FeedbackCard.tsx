
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, User, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeedbackCardProps {
  feedback?: string;
  suggestions?: string[];
  strengths?: string[];
  weaknesses?: string[];
  isProcessing?: boolean;
}

const FeedbackCard = ({
  feedback = '',
  suggestions = [],
  strengths = [],
  weaknesses = [],
  isProcessing = false
}: FeedbackCardProps) => {
  if (isProcessing) {
    return (
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center animate-pulse">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium text-indigo-900">Arlo the Professor is thinking...</p>
              <p className="text-sm text-indigo-700">Analyzing your explanation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-medium text-indigo-900">Arlo the Professor</p>
            <p className="text-sm text-indigo-700">Your AI Learning Mentor</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-indigo-100">
          <p className="text-gray-800 leading-relaxed font-light">{feedback}</p>
        </div>

        {strengths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-800">What you nailed:</span>
            </div>
            <div className="space-y-1">
              {strengths.map((strength, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-green-50 p-2 rounded border-l-4 border-green-400">
                  <span className="text-green-700 text-sm">✅ {strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {weaknesses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-800">Needs clarification:</span>
            </div>
            <div className="space-y-1">
              {weaknesses.map((weakness, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                  <span className="text-yellow-700 text-sm">⚠️ {weakness}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-800">Hints for improvement:</span>
            </div>
            <div className="space-y-1">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-red-50 p-2 rounded border-l-4 border-red-400">
                  <span className="text-red-700 text-sm">❌ {suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeedbackCard;
