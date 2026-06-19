import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Upload, BookOpen, Sparkles, FileText, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DragDropUpload } from '@/components/ui/drag-drop-upload';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;

interface FastSessionPlannerProps {
  onGeneratePlan: (planData: PlanInputData) => void;
  isGenerating: boolean;
}
export interface PlanInputData {
  topic: string;
  goals: string;
  duration: number;
  targetLevel: string;
  uploadedFile?: File;
  pdfContent?: string;
}
const LOADING_MESSAGES = ["Parsing your PDF content...", "Analyzing study materials...", "Optimizing session timing with Pomodoro logic...", "Building your personalized learning flow…"];
const FastSessionPlanner = ({
  onGeneratePlan,
  isGenerating
}: FastSessionPlannerProps) => {
  const [studyObjective, setStudyObjective] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [duration, setDuration] = useState([60]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isParsing, setParsing] = useState(false);
  const [pdfParseError, setPdfParseError] = useState<string | null>(null);
  const {
    toast
  } = useToast();

  // Rotate loading messages every 2 seconds
  useEffect(() => {
    if (isGenerating || isParsing) {
      const interval = setInterval(() => {
        setCurrentMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isGenerating, isParsing]);
  const parsePDF = async (file: File): Promise<string | null> => {
    try {
      setParsing(true);
      setPdfParseError(null);
      const formData = new FormData();
      formData.append('file', file);

      // Try the backend PDF parser first
      const response = await fetch(`${API_BASE_URL}/pdf/parse`, {
        method: 'POST',
        body: formData,
        headers: {
          'accept': 'text/plain'
        }
      });
      if (!response.ok) {
        throw new Error(`PDF parsing failed: ${response.status} ${response.statusText}`);
      }
      const content = await response.text();
      if (!content || content.trim() === '') {
        throw new Error('PDF content could not be extracted. Please try a different file or describe your learning objective.');
      }
      return content;
    } catch (error) {
      console.error('❌ PDF parsing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to process the PDF';
      setPdfParseError(errorMessage);

      // Show user-friendly error message
      toast({
        title: "PDF processing failed",
        description: "We couldn't process your PDF. You can still continue by describing your learning objective.",
        variant: "destructive"
      });
      return null;
    } finally {
      setParsing(false);
    }
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only",
        variant: "destructive"
      });
      event.target.value = '';
      return;
    }
    setUploadedFile(file);
    setPdfContent(null);
    setPdfParseError(null);
    toast({
      title: "PDF uploaded successfully",
      description: `${file.name} is being processed...`
    });

    // Automatically parse the PDF
    const content = await parsePDF(file);
    if (content) {
      setPdfContent(content);
      toast({
        title: "PDF processed successfully",
        description: "Your PDF content is ready for study plan generation"
      });
    }
  };

  const handleDragDropFileUpload = async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only",
        variant: "destructive"
      });
      return;
    }

    setUploadedFile(file);
    setPdfContent(null);
    setPdfParseError(null);
    toast({
      title: "PDF uploaded successfully",
      description: `${file.name} is being processed...`
    });

    // Automatically parse the PDF
    const content = await parsePDF(file);
    if (content) {
      setPdfContent(content);
      toast({
        title: "PDF processed successfully",
        description: "Your PDF content is ready for study plan generation"
      });
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if we're still parsing PDF
    if (isParsing) {
      toast({
        title: "Please wait",
        description: "PDF is still being processed. Please wait for it to complete.",
        variant: "destructive"
      });
      return;
    }

    // Validate that we have either an objective or PDF content
    const hasObjective = studyObjective.trim().length > 0;
    const hasPdfContent = pdfContent && pdfContent.trim().length > 0;
    if (!hasObjective && !hasPdfContent) {
      toast({
        title: "Missing study information",
        description: "Please describe your learning objective or upload a PDF before continuing.",
        variant: "destructive"
      });
      return;
    }
    setCurrentMessageIndex(0);

    // Generate study plan with processed data
    onGeneratePlan({
      topic: studyObjective.trim() || 'General Study Session',
      goals: studyObjective.trim(),
      duration: duration[0],
      targetLevel: 'college',
      // Default level
      uploadedFile: uploadedFile || undefined,
      pdfContent: pdfContent || undefined
    });
  };
  const hasValidInput = studyObjective.trim().length > 0 || pdfContent && pdfContent.trim().length > 0;
  const canSubmit = hasValidInput && !isParsing && !isGenerating;
  return <div className="max-w-4xl mx-auto">
      {/* Floating Container with Glow Effect */}
      <div className="relative">
        {/* Ambient Glow Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20 rounded-3xl blur-xl transform scale-105"></div>
        
        {/* Main Container with Border */}
        <div className="relative bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30 rounded-3xl shadow-2xl border border-indigo-200/50 dark:border-indigo-800/50 overflow-hidden">
          
          {/* Compact Banner Header */}
          <div className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 p-5 relative overflow-hidden">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full transform -translate-x-16 -translate-y-16 animate-pulse"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full transform translate-x-12 translate-y-12 animate-pulse delay-1000"></div>
            </div>
            
            <div className="relative flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-wide">Start Learning</h1>
                <p className="text-indigo-100 text-xs font-medium">AI-powered study sessions</p>
              </div>
            </div>
          </div>

          {/* Enhanced Main Content */}
          <div className="p-8 relative">
            {/* Decorative Corner Elements */}
            <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
            <div className="absolute bottom-4 left-4 w-1 h-1 bg-purple-400 rounded-full animate-ping delay-500"></div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Enhanced PDF Upload Section with Hover Effects */}
              <div className="space-y-4 group">
                <div className="transform transition-all duration-300 group-hover:scale-[1.02]">
                  <DragDropUpload
                    onFileUpload={handleDragDropFileUpload}
                    uploadedFile={uploadedFile}
                    isParsing={isParsing}
                    parseError={pdfParseError}
                    parsedContent={pdfContent}
                    disabled={isParsing}
                    title="Drop your PDF here"
                    description="Notes, textbooks, or study materials"
                  />
                </div>

                {/* Animated Success/Error States */}
                {pdfContent && (
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-scale-in shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">PDF ready to analyze</span>
                    </div>
                  </div>
                )}

                {pdfParseError && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800 rounded-xl animate-scale-in shadow-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mt-0.5">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <span className="font-semibold text-red-800 dark:text-red-300 block">Upload failed</span>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{pdfParseError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Study Goals with Gradient Border */}
              <div className="space-y-4">
                <Label htmlFor="study-objective" className="text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                  What do you want to learn?
                </Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <Textarea 
                    id="study-objective" 
                    placeholder="Describe your learning goal or topic..." 
                    value={studyObjective} 
                    onChange={e => setStudyObjective(e.target.value)} 
                    className="relative min-h-[80px] text-base border-2 border-border hover:border-indigo-300 focus:border-indigo-500 transition-all duration-300 resize-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl shadow-sm" 
                    rows={3} 
                    disabled={isParsing} 
                  />
                </div>
              </div>

              {/* Exciting Duration Picker with Visual Enhancements */}
              <div className="space-y-5">
                <Label className="text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  Session Length: {duration[0]} minutes
                </Label>
                
                {/* Enhanced Duration Preset Buttons */}
                <div className="grid grid-cols-4 gap-3">
                  {[30, 60, 90, 120].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={duration[0] === preset ? "default" : "outline"}
                      size="lg"
                      onClick={() => setDuration([preset])}
                      disabled={isParsing}
                      className={`relative overflow-hidden transition-all duration-300 ${
                        duration[0] === preset 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg transform scale-105' 
                          : 'hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:scale-105'
                      }`}
                    >
                      <span className="relative z-10 font-semibold">{preset}m</span>
                      {duration[0] === preset && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
                      )}
                    </Button>
                  ))}
                </div>
                
                <div className="relative">
                  <Slider 
                    value={duration} 
                    onValueChange={setDuration} 
                    max={120} 
                    min={15} 
                    step={15} 
                    className="w-full" 
                    disabled={isParsing} 
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2 font-medium">
                    <span>15min</span>
                    <span>120min</span>
                  </div>
                </div>
              </div>

              {/* Spectacular Generate Button */}
              <div className="pt-6">
                <div className="relative group">
                  {/* Button Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
                  
                  <Button 
                    type="submit" 
                    disabled={!canSubmit} 
                    size="lg"
                    className="relative w-full h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 text-white text-xl font-bold shadow-2xl hover:shadow-indigo-500/50 transition-all duration-500 disabled:opacity-50 rounded-2xl border border-indigo-400/50 overflow-hidden group"
                  >
                    {/* Animated Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 transform -skew-x-12 group-hover:animate-pulse"></div>
                    
                    {/* Button Content */}
                    <div className="relative z-10 flex items-center justify-center gap-4">
                      {isGenerating || isParsing ? (
                        <>
                          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{isParsing ? 'Processing...' : 'Creating Plan...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-6 h-6 animate-pulse" />
                          <span>Generate AI Study Plan</span>
                          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                        </>
                      )}
                    </div>
                  </Button>
                </div>
                
                {/* Enhanced Status Messages */}
                {!hasValidInput && !isParsing && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                      <span className="font-medium">💡 Add content or upload a PDF to get started</span>
                    </p>
                  </div>
                )}
                
                {(isGenerating || isParsing) && (
                  <div className="text-center mt-4">
                    <p className="text-base text-indigo-600 dark:text-indigo-400 font-bold animate-fade-in bg-indigo-50 dark:bg-indigo-950/30 px-6 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      ✨ {LOADING_MESSAGES[currentMessageIndex]}
                    </p>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>;
};
export default FastSessionPlanner;