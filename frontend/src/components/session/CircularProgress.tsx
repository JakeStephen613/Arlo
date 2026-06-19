
interface CircularProgressProps {
  progress: number;
  size?: number;
  timeRemaining: number;
  technique: string;
}

const techniqueColors = {
  flashcards: 'text-blue-500',
  feynman: 'text-green-500',
  blurting: 'text-purple-500',
  quiz: 'text-red-500',
  teaching: 'text-green-500',
};

const CircularProgress = ({ progress, size = 120, timeRemaining, technique }: CircularProgressProps) => {
  const radius = (size - 8) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const getTechniqueColor = (technique: string) => {
    return techniqueColors[technique as keyof typeof techniqueColors] || 'text-indigo-500';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={`transition-all duration-300 ${getTechniqueColor(technique)}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-gray-700">
          {formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  );
};

export default CircularProgress;
