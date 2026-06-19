
import { useState, useEffect } from 'react';

const LOADING_MESSAGES = [
  "Gathering wisdom…",
  "Preparing your teaching guide…",
  "Consulting the memory palace…", 
  "Checking the ARLO archives…",
  "Warming up your brain trainer…",
  "Fetching bite-sized brilliance…",
  "Organizing knowledge clusters…",
  "Tuning the learning frequency…",
  "Activating study mode protocols…",
  "Calibrating your curiosity compass…"
];

interface LoadingMessagesProps {
  isVisible: boolean;
}

const LoadingMessages = ({ isVisible }: LoadingMessagesProps) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      
      setTimeout(() => {
        setCurrentMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="flex justify-center mt-4">
      <p 
        className={`text-sm text-gray-500 italic transition-all duration-300 ${
          isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
        }`}
      >
        {LOADING_MESSAGES[currentMessageIndex]}
      </p>
    </div>
  );
};

export default LoadingMessages;
