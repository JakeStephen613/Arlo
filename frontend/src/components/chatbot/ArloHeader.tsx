
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bot, Maximize2, Minimize2 } from 'lucide-react';

interface ArloHeaderProps {
  currentBlock?: {
    id: string;
    unit: string;
    technique: string;
    description: string;
    duration: number;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const ArloHeader = ({ currentBlock, isExpanded, onToggleExpand }: ArloHeaderProps) => {
  return (
    <div className="relative">
      {/* AI Header with indigo theme */}
      <div className="bg-gradient-to-r from-indigo-500/95 via-indigo-600/95 to-indigo-700/95 backdrop-blur-xl text-white rounded-t-2xl border-b border-white/20 shadow-xl">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            {/* Enhanced AI Avatar */}
            <div className="relative">
              <Avatar className="w-12 h-12 border-3 border-white/30 shadow-2xl ring-2 ring-indigo-300/50">
                <AvatarImage src="/api/placeholder/48/48" alt="ARLO AI Avatar" />
                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold text-lg">
                  <Bot className="w-6 h-6 animate-pulse" />
                </AvatarFallback>
              </Avatar>
              {/* Softer AI Activity Ring */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-300 to-indigo-500 rounded-full opacity-40 animate-ping"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-300 to-indigo-500 rounded-full opacity-30"></div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xl bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
                  ARLO
                </h3>
              </div>
              {currentBlock && (
                <p className="text-xs text-indigo-200 bg-white/10 px-2 py-1 rounded-full inline-block">
                  📚 Currently studying: {currentBlock.unit}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-all duration-200 hover:scale-110"
            >
              {isExpanded ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
        
        {/* AI Thinking Animation Bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-600 opacity-70">
          <div className="h-full bg-gradient-to-r from-white/40 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]"></div>
        </div>
      </div>
    </div>
  );
};

export default ArloHeader;
