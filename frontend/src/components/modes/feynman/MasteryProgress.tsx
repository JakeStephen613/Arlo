import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
interface MasteryProgressProps {
  level: 'seedling' | 'sprout' | 'tree';
  progress: number; // 0-100
  attempts: number;
}
const MasteryProgress = ({
  level,
  progress,
  attempts
}: MasteryProgressProps) => {
  const getLevelInfo = () => {
    switch (level) {
      case 'seedling':
        return {
          emoji: '🌱',
          title: 'Seedling',
          description: 'Just getting started',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300'
        };
      case 'sprout':
        return {
          emoji: '🌿',
          title: 'Sprout',
          description: 'Growing understanding',
          color: 'bg-green-100 text-green-800 border-green-300'
        };
      case 'tree':
        return {
          emoji: '🌳',
          title: 'Tree',
          description: 'Strong mastery',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300'
        };
    }
  };
  const levelInfo = getLevelInfo();
  return <Card className="border-2 border-dashed border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">{levelInfo.emoji}</span>
          Mastery Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <Badge className={`${levelInfo.color} text-sm px-3 py-1`}>
            {levelInfo.title}
          </Badge>
          <p className="text-sm text-gray-600 mt-1">{levelInfo.description}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Understanding Level</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Attempts: {attempts}
          </p>
          {level === 'seedling' && progress < 50 && <p className="text-xs text-gray-500 mt-1">
              Keep explaining to grow your understanding! 🌱→🌿
            </p>}
          {level === 'sprout' && progress < 80}
          {level === 'tree' && <p className="text-xs text-green-600 mt-1 font-medium">
              🎉 Excellent mastery! You truly understand this concept!
            </p>}
        </div>
      </CardContent>
    </Card>;
};
export default MasteryProgress;