
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TutorConnectionCard = () => {
  const [tutorCode, setTutorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const connectToTutor = async () => {
    if (!user || !tutorCode || !userProfile) {
      toast({
        title: "Error",
        description: "Please ensure you're logged in and have entered a tutor code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      
      // First, let's check what profiles exist at all (for debugging)
      const { data: allProfilesDebug, error: debugError } = await supabase
        .from('profiles')
        .select('id, full_name, account_mode, tutor_code, email');


      // Search for profiles with the specific tutor code (case-insensitive)
      const { data: tutorProfiles, error: tutorSearchError } = await supabase
        .from('profiles')
        .select('id, full_name, account_mode, tutor_code, email')
        .ilike('tutor_code', tutorCode.toUpperCase());


      if (tutorSearchError) {
        console.error('Error searching for tutor profiles:', tutorSearchError);
        toast({
          title: "Search Error",
          description: `Failed to search for tutor: ${tutorSearchError.message}`,
          variant: "destructive",
        });
        return;
      }

      // If no profiles found with this code
      if (!tutorProfiles || tutorProfiles.length === 0) {
        toast({
          title: "Tutor Code Not Found",
          description: "No profile found with that tutor code. Please check the code and try again.",
          variant: "destructive",
        });
        return;
      }

      // Find the tutor profile (account_mode = 'tutor')
      const tutorProfile = tutorProfiles.find(profile => profile.account_mode === 'tutor');

      if (!tutorProfile) {
        const nonTutorProfile = tutorProfiles[0];
        toast({
          title: "Invalid Account Type",
          description: `The code belongs to a ${nonTutorProfile.account_mode} account, not a tutor.`,
          variant: "destructive",
        });
        return;
      }


      // Check if connection already exists
      const { data: existingLink, error: linkCheckError } = await supabase
        .from('tutor_student_links')
        .select('id')
        .eq('tutor_id', tutorProfile.id)
        .eq('student_id', user.id)
        .maybeSingle();


      if (linkCheckError) {
        console.error('Error checking existing link:', linkCheckError);
        toast({
          title: "Connection Check Failed",
          description: `Failed to check existing connections: ${linkCheckError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (existingLink) {
        toast({
          title: "Already Connected",
          description: `You are already connected to ${tutorProfile.full_name || 'this tutor'}.`,
        });
        setTutorCode('');
        return;
      }

      // Create connection
      
      const { data: newLink, error: linkError } = await supabase
        .from('tutor_student_links')
        .insert({
          tutor_id: tutorProfile.id,
          student_id: user.id,
          status: 'active'
        })
        .select()
        .single();


      if (linkError) {
        console.error('Error creating tutor connection:', linkError);
        toast({
          title: "Connection Failed",
          description: `Failed to connect to tutor: ${linkError.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connected Successfully! 🎉",
          description: `You are now connected to ${tutorProfile.full_name || 'your tutor'}. They can now assign you study sessions.`,
        });
        setTutorCode('');
      }
    } catch (error) {
      console.error('Error in connectToTutor:', error);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show if user has arlo_tutoring account mode
  if (!userProfile || userProfile.account_mode !== 'arlo_tutoring') {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <Users className="w-5 h-5" />
          Connect to Tutor
        </CardTitle>
        <CardDescription>
          Enter your tutor's code to connect and receive personalized study sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tutorCode">Tutor Code</Label>
          <Input
            id="tutorCode"
            placeholder="Enter 6-character code"
            value={tutorCode}
            onChange={(e) => setTutorCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="uppercase text-center font-mono"
          />
        </div>
        <Button 
          onClick={connectToTutor}
          disabled={!tutorCode || tutorCode.length !== 6 || loading}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Connect to Tutor
            </div>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TutorConnectionCard;
