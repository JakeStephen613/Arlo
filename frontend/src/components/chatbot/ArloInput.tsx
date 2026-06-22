
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
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

  useEffect(() => {
    if (voiceTranscript && voiceTranscript !== inputText && voiceTranscript !== lastSubmittedTranscript.current) {
      onInputChange(voiceTranscript);
    }
  }, [voiceTranscript, inputText, onInputChange]);

  const handleSendMessage = () => {
    if (voiceTranscript) {
      lastSubmittedTranscript.current = voiceTranscript;
    }
    onSendMessage();
    onInputChange('');
    if (voiceTranscript) {
      setTimeout(() => { lastSubmittedTranscript.current = ''; }, 100);
    }
  };

  const displayValue = voiceTranscript || inputText;

  return (
    <div className="p-3 border-t">
      <div className="flex gap-2 items-center">
        <Input
          value={displayValue}
          onChange={(e) => !isRecording && onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Arlo..."
          className="flex-1 rounded-lg text-sm h-9"
          disabled={isTyping || isRecording || isSpeaking}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!displayValue.trim() || isTyping}
          size="sm"
          className="h-9 w-9 p-0 rounded-lg"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default ArloInput;
