import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Plus, Calendar, BookOpen, Clock, User, ArrowLeft, ChevronDown, ChevronRight, History, Brain, AlertCircle, FileText, CalendarIcon, Filter, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import FastSessionPlanner from '@/components/FastSessionPlanner';
import StudyPlanEditor from '@/components/StudyPlanEditor';
import { useStudySession } from '@/hooks/useStudySession';
import { StudyPlan } from '@/services/api';
import AppHeader from '@/components/layout/AppHeader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import SessionCompletionDetails from '@/components/session/SessionCompletionDetails';
import StudentSessionHistory from '@/components/StudentSessionHistory';
interface ConnectedStudent {
  id: string;
  full_name: string | null;
  email: string | null;
  link_id: string;
  created_at: string;
}
interface ExtendedStudyPlan extends StudyPlan {
  completion_data?: {
    completed_at: string;
    duration_minutes: number;
    review_sheet?: any;
    quiz_mistakes?: any[];
    flashcards?: any[];
  };
}
interface AssignedSession {
  id: string;
  title: string;
  description: string | null;
  session_plan: ExtendedStudyPlan;
  student_id: string;
  assigned_at: string;
  status: string;
  completed_at?: string;
  student_name: string | null;
  student_email: string | null;
}
interface StudentSessionHistory {
  id: string;
  timestamp: string;
  topic: string;
  duration_minutes: number;
  review_sheet: any;
  quiz_mistakes: any[];
  flashcards: any[];
  student_id: string;
  student_name: string | null;
  student_email: string | null;
}
const TutorDashboard = () => {
  const {
    user,
    userProfile,
    loading: authLoading,
    signOut
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [connectedStudents, setConnectedStudents] = useState<ConnectedStudent[]>([]);
  const [assignedSessions, setAssignedSessions] = useState<AssignedSession[]>([]);
  const [studentSessionHistory, setStudentSessionHistory] = useState<StudentSessionHistory[]>([]);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<ConnectedStudent | null>(null);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionNote, setSessionNote] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [viewingStudentHistory, setViewingStudentHistory] = useState<ConnectedStudent | null>(null);
  const {
    currentPlan,
    setCurrentPlan,
    appState,
    setAppState,
    handleGeneratePlan,
    isGenerating
  } = useStudySession();
  useEffect(() => {
    // Handle authentication and role checking
    if (!user && !authLoading) {
      // User is not authenticated, redirect to auth page
      navigate('/auth');
      return;
    }
    
    if (user && userProfile && userProfile.account_mode !== 'tutor') {
      // User is authenticated but not a tutor, redirect to main page
      navigate('/');
      return;
    }

    // User is authenticated and is a tutor
    if (user && userProfile?.account_mode === 'tutor') {
      fetchConnectedStudents();
      fetchAssignedSessions();
      fetchStudentSessionHistory();
    }
  }, [user, userProfile, authLoading, navigate]);
  const fetchConnectedStudents = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('tutor_student_links').select(`
          id,
          student_id,
          created_at,
          profiles!tutor_student_links_student_id_fkey (
            id,
            full_name,
            email
          )
        `).eq('tutor_id', user.id).eq('status', 'active');
      if (error) {
        console.error('Error fetching connected students:', error);
        toast({
          title: "Error",
          description: "Failed to load connected students.",
          variant: "destructive"
        });
      } else {
        const students = data?.map((link: any) => {
          return {
            id: link.profiles?.id || link.student_id,
            full_name: link.profiles?.full_name || 'No Name Available',
            email: link.profiles?.email || 'No Email Available',
            link_id: link.id,
            created_at: link.created_at
          };
        }) || [];
        setConnectedStudents(students);
      }
    } catch (error) {
      console.error('Error in fetchConnectedStudents:', error);
    }
  };
  const fetchAssignedSessions = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('assigned_sessions').select(`
          id,
          title,
          description,
          session_plan,
          student_id,
          assigned_at,
          status,
          completed_at,
          profiles!assigned_sessions_student_id_fkey (
            full_name,
            email
          )
        `).eq('tutor_id', user.id).order('assigned_at', {
        ascending: false
      });
      if (error) {
        console.error('Error fetching assigned sessions:', error);
        toast({
          title: "Error",
          description: "Failed to load assigned sessions.",
          variant: "destructive"
        });
      } else {
        const sessions = data?.map((session: any) => ({
          id: session.id,
          title: session.title,
          description: session.description,
          session_plan: session.session_plan,
          student_id: session.student_id,
          assigned_at: session.assigned_at,
          status: session.status,
          completed_at: session.completed_at,
          student_name: session.profiles?.full_name,
          student_email: session.profiles?.email
        })) || [];
        setAssignedSessions(sessions);
      }
    } catch (error) {
      console.error('Error in fetchAssignedSessions:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchStudentSessionHistory = async () => {
    if (!user) return;
    try {
      // Get all students connected to this tutor
      const {
        data: studentLinks,
        error: linksError
      } = await supabase.from('tutor_student_links').select('student_id').eq('tutor_id', user.id).eq('status', 'active');
      if (linksError) {
        console.error('Error fetching student links:', linksError);
        return;
      }
      if (!studentLinks || studentLinks.length === 0) {
        setStudentSessionHistory([]);
        return;
      }
      const studentIds = studentLinks.map(link => link.student_id);

      // Fetch session history for all connected students
      const {
        data: sessionData,
        error: sessionError
      } = await supabase.from('study_session_data').select(`
          id,
          timestamp,
          topic,
          duration_minutes,
          review_sheet,
          quiz_mistakes,
          flashcards,
          user_id
        `).in('user_id', studentIds).order('timestamp', {
        ascending: false
      });
      if (sessionError) {
        console.error('Error fetching student session history:', sessionError);
        return;
      }

      // Get profile data for students
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);

      const profilesMap = profilesData?.reduce((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {} as Record<string, any>) || {};
      const formattedHistory = sessionData?.map((session: any) => {
        const profile = profilesMap[session.user_id];
        return {
          id: session.id,
          timestamp: session.timestamp,
          topic: session.topic,
          duration_minutes: session.duration_minutes,
          review_sheet: session.review_sheet,
          quiz_mistakes: session.quiz_mistakes || [],
          flashcards: session.flashcards || [],
          student_id: session.user_id,
          student_name: profile?.full_name || null,
          student_email: profile?.email || null
        };
      }) || [];
      setStudentSessionHistory(formattedHistory);
    } catch (error) {
      console.error('Error in fetchStudentSessionHistory:', error);
    }
  };
  const getStudentHistory = (studentId: string) => {
    return studentSessionHistory.filter(session => session.student_id === studentId);
  };
  const toggleStudentHistory = (studentId: string) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };
  const copyTutorCode = async () => {
    if (userProfile?.tutor_code) {
      await navigator.clipboard.writeText(userProfile.tutor_code);
      toast({
        title: "Copied!",
        description: "Tutor code copied to clipboard."
      });
    }
  };
  const handleCreateSession = (student: ConnectedStudent) => {
    setSelectedStudent(student);
    setIsCreatingSession(true);
    setAppState('planning');
  };
  const handleAssignSession = async () => {
    if (!currentPlan || !selectedStudent || !user) {
      return;
    }
    try {
      if (editingSessionId) {
        // Update existing session
        const { error } = await supabase
          .from('assigned_sessions')
          .update({
            title: currentPlan.topic,
            description: sessionNote || null,
            session_plan: currentPlan as any,
            assigned_at: dueDate ? dueDate.toISOString() : new Date().toISOString()
          })
          .eq('id', editingSessionId);

        if (error) {
          console.error('Error updating session:', error);
          toast({
            title: "Error",
            description: "Failed to update session.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Session Updated!",
            description: `Study session updated for ${selectedStudent.full_name || selectedStudent.email}.`
          });
          handleCancelSession();
          fetchAssignedSessions();
        }
      } else {
        // Create new session
        const { error } = await supabase.from('assigned_sessions').insert({
          title: currentPlan.topic,
          description: sessionNote || null,
          session_plan: currentPlan as any,
          student_id: selectedStudent.id,
          tutor_id: user.id,
          assigned_at: dueDate ? dueDate.toISOString() : new Date().toISOString(),
          status: 'pending'
        });

        if (error) {
          console.error('Error assigning session:', error);
          toast({
            title: "Error",
            description: "Failed to assign session to student.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Session Assigned!",
            description: `Study session assigned to ${selectedStudent.full_name || selectedStudent.email}.`
          });
          handleCancelSession();
          fetchAssignedSessions();
        }
      }
    } catch (error) {
      console.error('Error in handleAssignSession:', error);
    }
  };
  const handleCancelSession = () => {
    setIsCreatingSession(false);
    setSelectedStudent(null);
    setCurrentPlan(null);
    setSessionNote('');
    setDueDate(undefined);
    setEditingSessionId(null);
    setAppState('planning');
  };
  if (authLoading || loading) {
    return <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>;
  }

  // Main tutor dashboard
  return <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <AppHeader userEmail={user?.email} appState="tutor-dashboard" onNewSession={() => {}} onSignOut={signOut} userAccountMode={userProfile?.account_mode} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {userProfile?.tutor_code && <Card className="mb-8 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-indigo-900 mb-2">Your Tutor Code</h3>
                  <p className="text-indigo-700">Share this code with students so they can connect to you</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xl font-mono px-4 py-2 bg-white border-indigo-300 text-indigo-600">
                    {userProfile.tutor_code}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={copyTutorCode} className="border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>}

        {/* Show session creation flow */}
        {isCreatingSession && selectedStudent && <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Button variant="ghost" onClick={handleCancelSession} className="mb-4 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">
                  Creating Session for {selectedStudent.full_name || selectedStudent.email}
                </h1>
                <p className="text-gray-600 mt-2">Build a study session using the same ARLO engine</p>
              </div>
            </div>

            {appState === 'planning' && <FastSessionPlanner onGeneratePlan={handleGeneratePlan} isGenerating={isGenerating} />}

            {appState === 'editing-plan' && currentPlan && <div className="space-y-6">
                <StudyPlanEditor plan={currentPlan} onSavePlan={setCurrentPlan} onStartSession={() => {}} onBack={() => setAppState('planning')} />
                
                {/* Modern Assignment Details Card */}
                <Card className="border-indigo-200 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50">
                  <CardHeader>
                    <CardTitle className="text-indigo-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Assignment Details
                    </CardTitle>
                    <CardDescription>
                      Add a note and due date for the student
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="note" className="text-gray-700 font-medium">Note for Student (Optional)</Label>
                      <Input id="note" value={sessionNote} onChange={e => setSessionNote(e.target.value)} placeholder="Focus on understanding the key concepts..." className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Due Date (Optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal border-gray-300 hover:bg-gray-50", !dueDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, "PPP 'at' p") : <span>Pick a date and time</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="pointer-events-auto" />
                          {dueDate && <div className="p-3 border-t">
                              <Label className="text-sm font-medium">Time</Label>
                              <Input type="time" defaultValue="12:00" onChange={e => {
                        if (dueDate && e.target.value) {
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = new Date(dueDate);
                          newDate.setHours(parseInt(hours), parseInt(minutes));
                          setDueDate(newDate);
                        }
                      }} className="mt-1" />
                            </div>}
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <Button onClick={handleAssignSession} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 mt-6">
                      {editingSessionId ? 'Update Session' : `Assign Session to ${selectedStudent.full_name || selectedStudent.email}`}
                    </Button>
                  </CardContent>
                </Card>
              </div>}
          </div>}

        {/* Show student history view */}
        {viewingStudentHistory && (
          <div className="mb-8">
            <StudentSessionHistory
              studentId={viewingStudentHistory.id}
              studentName={viewingStudentHistory.full_name}
              studentEmail={viewingStudentHistory.email}
              onBack={() => setViewingStudentHistory(null)}
            />
          </div>
        )}

        {/* Main Dashboard Content - only show when not creating session and not viewing history */}
        {!isCreatingSession && !viewingStudentHistory && <div className="space-y-8">
            {/* Section Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-3">
                <Users className="w-7 h-7 text-indigo-500" />
                Connected Students ({connectedStudents.length})
              </h2>
              <p className="text-gray-600 mt-2">
                Students who have connected using your tutor code
              </p>
            </div>

            {/* Students Grid */}
            {connectedStudents.length === 0 ? (
              <Card className="border-indigo-200 shadow-lg">
                <CardContent className="text-center py-16">
                  <Users className="w-20 h-20 text-indigo-300 mx-auto mb-6" />
                  <h3 className="text-xl font-medium text-gray-900 mb-3">No Connected Students</h3>
                  <p className="text-gray-600 text-lg">
                    Share your tutor code with students to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connectedStudents.map(student => {
                  const studentHistory = getStudentHistory(student.id);
                  const isExpanded = expandedStudents.has(student.id);
                  return (
                    <Card key={student.id} className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/40 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                      {/* Decorative Elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-100/60 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-100/40 to-transparent rounded-full translate-y-12 -translate-x-12"></div>
                      
                      <CardContent className="relative p-6 h-full flex flex-col">
                        {/* Student Avatar and Info */}
                        <div className="text-center mb-6">
                          <div className="relative mx-auto mb-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <User className="w-10 h-10 text-white" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-3 border-white shadow-sm"></div>
                          </div>
                          
                          <h4 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-indigo-700 transition-colors">
                            {student.full_name || student.email?.split('@')[0] || 'Unnamed Student'}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2 truncate">{student.email}</p>
                          <div className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            <Calendar className="w-3 h-3" />
                            Connected {new Date(student.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 mt-auto">
                          <Button 
                            variant="outline" 
                            onClick={e => {
                              e.stopPropagation();
                              setViewingStudentHistory(student);
                            }} 
                            className="w-full text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 transition-all duration-200 font-medium"
                          >
                            <History className="w-4 h-4 mr-2" />
                            View Completed Sessions
                          </Button>
                          
                          <Button 
                            onClick={e => {
                              e.stopPropagation();
                              handleCreateSession(student);
                            }} 
                            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Assign Session
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Assigned Sessions Section */}
            {(() => {
              // Filter out completed sessions and sort by due date (closest first)
              let incompleteSessions = assignedSessions
                .filter(session => session.status !== 'completed')
                .sort((a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime());

              // Apply student filter
              if (selectedStudentFilter !== 'all') {
                incompleteSessions = incompleteSessions.filter(session => session.student_id === selectedStudentFilter);
              }

              if (incompleteSessions.length === 0 && assignedSessions.filter(s => s.status !== 'completed').length === 0) return null;

              const today = new Date();
              today.setHours(23, 59, 59, 999); // End of today

              // Get unique students from assigned sessions for the filter
              const studentsMap = new Map();
              assignedSessions
                .filter(session => session.status !== 'completed')
                .forEach(session => {
                  if (!studentsMap.has(session.student_id)) {
                    studentsMap.set(session.student_id, {
                      id: session.student_id,
                      name: session.student_name || session.student_email?.split('@')[0] || 'Unknown Student'
                    });
                  }
                });
              const studentsWithSessions = Array.from(studentsMap.values())
                .sort((a, b) => a.name.localeCompare(b.name));
              
              return (
                <div className="space-y-6 mt-12">
                  <div className="relative">
                    {/* Student Filter - Top Left */}
                    <div className="absolute left-0 top-0 z-10">
                      <Select value={selectedStudentFilter} onValueChange={setSelectedStudentFilter}>
                        <SelectTrigger className="w-40 h-8 text-xs bg-white border border-gray-200 shadow-sm">
                          <Filter className="w-3 h-3 mr-1" />
                          <SelectValue placeholder="All Students" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                          <SelectItem value="all" className="text-xs">All Students</SelectItem>
                          {studentsWithSessions.map(student => (
                            <SelectItem key={student.id} value={student.id} className="text-xs">
                              {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Section Header */}
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-3">
                        <FileText className="w-7 h-7 text-indigo-500" />
                        Assigned Sessions ({incompleteSessions.length})
                      </h2>
                      <p className="text-gray-600 mt-2">
                        Sessions that need follow-up with students
                      </p>
                    </div>
                  </div>

                  <Card className="shadow-lg border-0">
                    <CardContent className="p-0">
                      <div className="divide-y divide-gray-100">
                        {incompleteSessions.map((session, index) => {
                          const dueDate = new Date(session.assigned_at);
                          const isDueToday = dueDate <= today;
                          
                          return (
                            <div 
                              key={session.id} 
                              className={cn(
                                "flex items-center justify-between p-6 hover:bg-gray-50 transition-colors duration-200",
                                isDueToday && "bg-red-50/50 hover:bg-red-50 border-l-4 border-red-500"
                              )}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
                                  isDueToday 
                                    ? "bg-gradient-to-br from-red-500 to-pink-600" 
                                    : "bg-gradient-to-br from-indigo-500 to-purple-600"
                                )}>
                                  {isDueToday ? (
                                    <AlertCircle className="w-6 h-6 text-white" />
                                  ) : (
                                    <BookOpen className="w-6 h-6 text-white" />
                                  )}
                                </div>
                                
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h4 className={cn(
                                      "font-semibold text-lg",
                                      isDueToday ? "text-red-900" : "text-gray-900"
                                    )}>
                                      {session.student_name || session.student_email?.split('@')[0] || 'Unknown Student'}
                                    </h4>
                                    {isDueToday && (
                                      <Badge variant="destructive" className="text-xs">
                                        Due Today
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      <span className={isDueToday ? "text-red-600 font-medium" : ""}>
                                        Due: {formatDate(session.assigned_at)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      <span>Created: {formatDate(session.assigned_at)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  const student = connectedStudents.find(s => s.id === session.student_id) || null;
                                  setSelectedStudent(student);
                                  setCurrentPlan(session.session_plan);
                                  setEditingSessionId(session.id);
                                  setSessionNote(session.description || '');
                                  setDueDate(session.assigned_at ? new Date(session.assigned_at) : undefined);
                                  setIsCreatingSession(true);
                                  setAppState('editing-plan');
                                }}
                                className={cn(
                                  "font-medium transition-all duration-200",
                                  isDueToday 
                                    ? "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" 
                                    : "text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                                )}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

          </div>}
      </div>
    </div>;
};
export default TutorDashboard;