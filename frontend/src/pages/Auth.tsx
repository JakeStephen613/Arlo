
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BookOpen, Mail, Lock, User, GraduationCap, Users, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountMode, setAccountMode] = useState<'arlo_tutoring' | 'tutor'>('arlo_tutoring');
  const [tutorCode, setTutorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Handle email confirmation success (if any old confirmations come through)
    if (searchParams.get('type') === 'signup' && searchParams.get('token_hash')) {
      toast({
        title: "Welcome to ARLO! 🎉",
        description: "Your account has been confirmed successfully. You can now start studying!",
      });
    }

    // Redirect authenticated users to appropriate dashboard
    if (user) {
      // Check user's account mode and redirect accordingly
      const checkUserProfile = async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('account_mode')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile?.account_mode === 'tutor') {
            navigate('/tutor');
          } else {
            navigate('/');
          }
        } catch (error) {
          console.error('Error checking user profile:', error);
          // Default to main dashboard
          navigate('/');
        }
      };
      checkUserProfile();
    }
  }, [user, navigate, searchParams, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, accountMode, fullName);

        if (error) {
          let errorMessage = error.message;
          if (error.message.includes('User already registered')) {
            errorMessage = 'An account with this email already exists. Try signing in instead.';
          } else if (error.message.includes('Password should be at least')) {
            errorMessage = 'Password must be at least 6 characters long.';
          }

          toast({
            title: "Registration Error",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          // If signup was successful and user is a student with a tutor code, connect to tutor
          if (accountMode === 'arlo_tutoring' && tutorCode.trim()) {
            try {
              await connectToTutorDuringSignup(tutorCode.trim());
            } catch (tutorError) {
              console.error('Error connecting to tutor during signup:', tutorError);
              // Don't fail the signup if tutor connection fails
              toast({
                title: "Account Created Successfully! 🎉",
                description: "Your account was created but we couldn't connect to the tutor. You can connect later using the tutor code.",
                variant: "default",
              });
              return;
            }
          }
          
          toast({
            title: "Welcome to ARLO! 🎉",
            description: `Account created successfully as ${accountMode === 'tutor' ? 'tutor' : 'student'}! ${tutorCode.trim() && accountMode === 'arlo_tutoring' ? 'Connected to tutor successfully!' : `You can now start ${accountMode === 'tutor' ? 'teaching' : 'studying'}.`}`,
          });
        }
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          let errorMessage = error.message;
          if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          }

          toast({
            title: "Authentication Error",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back to ARLO! 🎓",
            description: "Successfully signed in. Ready to start studying?",
          });
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const connectToTutorDuringSignup = async (code: string) => {
    // Get the current user after signup
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      throw new Error('No user found after signup');
    }

    // Search for tutor with the provided code
    const { data: tutorProfiles, error: tutorSearchError } = await supabase
      .from('profiles')
      .select('id, full_name, account_mode, tutor_code, email')
      .ilike('tutor_code', code.toUpperCase());

    if (tutorSearchError) {
      throw new Error('Failed to search for tutor');
    }

    if (!tutorProfiles || tutorProfiles.length === 0) {
      throw new Error('No tutor found with that code');
    }

    const tutorProfile = tutorProfiles[0];

    if (tutorProfile.account_mode !== 'tutor') {
      throw new Error('The provided code does not belong to a tutor account');
    }

    // Create the tutor-student link
    const { error: linkError } = await supabase
      .from('tutor_student_links')
      .insert({
        tutor_id: tutorProfile.id,
        student_id: currentUser.id,
        status: 'active'
      });

    if (linkError) {
      throw new Error('Failed to connect to tutor');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ARLO</h1>
          <p className="text-indigo-600 font-medium">AI Personal Tutor</p>
        </div>

        {/* Auth Card */}
        <Card className="p-8 bg-white/80 backdrop-blur-sm border border-indigo-100 shadow-xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignUp ? 'Join ARLO Today' : 'Welcome Back to ARLO'}
            </h2>
            <p className="text-gray-600">
              {isSignUp 
                ? 'Create your account and start your personalized learning journey' 
                : 'Continue your learning journey with AI-powered study sessions'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  I am a...
                </Label>
                <RadioGroup 
                  value={accountMode} 
                  onValueChange={(value) => setAccountMode(value as 'arlo_tutoring' | 'tutor')}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50">
                    <RadioGroupItem value="arlo_tutoring" id="arlo_tutoring" />
                    <Label htmlFor="arlo_tutoring" className="flex items-center gap-2 cursor-pointer">
                      <GraduationCap className="w-4 h-4 text-indigo-500" />
                      Student
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50">
                    <RadioGroupItem value="tutor" id="tutor" />
                    <Label htmlFor="tutor" className="flex items-center gap-2 cursor-pointer">
                      <Users className="w-4 h-4 text-purple-500" />
                      Tutor
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Tutor Code Input for Students */}
            {isSignUp && accountMode === 'arlo_tutoring' && (
              <div className="space-y-2">
                <Label htmlFor="tutorCode" className="text-sm font-medium text-gray-700">
                  Tutor Code (Optional)
                </Label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="tutorCode"
                    type="text"
                    placeholder="Enter 6-character tutor code"
                    value={tutorCode}
                    onChange={(e) => setTutorCode(e.target.value.toUpperCase())}
                    className="pl-10"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Have a tutor code? Enter it here to connect during signup, or connect later.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-2.5"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {isSignUp ? 'Create ARLO Account' : 'Sign In to ARLO'}
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isSignUp ? 'Already have an ARLO account?' : "Don't have an ARLO account?"}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="ml-1 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          By continuing, you agree to ARLO's terms of service and privacy policy.
        </div>
      </div>
    </div>
  );
};

export default Auth;
