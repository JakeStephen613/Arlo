
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceRecordingProps {
  onTranscript: (transcript: string) => void;
  silenceDelay?: number;
  enabled: boolean;
}

export const useVoiceRecording = ({ 
  onTranscript, 
  silenceDelay = 2000,
  enabled 
}: UseVoiceRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentTranscriptRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);

  // Enhanced text-to-speech function with natural voice
  const speakText = useCallback((text: string) => {
    if (!text.trim()) return;
    
    setIsSpeaking(true);
    
    // Cancel any existing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Enhanced voice settings for more natural speech
    utterance.rate = 0.85; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    
    // Try to use a more natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = [
      'Samantha', // macOS
      'Microsoft Zira - English (United States)', // Windows
      'Google US English', // Chrome
      'Alex', // macOS alternative
      'Microsoft David - English (United States)' // Windows alternative
    ];
    
    let selectedVoice = null;
    for (const preferredName of preferredVoices) {
      selectedVoice = voices.find(voice => voice.name.includes(preferredName));
      if (selectedVoice) break;
    }
    
    // Fallback to first English voice or system default
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => voice.lang.startsWith('en-')) || voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = (event) => {
      console.error('🔊 Speech synthesis error:', event.error);
      setIsSpeaking(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // FIXED: Complete transcript reset after submission
  const handleDebouncedSubmit = useCallback((finalTranscript: string) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    silenceTimeoutRef.current = setTimeout(() => {
      const cleanTranscript = finalTranscript.trim();
      if (cleanTranscript && !isProcessingRef.current) {
        isProcessingRef.current = true;
        
        // Submit the transcript
        onTranscript(cleanTranscript);
        
        // CRITICAL FIX: Completely reset all transcript state
        setTranscript('');
        currentTranscriptRef.current = '';
        
        // Reset processing flag after a brief delay
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1000);
      }
    }, silenceDelay);
  }, [onTranscript, silenceDelay]);

  // Start speech recognition session
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current || isRecording) return;
    
    // CRITICAL: Clear any leftover transcript before starting
    setTranscript('');
    currentTranscriptRef.current = '';
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('❌ Failed to start speech recognition:', error);
      setError('Failed to start listening. Please try again.');
    }
  }, [isRecording]);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('❌ Failed to stop speech recognition:', error);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    
    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      const recognition = new SpeechRecognition();
      
      // Configure for continuous conversation
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      

      // Event handlers
      recognition.onstart = () => {
        setError(null);
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        
        let latestTranscript = '';
        let hasFinalResult = false;
        
        // FIXED: Process only the latest results to avoid accumulation
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            latestTranscript += result[0].transcript + ' ';
            hasFinalResult = true;
          } else {
            // Show interim results for the current chunk only
            latestTranscript += result[0].transcript;
          }
        }
        
        
        // Update current transcript
        if (hasFinalResult) {
          // FIXED: Don't accumulate, just add the new content
          const newContent = latestTranscript.trim();
          if (newContent) {
            const updatedTranscript = (currentTranscriptRef.current + ' ' + newContent).trim();
            currentTranscriptRef.current = updatedTranscript;
            setTranscript(updatedTranscript);
            
            // Auto-submit after 2s silence
            handleDebouncedSubmit(updatedTranscript);
          }
        } else {
          // Show interim results combined with current transcript
          const displayTranscript = (currentTranscriptRef.current + ' ' + latestTranscript).trim();
          setTranscript(displayTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        
        let errorMessage = '';
        let shouldRestart = false;
        
        switch (event.error) {
          case 'no-speech':
            shouldRestart = true;
            break;
          case 'audio-capture':
            errorMessage = 'Microphone access failed. Please check your microphone and permissions.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          case 'aborted':
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        
        if (errorMessage) {
          setError(errorMessage);
          setIsRecording(false);
        } else if (shouldRestart && enabled) {
          // Restart for minor errors like no-speech
          setTimeout(() => {
            if (enabled && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (error) {
              }
            }
          }, 100);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        
        // Only restart if Talk Mode is still enabled and we're not processing
        if (enabled && !isProcessingRef.current) {
          setTimeout(() => {
            if (enabled && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (error) {
              }
            }
          }, 100);
        }
      };

      recognitionRef.current = recognition;
      
    } else {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser. Try Chrome or Safari.');
    }

    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []); // Remove enabled dependency to prevent re-initialization

  // Control recognition based on enabled state
  useEffect(() => {
    
    if (!isSupported || !recognitionRef.current) {
      return;
    }

    if (enabled && !isRecording) {
      startRecognition();
    } else if (!enabled && isRecording) {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      stopRecognition();
      // CRITICAL: Clear all state when disabling
      setTranscript('');
      currentTranscriptRef.current = '';
      isProcessingRef.current = false;
      setError(null);
    }
  }, [enabled, isSupported, startRecognition, stopRecognition, isRecording]);

  return {
    isRecording: enabled ? isRecording : false,
    transcript: enabled ? transcript : '',
    isSupported,
    error: enabled ? error : null,
    isSpeaking,
    speakText,
    stopSpeaking
  };
};
