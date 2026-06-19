
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 h-full overflow-y-auto bg-transparent">
      <div className="space-y-6 min-h-full">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className={`max-w-[85%] flex items-start gap-3 ${
              message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}>
              {message.sender === 'arlo' && (
                <div className="relative flex-shrink-0 mt-1">
                  <Avatar className="w-9 h-9 border-2 border-indigo-300/50 shadow-lg">
                    <AvatarImage src="/api/placeholder/36/36" alt="ARLO AI" />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-xs font-bold">
                      <Bot className="w-4 h-4 animate-pulse opacity-70" />
                    </AvatarFallback>
                  </Avatar>
                  {/* AI Indicator */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-lg">
                    <div className="w-full h-full bg-green-400 rounded-full animate-pulse opacity-60"></div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2 flex-1">
                <div className={`relative rounded-2xl px-5 py-3 shadow-lg backdrop-blur-md border transition-all duration-300 hover:scale-[1.02] ${
                  message.sender === 'user' 
                    ? 'bg-gradient-to-r from-indigo-500/90 to-indigo-600/90 text-white border-white/20 shadow-indigo-500/25' 
                    : 'bg-white/95 text-gray-800 border-indigo-200/30 shadow-indigo-500/10'
                }`}>
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.text}</p>
                </div>
                
                {message.sender === 'arlo' && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSaveResponse(message.id, message.text)}
                      disabled={message.saved}
                      className="h-7 px-3 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all duration-200"
                    >
                      {message.saved ? (
                        <>
                          <Check className="w-3 h-3 mr-1 text-green-500" />
                          <span className="text-green-600">Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" />
                          Save to Memory
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-1">
                <Avatar className="w-9 h-9 border-2 border-indigo-300/50 shadow-lg">
                  <AvatarImage src="/api/placeholder/36/36" alt="ARLO AI" />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-xs font-bold">
                    <Bot className="w-4 h-4 animate-pulse opacity-70" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-lg">
                  <div className="w-full h-full bg-green-400 rounded-full animate-pulse opacity-60"></div>
                </div>
              </div>
              
              <div className="relative bg-white/95 backdrop-blur-md rounded-2xl px-5 py-3 shadow-lg border border-indigo-200/30">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
