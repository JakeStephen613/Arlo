
import { BookOpen, Lightbulb, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ArloMascotProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const ArloMascot = ({ isVisible, onComplete }: ArloMascotProps) => {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 2000);

    return () => clearInterval(blinkInterval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="absolute top-4 left-4 z-10">
      <div 
        className={`transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className="relative">
          {/* ARLO mascot - friendly owl with glasses */}
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center shadow-lg">
            <div className="relative">
              <BookOpen className="w-8 h-8 text-indigo-600" />
              {/* Glasses */}
              <div className="absolute -top-2 -left-2 w-12 h-5 border-2 border-indigo-400 rounded-full opacity-70" />
              {/* Eyes */}
              <div className={`absolute top-1 left-2 transition-all duration-200 ${
                isBlinking ? 'scale-y-0' : 'scale-y-100'
              }`}>
                <div className="w-2 h-2 bg-indigo-800 rounded-full" />
              </div>
              <div className={`absolute top-1 right-2 transition-all duration-200 ${
                isBlinking ? 'scale-y-0' : 'scale-y-100'
              }`}>
                <div className="w-2 h-2 bg-indigo-800 rounded-full" />
              </div>
            </div>
          </div>
          
          {/* Thinking bubbles */}
          <div className="absolute -top-2 -right-2 flex flex-col space-y-1">
            <div className="w-2 h-2 bg-indigo-300 rounded-full animate-pulse" />
            <div className="w-3 h-3 bg-indigo-300 rounded-full animate-pulse delay-75" />
            <div className="w-4 h-4 bg-indigo-300 rounded-full animate-pulse delay-150" />
          </div>
          
          {/* Floating animation */}
          <div className="absolute inset-0 animate-bounce" style={{ animationDuration: '3s' }} />
        </div>
      </div>
    </div>
  );
};

export default ArloMascot;
