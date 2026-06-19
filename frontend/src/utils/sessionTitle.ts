/**
 * Formats a session title/topic for display by adding "Study Session: " prefix
 * and truncating after 7 words with "..." if needed
 */
export const formatSessionTitle = (title: string | null | undefined): string => {
  if (!title || title.trim() === '') {
    return 'Study Session: Untitled';
  }
  
  const words = title.trim().split(/\s+/);
  if (words.length <= 7) {
    return `Study Session: ${title}`;
  }
  
  return `Study Session: ${words.slice(0, 7).join(' ')}...`;
};