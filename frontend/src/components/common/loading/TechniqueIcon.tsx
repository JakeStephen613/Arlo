
import { TECHNIQUES } from '@/lib/techniques';
import { Brain } from 'lucide-react';

interface TechniqueIconProps {
  technique: string;
  size?: number;
  className?: string;
}

const TechniqueIcon = ({ technique, size = 48, className = "" }: TechniqueIconProps) => {
  const IconComponent = TECHNIQUES[technique.toLowerCase()]?.icon ?? Brain;

  return (
    <div className={`animate-bounce ${className}`}>
      <IconComponent size={size} />
    </div>
  );
};

export default TechniqueIcon;
