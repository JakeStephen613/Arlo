import TechniqueIcon from './TechniqueIcon';
import LoadingMessages from '@/components/common/LoadingMessages';

interface UniversalLoadingScreenProps {
  technique: string;
  title?: string;
  subtitle?: string;
  showSkeleton?: boolean;
  showMessages?: boolean;
}

const loadingMessages = {
  'flashcards': 'Preparing your flashcards...',
  'quiz': 'Generating quiz questions...',
  'feynman': 'Setting up explanation mode...',
  'blurting': 'Preparing recall session...',
  'arlo_chat': 'Loading Arlo assistant...',
  'arlo_teaching': 'Preparing teaching content...',
  'teaching': 'Loading lesson content...',
  'review': 'Setting up review session...',
  'practice': 'Preparing practice mode...',
};

const UniversalLoadingScreen = ({ 
  technique, 
  title, 
  subtitle, 
  showSkeleton = false, 
  showMessages = true 
}: UniversalLoadingScreenProps) => {
  const defaultTitle = title || loadingMessages[technique as keyof typeof loadingMessages] || 'Loading...';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="text-center space-y-8 animate-fade-in">
        {/* Technique Icon */}
        <div className="flex justify-center">
          <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl">
            <TechniqueIcon 
              technique={technique} 
              size={64} 
              className="text-white animate-bounce"
            />
          </div>
        </div>
        
        {/* Loading Content */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 animate-pulse">
            {defaultTitle}
          </h2>
          
          {subtitle && (
            <p className="text-gray-600 text-lg max-w-md mx-auto">
              {subtitle}
            </p>
          )}
          
          {/* Loading Spinner */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-indigo-200 rounded-full"></div>
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
            </div>
          </div>
        </div>
        
        {/* Loading Messages */}
        {showMessages && (
          <div className="max-w-md mx-auto">
            <LoadingMessages isVisible={true} />
          </div>
        )}
        
        {/* Optional Skeleton Content */}
        {showSkeleton && (
          <div className="mt-12 space-y-4 max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-lg animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-lg animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalLoadingScreen;