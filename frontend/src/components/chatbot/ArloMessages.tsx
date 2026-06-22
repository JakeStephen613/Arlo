
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Bot, Check, Save } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'arlo';
  timestamp: Date;
  saved?: boolean;
}

interface ArloMessagesProps {
  messages: Message[];
  isTyping: boolean;
  onSaveResponse: (messageId: string, messageText: string) => void;
}

const ArloMessages = ({ messages, isTyping, onSaveResponse }: ArloMessagesProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  return (
    <ScrollArea ref={scrollAreaRef} className="flex-1 p-3 h-full overflow-y-auto">
      <div className="space-y-3 min-h-full">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] flex items-start gap-2 ${
              message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}>
              {message.sender === 'arlo' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}>
                  <p className="break-words whitespace-pre-wrap">{message.text}</p>
                </div>

                {message.sender === 'arlo' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSaveResponse(message.id, message.text)}
                    disabled={message.saved}
                    className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground self-start"
                  >
                    {message.saved ? (
                      <><Check className="w-2.5 h-2.5 mr-1 text-green-500" /> Saved</>
                    ) : (
                      <><Save className="w-2.5 h-2.5 mr-1" /> Save</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="rounded-xl bg-secondary px-3 py-2">
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default ArloMessages;
