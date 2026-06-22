import { supabase } from '@/integrations/supabase/client';

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;

const getHeaders = async (): Promise<HeadersInit> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
};

export const apiPost = async <T>(path: string, body: unknown, timeoutMs?: number): Promise<T> => {
  const headers = await getHeaders();
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller ? setTimeout(() => controller!.abort(), timeoutMs) : undefined;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

export const apiPostAnon = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
};
