
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CreateTestTutor = () => {
  const [loading, setLoading] = useState(false);
  const [tutorEmail, setTutorEmail] = useState('');
  const [tutorName, setTutorName] = useState('');
  const [createdTutorCode, setCreatedTutorCode] = useState('');
  const { toast } = useToast();

  const createTestTutor = async () => {
    if (!tutorEmail || !tutorName) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and name for the test tutor.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate a tutor code
      const { data: tutorCode, error: codeError } = await supabase.rpc('generate_tutor_code');
      
      if (codeError) {
        console.error('Error generating tutor code:', codeError);
        toast({
          title: "Code Generation Failed",
          description: "Failed to generate tutor code. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Create a fake user ID (in a real app, this would come from actual user signup)
      const fakeUserId = crypto.randomUUID();

      // Create the tutor profile directly in the profiles table
      const { data: tutorProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: fakeUserId,
          email: tutorEmail,
          full_name: tutorName,
          account_mode: 'tutor',
          tutor_code: tutorCode
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating tutor profile:', profileError);
        toast({
          title: "Profile Creation Failed",
          description: `Failed to create tutor profile: ${profileError.message}`,
          variant: "destructive",
        });
        return;
      }

      setCreatedTutorCode(tutorCode);
      
      toast({
        title: "Test Tutor Created! 🎉",
        description: `Tutor "${tutorName}" created with code: ${tutorCode}`,
      });

      // Clear form
      setTutorEmail('');
      setTutorName('');
    } catch (error) {
      console.error('Error creating test tutor:', error);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred while creating the test tutor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyTutorCode = () => {
    navigator.clipboard.writeText(createdTutorCode);
    toast({
      title: "Copied!",
      description: "Tutor code copied to clipboard.",
    });
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <UserPlus className="w-5 h-5" />
          Create Test Tutor
        </CardTitle>
        <CardDescription>
          Create a test tutor profile for testing the connection functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tutorEmail">Tutor Email</Label>
            <Input
              id="tutorEmail"
              type="email"
              placeholder="tutor@example.com"
              value={tutorEmail}
              onChange={(e) => setTutorEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tutorName">Tutor Name</Label>
            <Input
              id="tutorName"
              placeholder="John Doe"
              value={tutorName}
              onChange={(e) => setTutorName(e.target.value)}
            />
          </div>
        </div>
        
        <Button 
          onClick={createTestTutor}
          disabled={!tutorEmail || !tutorName || loading}
          className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Create Test Tutor
            </div>
          )}
        </Button>

        {createdTutorCode && (
          <div className="mt-4 p-4 bg-white/60 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Tutor Code Created:</p>
                <p className="text-2xl font-mono font-bold text-green-600">{createdTutorCode}</p>
              </div>
              <Button
                onClick={copyTutorCode}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreateTestTutor;
