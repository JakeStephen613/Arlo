import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Loader2 } from 'lucide-react';
import { sendChatbotMessage, updateContext } from '@/services/studyModulesApi';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import ArloHeader from './chatbot/ArloHeader';
import ArloMessages from './chatbot/ArloMessages';
import ArloInput from './chatbot/ArloInput';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'arlo';
  timestamp: Date;
  saved?: boolean;
  isError?: boolean;
}

interface ArloChatbotProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  isLastBlock?: boolean;
  sessionId?: string;
}

const ArloChatbot = ({ 
  isExpanded, 
  onToggleExpand, 
  currentBlock,
  isLastBlock = false,
  sessionId
}: ArloChatbotProps) => {
  const { user } = useAuth();
  
  // Use sessionId to maintain conversation history across blocks
  const conversationKey = sessionId || 'default-session';
  
  // Store conversation history in sessionStorage for persistence across blocks
  const getStoredMessages = (): Message[] => {
    try {
      const stored = sessionStorage.getItem(`arlo-messages-${conversationKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
    }
    return [];
  };

  const saveMessagesToStorage = (messages: Message[]) => {
    try {
      sessionStorage.setItem(`arlo-messages-${conversationKey}`, JSON.stringify(messages));
    } catch (error) {
    }
  };

  // Generate improved intro message based on current block or session start
  const getIntroMessage = (): string => {
    const storedMessages = getStoredMessages();
    
    // If we have stored messages, don't show intro again
    if (storedMessages.length > 0) {
      return '';
    }
    
    if (currentBlock && (currentBlock.technique === 'arlo_teaching' || currentBlock.technique === 'arlo_chat')) {
      return `Hello! I'm ARLO, your personal AI tutor, and I'm excited to help you with: ${currentBlock.description}

During our session, I'll guide you through the material using interactive discussions, targeted questions, and personalized explanations. Think of me as your study partner who can adapt to your learning style and pace.

Feel free to ask questions, request clarification on concepts, or let me know if you'd like me to explain something differently. I'm here to make sure you truly understand the material, not just memorize it.

Ready to dive in and start learning together?`;
    }
    return "Hi there! I'm ARLO, your AI personal tutor. I'm here to help you with your studies through interactive discussions and personalized guidance. I can explain complex concepts, answer your questions, and help you think through problems step by step. What would you like to work on today?";
  };

  // Initialize messages from storage or with intro message
  const initializeMessages = (): Message[] => {
    const storedMessages = getStoredMessages();
    if (storedMessages.length > 0) {
      return storedMessages;
    }
    
    const introText = getIntroMessage();
    if (introText) {
      return [{
        id: '1',
        text: introText,
        sender: 'arlo',
        timestamp: new Date()
      }];
    }
    
    return [];
  };

  const [messages, setMessages] = useState<Message[]>(initializeMessages());
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [apiError, setApiError] = useState<boolean>(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const { toast } = useToast();

  // Enhanced voice recording with conversation flow
  const {
    isRecording,
    transcript,
    isSupported: isVoiceSupported,
    error: voiceError,
    isSpeaking,
    speakText,
    stopSpeaking
  } = useVoiceRecording({
    enabled: false, // Talk mode disabled for now
    onTranscript: (voiceTranscript) => {
      sendMessage(voiceTranscript);
    },
    silenceDelay: 2000
  });

  // Save messages to storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    }
  }, [messages, conversationKey]);

  // Add context message when switching to new blocks (but don't reset conversation)
  useEffect(() => {
    if (currentBlock && messages.length > 0) {
      // Add a contextual message about the new block without resetting conversation
      const contextMessage: Message = {
        id: `context-${Date.now()}`,
        text: `📚 Now working on: ${currentBlock.unit} using ${currentBlock.technique.replace('_', ' ')}

${currentBlock.description}

How can I help you with this topic?`,
        sender: 'arlo',
        timestamp: new Date()
      };
      
      // Only add context message if the last message isn't already a context message
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.text.includes('📚 Now working on:')) {
          return prev; // Don't add duplicate context messages
        }
        return [...prev, contextMessage];
      });
    }
  }, [currentBlock?.id]); // Only trigger when block ID changes

  // Send initial context update when chatbot becomes active
  useEffect(() => {
    const sendInitialContext = async () => {
      if (currentBlock && !sessionActive) {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id;
        if (!userId) return;

        try {
          await updateContext({
            source: `user:${userId}`,
            user_id: userId,
            current_topic: currentBlock.unit,
            concept: currentBlock.description,
            phase: currentBlock.technique,
            duration: currentBlock.duration,
            timestamp: new Date().toISOString(),
            block_id: currentBlock.id,
            component_mounted: true
          });
          
        } catch (error) {
          console.error('Failed to update ARLO context on mount:', error);
        }
        
        setSessionActive(true);
      }
    };

    sendInitialContext();
  }, [currentBlock, sessionActive]);

  const saveResponseToMemory = async (messageId: string, messageText: string) => {
    try {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to save responses",
          variant: "destructive",
        });
        return;
      }

      // Use the new save endpoint with correct format
      const response = await fetch(`${API_BASE_URL}/chatbot/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          topic: currentBlock?.unit || currentBlock?.description || 'General',
          concepts_covered: [], // Could be enhanced to extract from message content
          last_interaction: new Date().toISOString(),
          message_history: messages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'student' : 'tutor',
            content: msg.text
          })),
          session_type: 'chatbot'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save response');
      }

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, saved: true } : msg
      ));

      toast({
        title: "Response saved to memory",
        description: "This response has been saved for future review",
      });

    } catch (error) {
      console.error('Failed to save response to memory:', error);
      toast({
        title: "Failed to save",
        description: "Could not save response to memory",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);

    try {
      
      // Format message history according to new spec (last 5 turns)
      const messageHistory = newMessages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'student' : 'tutor',
        content: msg.text
      }));
      
      const response = await sendChatbotMessage({
        user_input: textToSend,
        topic: currentBlock?.unit || currentBlock?.description || 'General Study',
        target_level: 'medium',
        message_history: messageHistory,
        user_id: user?.id
      });
      
      const arloResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: 'arlo',
        timestamp: new Date()
      };

      const updatedMessages = [...newMessages, arloResponse];
      setMessages(updatedMessages);
      setApiError(false);

      if (response.follow_up_question) {
        setTimeout(() => {
          const followUpMessage: Message = {
            id: (Date.now() + 2).toString(),
            text: response.follow_up_question!,
            sender: 'arlo',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, followUpMessage]);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Failed to send message to ARLO:', error);
      setApiError(true);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, but I'm having trouble connecting to my AI services right now. The ARLO backend appears to be unavailable. Please try again later or contact support if this persists.",
        sender: 'arlo',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: "ARLO Service Unavailable",
        description: "Unable to connect to ARLO's AI backend. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  // Function to get visible content from the current context - FOCUSED CONTENT ONLY
  const getVisibleContent = (): string => {
    
    if (!currentBlock?.technique) {
      return currentBlock?.description || 'No content available to explain';
    }

    const technique = currentBlock.technique.toLowerCase();

    // QUIZ MODE - Get current question and selected answer
    if (technique.includes('quiz')) {
      // Updated selectors for new quiz UI structure
      const quizQuestionElement = document.querySelector('[data-study-content] h3.text-2xl.font-bold.text-slate-900');
      const answerCards = document.querySelectorAll('[data-study-content] .cursor-pointer.transition-all');
      const selectedAnswerCard = document.querySelector('[data-study-content] .bg-green-50, [data-study-content] .bg-red-50');
      
      let content = '';
      
      if (quizQuestionElement) {
        content = `Question: ${quizQuestionElement.textContent?.trim() || ''}`;
        
        // Add all answer options from the card elements
        if (answerCards.length > 0) {
          const options = Array.from(answerCards).map((card, idx) => {
            const optionSpan = card.querySelector('span.text-base.font-medium');
            const optionText = optionSpan?.textContent?.trim() || '';
            return optionText;
          }).filter(Boolean);
          
          if (options.length > 0) {
            content += `\n\nAnswer Options:\n${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')}`;
          }
        }
        
        // Add selected answer if any
        if (selectedAnswerCard) {
          const selectedSpan = selectedAnswerCard.querySelector('span.text-base.font-medium');
          const selectedText = selectedSpan?.textContent?.trim() || '';
          if (selectedText) {
            content += `\n\nSelected Answer: ${selectedText}`;
          }
        }
      }
      
      if (content) {
        return content;
      }
    }

    // FLASHCARDS MODE - Get current flashcard (front and back if flipped)
    if (technique.includes('flashcard')) {
      // Look for flashcard container
      const flashcardContainer = document.querySelector('.perspective-1000');
      
      if (flashcardContainer) {
        const isFlipped = flashcardContainer.querySelector('.rotate-y-180') !== null;
        
        // Get front content
        const frontCard = flashcardContainer.querySelector('.backface-hidden:not(.rotate-y-180) p');
        const frontText = frontCard?.textContent?.trim() || '';
        
        if (isFlipped) {
          // Card is flipped, get back content too
          const backCard = flashcardContainer.querySelector('.rotate-y-180 p');
          const backText = backCard?.textContent?.trim() || '';
          const content = `Question: ${frontText}\nAnswer: ${backText}`;
          return content;
        } else {
          // Only front is visible
          const content = `Question: ${frontText}`;
          return content;
        }
      }
    }

    // TEACHING MODE - Get current lesson content
    if (technique.includes('teaching') || technique.includes('arlo_teaching')) {
      // Get the current lesson title and content
      const lessonTitleElement = document.querySelector('h1.text-xl.text-indigo-900, .text-xl.text-indigo-900');
      const lessonContentElement = document.querySelector('.bg-white\\/60 p, .bg-white\\/60 ul');
      
      if (lessonTitleElement && lessonContentElement) {
        const title = lessonTitleElement.textContent?.trim() || '';
        let content = lessonContentElement.textContent?.trim() || '';
        
        // If it's a list, format it nicely
        if (lessonContentElement.tagName === 'UL') {
          const listItems = lessonContentElement.querySelectorAll('li');
          content = Array.from(listItems).map(li => `• ${li.textContent?.trim()}`).join('\n');
        }
        
        const result = `Lesson: ${title}\n\nContent: ${content}`;
        return result;
      }
    }

    // FEYNMAN MODE - Get current exercise prompt and any feedback
    if (technique.includes('feynman')) {
      const exercisePrompt = document.querySelector('.bg-white\\/60 p, .bg-blue-50 p');
      const feedback = document.querySelector('.bg-green-50 p, .bg-yellow-50 p');
      
      let content = '';
      if (exercisePrompt) {
        content = `Exercise: ${exercisePrompt.textContent?.trim() || ''}`;
      }
      if (feedback) {
        content += `\n\nCurrent Feedback: ${feedback.textContent?.trim() || ''}`;
      }
      
      if (content) {
        return content;
      }
    }

    // BLURTING MODE - Get current exercise prompt and any feedback
    if (technique.includes('blurt')) {
      // Updated selectors for new blurting UI
      const exercisePrompt = document.querySelector('.text-slate-900.font-medium.text-lg, .text-lg.font-semibold.text-slate-900');
      const selectedExercise = document.querySelector('.bg-gradient-to-r.from-orange-100.to-red-100');
      const currentUserResponse = document.querySelector('textarea[placeholder*="Write everything you remember"]');
      const feedback = document.querySelector('.bg-green-50 p, .bg-yellow-50 p');
      
      let content = '';
      
      // Get the selected exercise prompt
      if (exercisePrompt) {
        content = `Exercise: ${exercisePrompt.textContent?.trim() || ''}`;
      } else if (selectedExercise && selectedExercise.closest('.bg-white\\/80')) {
        // Get the exercise from the selection card
        const exerciseCard = selectedExercise.closest('.bg-white\\/80');
        const exerciseText = exerciseCard?.querySelector('.text-slate-800.font-medium.text-lg');
        if (exerciseText) {
          content = `Exercise: ${exerciseText.textContent?.trim() || ''}`;
        }
      }
      
      // Add user's current response if they're typing
      if (currentUserResponse && (currentUserResponse as HTMLTextAreaElement).value) {
        content += `\n\nYour Current Response: ${(currentUserResponse as HTMLTextAreaElement).value}`;
      }
      
      if (feedback) {
        content += `\n\nCurrent Feedback: ${feedback.textContent?.trim() || ''}`;
      }
      
      if (content) {
        return content;
      }
    }

    // Last resort: current block description
    return currentBlock?.description || 'No content available to explain';
  };

  // Determine question type based on current technique
  const getQuestionType = (): string => {
    if (!currentBlock?.technique) return 'general';
    
    const technique = currentBlock.technique.toLowerCase();
    if (technique.includes('quiz')) return 'quiz';
    if (technique.includes('flashcard')) return 'flashcard';
    if (technique.includes('feynman')) return 'feynman';
    if (technique.includes('blurt')) return 'blurting';
    if (technique.includes('teaching') || technique.includes('arlo_teaching')) return 'general';
    
    return 'general';
  };

  // Handle Explain This button - add explanation as ARLO response
  const handleExplainThis = async () => {
    setIsExplaining(true);
    
    try {
      const content = getVisibleContent();
      const questionType = getQuestionType();
      
      
      if (!content?.trim()) {
        toast({
          title: "No content to explain",
          description: "There's no visible content to explain right now.",
          variant: "destructive",
        });
        return;
      }

      // Add user message asking for explanation with the content
      const userMessage: Message = {
        id: Date.now().toString(),
        text: `🧠 Please explain this content:\n\n${content}`,
        sender: 'user',
        timestamp: new Date()
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsTyping(true);


      // Send request to chatbot help endpoint with focused content
      const response = await fetch(`${API_BASE_URL}/chatbot/help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content, // Only the specific visible content
          question_type: questionType,
          topic: currentBlock?.unit || currentBlock?.description || 'General Study'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Format the explanation as a nice ARLO response
      let explanationText = `🧠 **ARLO Explains:**\n\n${data.explanation}`;
      
      if (data.key_concepts && data.key_concepts.length > 0) {
        explanationText += `\n\n**Key Concepts:** ${data.key_concepts.join(', ')}`;
      }

      const arloExplanationMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: explanationText,
        sender: 'arlo',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, arloExplanationMessage]);
      setApiError(false);

    } catch (error) {
      console.error('❌ Error getting explanation:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I couldn't get an explanation right now. The explanation service seems to be unavailable. Please try asking me directly about what you'd like me to explain!",
        sender: 'arlo',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: "Explanation failed",
        description: "Could not get explanation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
      setIsExplaining(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative z-0">
      {/* Lower z-index background */}
      <div className="absolute inset-0 bg-transparent backdrop-blur-sm rounded-2xl border border-indigo-200/10 shadow-2xl shadow-indigo-500/5"></div>
      
      <div className="relative z-20 flex flex-col h-full">
        <div className="pb-3 flex-shrink-0">
          <ArloHeader
            currentBlock={currentBlock}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
          />
          
          {/* Enhanced Explain This Button */}
          <div className="flex justify-center py-4">
            <Button
              onClick={handleExplainThis}
              disabled={isExplaining}
              className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:via-indigo-700 hover:to-indigo-800 text-white px-8 py-4 text-lg font-bold shadow-2xl hover:shadow-indigo-500/25 transition-all duration-300 rounded-2xl border border-white/20 backdrop-blur-md relative overflow-hidden group"
              size="lg"
            >
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/30 to-indigo-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative z-10 flex items-center">
                {isExplaining ? (
                  <>
                    <div className="w-6 h-6 mr-3 relative">
                      <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    Getting AI explanation...
                  </>
                ) : (
                  <>
                    <Brain className="w-6 h-6 mr-3 animate-pulse" />
                    🧠 Ask AI to Explain This
                  </>
                )}
              </div>
            </Button>
          </div>

          {apiError && (
            <div className="mx-4 bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-4 mt-2">
              <p className="text-sm text-red-100 font-medium flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                ⚠️ AI services temporarily unavailable
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ArloMessages
            messages={messages}
            isTyping={isTyping}
            onSaveResponse={saveResponseToMemory}
          />
          <div className="flex-shrink-0">
            <ArloInput
              inputText={inputText}
              onInputChange={setInputText}
              onSendMessage={() => sendMessage()}
              isTyping={isTyping}
              voiceTranscript=""
              isRecording={false}
              isSpeaking={isSpeaking}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArloChatbot;
