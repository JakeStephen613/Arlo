import { apiPostAnon } from '@/lib/apiClient';

interface TeachingLesson {
  title: string;
  content: string | string[];
}

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

interface TeachingResponse {
  lesson?: TeachingLesson[];
  lessons?: TeachingLesson[];
  quiz?: TeachingLesson[];
  youtube_video?: YouTubeVideo;
}

const teachingContentCache = new Map<string, TeachingResponse>();
const ongoingRequests = new Map<string, Promise<TeachingResponse>>();

export const fetchTeachingContent = async (description: string): Promise<TeachingResponse> => {
  const cached = teachingContentCache.get(description);
  if (cached) return cached;

  const ongoing = ongoingRequests.get(description);
  if (ongoing) return ongoing;

  const requestPromise = performTeachingRequest(description);
  ongoingRequests.set(description, requestPromise);

  try {
    const result = await requestPromise;
    teachingContentCache.set(description, result);
    return result;
  } finally {
    ongoingRequests.delete(description);
  }
};

const performTeachingRequest = async (description: string): Promise<TeachingResponse> => {
  const cleanDescription =
    typeof description === 'string'
      ? description
      : typeof description === 'object' && description !== null && 'description' in description
        ? (description as { description: string }).description
        : String(description);

  const data = await apiPostAnon<TeachingResponse>('/combined', {
    teaching_description: cleanDescription,
  });

  if (data.quiz && !data.lesson && !data.lessons) {
    const fallback: TeachingLesson[] = [
      {
        type: 'section',
        title: `Understanding ${description}`,
        content: `Let's explore the key concepts and principles related to ${description}. This lesson will help you build a solid foundation for understanding this topic.`,
      },
      {
        type: 'section',
        title: 'Key Concepts',
        content: `Here are the important aspects you should focus on when studying ${description}:`,
      },
      {
        type: 'bullet_list',
        title: 'Main Points to Remember',
        content: [
          'Focus on understanding the core principles',
          'Pay attention to practical applications',
          'Connect concepts to real-world examples',
          'Practice applying what you learn',
        ],
      },
      {
        type: 'section',
        title: 'Study Strategy',
        content: `When studying ${description}, remember to break down complex concepts into smaller, manageable parts.`,
      },
    ];
    return { lesson: fallback };
  }

  return data;
};

export const clearTeachingCache = () => {
  teachingContentCache.clear();
  ongoingRequests.clear();
};
