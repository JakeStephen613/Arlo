import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Brain } from 'lucide-react';

interface BlurtingScoreRingProps {
  scoreFraction: string; // e.g., "3/6"
  feedback: string;
  mentioned: string[];
  partialMentions: string[];
  missed: string[];
}

const BlurtingScoreRing = ({
  scoreFraction,
  feedback,
  mentioned,
  partialMentions,
  missed
}: BlurtingScoreRingProps) => {
  const [mentionedOpen, setMentionedOpen] = useState(true);
  const [partialOpen, setPartialOpen] = useState(true);
  const [missedOpen, setMissedOpen] = useState(true);

  // Parse score fraction
  const [numerator, denominator] = scoreFraction.split('/').map(n => parseInt(n));
  const percentage = denominator > 0 ? (numerator / denominator) * 100 : 0;

  // Determine ring color based on score
  const getScoreColor = (percent: number) => {
    if (percent >= 80) return 'text-emerald-500';
    if (percent >= 60) return 'text-yellow-500';
    if (percent >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreGradient = (percent: number) => {
    if (percent >= 80) return 'from-emerald-500 to-green-600';
    if (percent >= 60) return 'from-yellow-500 to-amber-600';
    if (percent >= 40) return 'from-orange-500 to-red-500';
    return 'from-red-500 to-red-600';
  };

  const scoreColor = getScoreColor(percentage);
  const scoreGradient = getScoreGradient(percentage);

  // SVG circle parameters - Enhanced size
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="space-y-8">
      {/* Enhanced Score Ring */}
      <div className="flex flex-col items-center">
        <div className="relative mb-6" style={{ width: size, height: size }}>
          {/* Background circle with enhanced styling */}
          <svg
            className="transform -rotate-90 drop-shadow-lg"
            width={size}
            height={size}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-gray-200"
            />
            {/* Enhanced progress circle with gradient */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#scoreGradient)"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Enhanced gradient definition */}
          <svg className="absolute inset-0" style={{ width: 0, height: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Enhanced score text in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {numerator}
              </div>
              <div className="text-sm text-gray-500 mb-1">
                of {denominator}
              </div>
              <div className="text-xs text-gray-400">
                {Math.round(percentage)}%
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced score label */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Concept Coverage</h3>
          <p className="text-sm text-gray-600">You covered {numerator} out of {denominator} key concepts</p>
        </div>
      </div>

      {/* Enhanced Concept Breakdown Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Enhanced Mentioned Concepts */}
        {mentioned && mentioned.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-200">
            <Collapsible open={mentionedOpen} onOpenChange={setMentionedOpen}>
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer hover:bg-emerald-100/50 transition-colors rounded-lg p-2 -m-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <h4 className="font-semibold text-emerald-900">Covered Well</h4>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                      {mentioned.length}
                    </Badge>
                    <div className="ml-auto">
                      {mentionedOpen ? (
                        <ChevronUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-1">
                  {mentioned.map((concept, index) => (
                    <li key={index} className="text-sm text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      {concept}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Enhanced Partial Mentions */}
        {partialMentions && partialMentions.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-200">
            <Collapsible open={partialOpen} onOpenChange={setPartialOpen}>
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer hover:bg-amber-100/50 transition-colors rounded-lg p-2 -m-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <h4 className="font-semibold text-amber-900">Partially Covered</h4>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                      {partialMentions.length}
                    </Badge>
                    <div className="ml-auto">
                      {partialOpen ? (
                        <ChevronUp className="w-4 h-4 text-amber-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-1">
                  {partialMentions.map((concept, index) => (
                    <li key={index} className="text-sm text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      {concept}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Enhanced Missed Concepts */}
        {missed && missed.length > 0 && (
          <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-xl p-5 border border-rose-200">
            <Collapsible open={missedOpen} onOpenChange={setMissedOpen}>
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer hover:bg-rose-100/50 transition-colors rounded-lg p-2 -m-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                    <h4 className="font-semibold text-rose-900">Need Review</h4>
                    <Badge className="bg-rose-100 text-rose-700 border-rose-300">
                      {missed.length}
                    </Badge>
                    <div className="ml-auto">
                      {missedOpen ? (
                        <ChevronUp className="w-4 h-4 text-rose-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-1">
                  {missed.map((concept, index) => (
                    <li key={index} className="text-sm text-rose-800">
                      {concept}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>

      {/* Enhanced AI Feedback */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900">ARLO's Feedback</h4>
            <p className="text-sm text-blue-600">Personalized analysis of your response</p>
          </div>
        </div>
        <p className="text-blue-800 leading-relaxed">{feedback}</p>
      </div>
    </div>
  );
};

export default BlurtingScoreRing;