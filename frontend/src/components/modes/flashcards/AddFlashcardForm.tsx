
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Save } from 'lucide-react';

interface AddFlashcardFormProps {
  onSave: (front: string, back: string) => void;
  onCancel: () => void;
}

const AddFlashcardForm = ({ onSave, onCancel }: AddFlashcardFormProps) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const handleSave = () => {
    if (front.trim() && back.trim()) {
      onSave(front.trim(), back.trim());
      setFront('');
      setBack('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <Card className="border-2 border-indigo-200 bg-indigo-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Add New Flashcard</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Front (Question)
            </label>
            <Textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter the question or front side of the card..."
              className="min-h-[80px] resize-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Back (Answer)
            </label>
            <Textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter the answer or back side of the card..."
              className="min-h-[80px] resize-none"
            />
          </div>
          
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!front.trim() || !back.trim()}
              size="sm"
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Card
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Tip: Press Ctrl+Enter to save quickly
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AddFlashcardForm;
