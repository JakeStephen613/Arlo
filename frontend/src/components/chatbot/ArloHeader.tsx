
import { Button } from '@/components/ui/button';
import { Bot, X } from 'lucide-react';

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
    <div className="flex items-center justify-between px-4 py-3 border-b bg-card rounded-t-xl">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Arlo</h3>
          {currentBlock && (
            <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
              {currentBlock.unit}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleExpand}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default ArloHeader;
