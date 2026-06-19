
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface AddStudyBlockCardProps {
  onAddBlock: () => void;
}

const AddStudyBlockCard = ({ onAddBlock }: AddStudyBlockCardProps) => {
  return (
    <Card className="border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-colors">
      <CardContent className="p-6">
        <Button
          onClick={onAddBlock}
          variant="ghost"
          className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-indigo-600"
        >
          <Plus className="w-5 h-5" />
          Add Custom Study Block
        </Button>
      </CardContent>
    </Card>
  );
};

export default AddStudyBlockCard;
