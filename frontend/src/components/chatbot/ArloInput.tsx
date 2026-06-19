
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Volume2, Bot } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ArloInputProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  isTyping: boolean;
  voiceTranscript?: string;
  isRecording?: boolean;
  isSpeaking?: boolean;
}

const ArloInput = ({ 
  inputText, 
  onInputChange, 
  onSendMessage, 
  isTyping,
  voiceTranscript = '',
  isRecording = false,
  isSpeaking = false
}: ArloInputProps) => {
  const lastSubmittedTranscript = useRef<string>('');

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // Handle voice transcript updates for preview only
  useEffect(() => {
    if (voiceTranscript && voiceTranscript !== inputText && voiceTranscript !== lastSubmittedTranscript.current) {
      onInputChange(voiceTranscript);
    }
  }, [voiceTranscript, inputText, onInputChange]);

  const handleSendMessage = () => {
    // Track what we're submitting to prevent re-use
    const messageToSend = voiceTranscript || inputText;
    if (voiceTranscript) {
      lastSubmittedTranscript.current = voiceTranscript;
    }
    
    // Send the message
    onSendMessage();

    // CRITICAL FIX: Immediately and completely clear input after sending
    onInputChange('');
    
    // Also clear the last submitted reference if it was voice
    if (voiceTranscript) {
      setTimeout(() => {
        lastSubmittedTranscript.current = '';
      }, 100);
    }
  };

  // Determine what to display in the input
  const displayValue = voiceTranscript || inputText;
  
  let placeholder = "Ask ARLO anything...";
  if (isRecording) {
    placeholder = "🎤 Listening... speak naturally";
  } else if (isSpeaking) {
    placeholder = "🔊 ARLO is speaking...";
  }

  return (
    <div className="p-4 border-t border-white/20 backdrop-blur-sm">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <Input
            value={displayValue}
            onChange={(e) => !isRecording && onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className={`flex-1 rounded-2xl border-2 bg-white/90 backdrop-blur-sm shadow-lg transition-all duration-300 focus:shadow-xl focus:scale-[1.02] ${
              isRecording ? 'bg-green-50/90 border-green-300 shadow-green-200/50' : 
              isSpeaking ? 'bg-blue-50/90 border-blue-300 shadow-blue-200/50' : 
              'border-white/30 focus:border-indigo-400'
            } py-3 px-4 text-sm`}
            disabled={isTyping || isRecording || isSpeaking}
            aria-label="Chat with AI"
          />
          
          {/* AI Input Enhancement */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Bot className="w-3 h-3" />
              <span>AI</span>
            </div>
          </div>
        </div>
        
        <Button
          onClick={handleSendMessage}
          disabled={!displayValue.trim() || isTyping || isRecording || isSpeaking}
          size="sm"
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl px-6 py-3 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-white/20"
          aria-label="Send to AI"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      
      {isRecording && (
        <div className="mt-3 text-xs text-center text-green-600 bg-green-50/80 backdrop-blur-sm rounded-xl p-2 border border-green-200/50">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            🎤 AI is listening - speak naturally
          </div>
        </div>
      )}
      
      {isSpeaking && (
        <div className="mt-3 text-xs text-center text-blue-600 bg-blue-50/80 backdrop-blur-sm rounded-xl p-2 border border-blue-200/50">
          <div className="flex items-center justify-center gap-2">
            <Volume2 className="w-3 h-3 animate-pulse" />
            🤖 AI is speaking - standby mode
          </div>
        </div>
      )}
    </div>
  );
};

export default ArloInput;
