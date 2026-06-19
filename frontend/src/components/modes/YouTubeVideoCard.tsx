import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, ExternalLink, Clock, Eye, AlertTriangle, X } from 'lucide-react';

interface YouTubeVideo {
  title: string;
  video_id: string;
  url: string;
  thumbnail: string;
  duration: string;
  channel_title: string;
  view_count: number;
  published_at: string;
  query_used: string;
  relevant_segments: Array<{
    start_time: string;
    end_time: string;
    topic: string;
    relevance_score: number;
  }>;
}

interface YouTubeVideoCardProps {
  video: YouTubeVideo;
  onNext: () => void;
  onSkip: () => void;
}

const YouTubeVideoCard = ({ video, onNext, onSkip }: YouTubeVideoCardProps) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M views`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K views`;
    }
    return `${count} views`;
  };

  const formatPublishedDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  };

  const getEmbedUrl = (segment?: any) => {
    let embedUrl = `https://www.youtube.com/embed/${video.video_id}?autoplay=1`;
    
    if (segment && segment.start_time && segment.end_time) {
      const startSeconds = timeToSeconds(segment.start_time);
      const endSeconds = timeToSeconds(segment.end_time);
      embedUrl += `&start=${startSeconds}&end=${endSeconds}`;
    }
    
    return embedUrl;
  };

  const timeToSeconds = (timeString: string) => {
    const parts = timeString.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
  };

  const handlePlaySegment = (segment: any) => {
    setSelectedSegment(segment);
    setShowPlayer(true);
  };

  const handlePlayFull = () => {
    setSelectedSegment(null);
    setShowPlayer(true);
  };

  if (showPlayer) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            {selectedSegment ? `${selectedSegment.topic}` : video.title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPlayer(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="aspect-video mb-4">
            <iframe
              src={getEmbedUrl(selectedSegment)}
              title={video.title}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="flex justify-between">
            <Button onClick={() => setShowPlayer(false)} variant="outline">
              Back to Video Info
            </Button>
            <Button onClick={onNext} className="bg-indigo-500 hover:bg-indigo-600">
              Continue Learning
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            YouTube Feature in Beta Stage
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Skip if unhelpful or irrelevant
        </p>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Supplementary Video Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative group cursor-pointer" onClick={handlePlayFull}>
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full aspect-video object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center rounded-lg group-hover:bg-opacity-40 transition-opacity">
            <div className="bg-white bg-opacity-90 rounded-full p-4">
              <Play className="h-8 w-8 text-indigo-600 ml-1" />
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{video.title}</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{video.channel_title}</span>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {video.duration}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {formatViewCount(video.view_count)}
            </div>
            <span>{formatPublishedDate(video.published_at)}</span>
          </div>
        </div>

        {/* Relevant Segments */}
        {video.relevant_segments && video.relevant_segments.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Most Relevant Sections:</h4>
            <div className="flex flex-wrap gap-2">
              {video.relevant_segments.map((segment, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePlaySegment(segment)}
                  className="text-xs"
                >
                  {segment.start_time} - {segment.topic}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4">
          <div className="flex gap-2">
            <Button onClick={handlePlayFull} className="bg-indigo-500 hover:bg-indigo-600">
              <Play className="h-4 w-4 mr-2" />
              Watch Video
            </Button>
            <Button
              onClick={() => window.open(video.url, '_blank')}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in YouTube
            </Button>
          </div>
          <Button onClick={onSkip} variant="ghost">
            Skip Video
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default YouTubeVideoCard;