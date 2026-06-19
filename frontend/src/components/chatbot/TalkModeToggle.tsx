
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TalkModeToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  isRecording: boolean;
  onToggleRecording: () => void; // Kept for compatibility but not used
  isSupported: boolean;
  error?: string | null;
  isSpeaking?: boolean;
}

const TalkModeToggle = ({
  isEnabled,
  onToggle,
  isRecording,
  isSupported,
  error,
  isSpeaking = false
}: TalkModeToggleProps) => {
  // Temporarily hidden - return null to hide the component
  return null;
  
  // Keep all existing logic commented out but intact for future use
  /*
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
        <AlertCircle className="w-4 h-4 text-yellow-600" />
        <span className="text-yellow-700">Voice input not supported in this browser</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
      <div className="flex items-center gap-3">
        <Switch
          id="talk-mode"
          checked={isEnabled}
          onCheckedChange={onToggle}
          disabled={!!error}
        />
        <Label htmlFor="talk-mode" className="text-sm font-medium text-indigo-900">
          Talk Mode
          {isEnabled && (
            <span className="block text-xs text-indigo-600 mt-0.5">
              Speak naturally - I'll respond aloud
            </span>
          )}
        </Label>
      </div>

      <div className="flex items-center gap-2">
        {isEnabled && isRecording && (
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1.5" />
            Listening
          </Badge>
        )}
        
        {isEnabled && isSpeaking && (
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-2 py-1">
            <Volume2 className="w-3 h-3 mr-1" />
            Speaking
          </Badge>
        )}
        
        {error && isEnabled && (
          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        )}

        {isEnabled && (
          <div className={`p-1 rounded-full ${
            isRecording 
              ? 'bg-green-100 text-green-600' 
              : error 
              ? 'bg-red-100 text-red-600'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {isRecording ? (
              <Mic className="w-4 h-4" />
            ) : (
              <MicOff className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
    </div>
  );
  */
};

export default TalkModeToggle;
