import { PlanInputData } from '@/components/FastSessionPlanner';
import { apiPost } from '@/lib/apiClient';
import type { StudyPlan } from '@/types';
export type { StudyPlan } from '@/types';

interface ApiPlanPayload {
  duration: number;
  objective?: string;
  parsed_summary?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const generateStudyPlan = async (planData: PlanInputData): Promise<StudyPlan> => {
  const payload: ApiPlanPayload = { duration: planData.duration };
  if (planData.goals?.trim()) payload.objective = planData.goals.trim();
  if (planData.pdfContent?.trim()) payload.parsed_summary = planData.pdfContent.trim();

  try {
    const rawData = await apiPost<Record<string, unknown>>('/study-session', payload);
    const { validateAndFixStudyPlan } = await import('@/utils/studyPlanValidation');
    return validateAndFixStudyPlan(rawData) as StudyPlan;
  } catch (error) {
    throw new Error(`Study plan generation failed: ${(error as Error).message}`);
  }
};
