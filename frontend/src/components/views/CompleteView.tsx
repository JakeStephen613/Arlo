import SessionComplete from '@/components/SessionComplete';

interface CompleteViewProps {
  onEndSession: () => void;
  sessionData: unknown;
}

const CompleteView = ({ onEndSession, sessionData }: CompleteViewProps) => (
  <SessionComplete onEndSession={onEndSession} sessionData={sessionData} />
);

export default CompleteView;
