
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg font-medium text-gray-700">Loading ARLO...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center bg-white/80 backdrop-blur-sm border border-indigo-100 shadow-xl">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Please Log In to Start Studying
          </h2>
          
          <p className="text-gray-600 mb-6">
            ARLO creates personalized study sessions and tracks your progress. 
            Sign in to access your learning dashboard.
          </p>
          
          <Button
            onClick={() => navigate('/auth')}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-2.5"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Go to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
