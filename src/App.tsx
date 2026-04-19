import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  FileText, 
  Briefcase, 
  Mail, 
  ArrowRight, 
  ChevronRight,
  Download,
  Loader2,
  Trash2,
  Plus,
  Github,
  Linkedin,
  Globe,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  ArrowLeft,
  X,
  CreditCard,
  Check,
  Building2,
  Users
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from './lib/utils';
import { generateResume, tailorResume, checkATSScore } from './services/geminiService';
import { ResumeData } from './types';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  getResumesFromFirestore, 
  saveResumeToFirestore, 
  saveUserToFirestore,
  deleteResumeFromFirestore 
} from './lib/firestoreService';

type ActiveView = 'landing' | 'input' | 'result' | 'dashboard';

export default function App() {
  const [view, setView] = useState<ActiveView>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [currentResume, setCurrentResume] = useState<ResumeData | null>(null);
  const [savedResumes, setSavedResumes] = useState<ResumeData[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [atsFeedback, setAtsFeedback] = useState<{ score: number; missingKeywords: string[] } | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await saveUserToFirestore(u);
        const resumes = await getResumesFromFirestore();
        setSavedResumes(resumes);
      } else {
        setSavedResumes([]);
      }
    });
    return () => unsub();
  }, []);

  const handleSaveResume = async (resume: ResumeData) => {
    if (!user) return;
    try {
      const id = await saveResumeToFirestore(resume);
      const updatedResume = { ...resume, id };
      setSavedResumes(prev => {
        const index = prev.findIndex(r => r.id === id);
        if (index > -1) {
          const next = [...prev];
          next[index] = updatedResume;
          return next;
        }
        return [updatedResume, ...prev];
      });
      return id;
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = async (details: { jobTitle: string; yearsExp: string; rawDetails: string }) => {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch (e) {
        return;
      }
    }
    setIsLoading(true);
    try {
      const resume = await generateResume(details.rawDetails, details.jobTitle, details.yearsExp);
      setCurrentResume(resume);
      await handleSaveResume(resume);
      setView('result');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white selection:bg-blue-50">
      <Header 
        user={user}
        onLogin={signInWithGoogle}
        onLogout={logOut}
        onDashboard={() => setView('dashboard')} 
        onHome={() => setView('landing')} 
      />
      
      <main>
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <LandingView key="landing" onStart={() => setView('input')} />
          )}
          {view === 'input' && (
            <InputView key="input" onGenerate={handleGenerate} isLoading={isLoading} />
          )}
          {view === 'result' && currentResume && (
            <ResultView 
              key="result" 
              resume={currentResume} 
              onDownload={() => {
                if (isPaid) {
                  window.print();
                } else {
                  setShowPaywall(true);
                }
              }}
              isPaid={isPaid}
              atsFeedback={atsFeedback}
              onTailor={async (jd) => {
                setIsLoading(true);
                try {
                  const tailored = await tailorResume(currentResume, jd);
                  const withTailoring = { 
                    ...tailored, 
                    isTailored: true, 
                    targetJobDescription: jd 
                  };
                  setCurrentResume(withTailoring);
                  await handleSaveResume(withTailoring);
                  
                  // Generate Match Score
                  const feedback = await checkATSScore(withTailoring, jd);
                  setAtsFeedback({ score: feedback.score, missingKeywords: feedback.missingKeywords });
                } catch (e) {
                  console.error(e);
                } finally {
                  setIsLoading(false);
                }
              }}
              isLoading={isLoading}
            />
          )}
          {view === 'dashboard' && (
            <DashboardView 
              key="dashboard" 
              resumes={savedResumes} 
              onSelect={(r: ResumeData) => { setCurrentResume(r); setView('result'); }}
              onDelete={async (id: string) => {
                await deleteResumeFromFirestore(id);
                setSavedResumes(prev => prev.filter(r => r.id !== id));
              }}
              onNew={() => setView('input')}
            />
          )}
        </AnimatePresence>
      </main>

      {showPaywall && (
        <PaywallModal 
          onClose={() => setShowPaywall(false)} 
          onSuccess={() => {
            setIsPaid(true);
            setShowPaywall(false);
          }} 
        />
      )}
    </div>
  );
}

function Header({ user, onLogin, onLogout, onDashboard, onHome }: any) {
  return (
    <nav className="border-b border-border-standard py-4 px-6 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onHome}>
          <div className="w-8 h-8 bg-primary-blue rounded-[6px] flex items-center justify-center">
            <Zap className="text-white w-5 h-5" />
          </div>
          <span className="font-medium text-xl tracking-tight text-dark-gray">GulfCV AI</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onDashboard} className="text-sm font-semibold text-[#4B5563] hover:text-primary-blue transition-colors flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" /> My Dashboard
          </button>
          {user ? (
            <div className="flex items-center gap-4">
              <img src={user.photoURL} alt="user" className="w-8 h-8 rounded-full border border-border-standard" referrerPolicy="no-referrer" />
              <button onClick={onLogout} className="text-sm font-semibold text-[#4B5563] hover:text-red-500 transition-colors">Sign Out</button>
            </div>
          ) : (
            <button onClick={onLogin} className="btn-primary text-sm py-2 px-6">Sign In</button>
          )}
        </div>
      </div>
    </nav>
  );
}

// --------------------------------------------------------------------------------
// LANDING VIEW
// --------------------------------------------------------------------------------

function LandingView({ onStart }: { onStart: () => void }) {
  return (
    <div className="pb-32">
      {/* Hero */}
      <section className="section-spacing px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="inline-flex items-center gap-2 py-1.5 px-3 bg-blue-50 text-primary-blue text-xs font-bold rounded-full uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> #1 AI Resume Tool for the GCC
            </div>
            <h1 className="leading-[1.1]">
              Get Hired Faster in the Gulf with AI-Optimized CVs
            </h1>
            <p className="text-lg text-[#4B5563] max-w-xl">
              Tailored specifically for recruiters in Dubai, Riyadh, and Doha. ATS-proof, professional, and ready in 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={onStart} className="btn-primary text-lg px-10 py-4 shadow-md transition-all flex items-center gap-3">
                Create My CV Free <ArrowRight className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                      <img src={`https://picsum.photos/seed/${i+40}/32/32`} alt="user" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
                <span>Trusted by 2,000+ job seekers</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="hidden lg:block relative"
          >
            <div className="bg-slate-50 rounded-[12px] p-8 border border-border-standard">
              <div className="bg-white rounded-[8px] border border-border-standard shadow-xl p-8 space-y-4">
                <div className="w-24 h-4 bg-slate-100 rounded" />
                <div className="w-full h-2 bg-slate-50 rounded" />
                <div className="w-full h-2 bg-slate-50 rounded" />
                <div className="w-3/4 h-2 bg-slate-50 rounded" />
                <div className="pt-8 space-y-4">
                   <div className="w-32 h-3 bg-slate-100 rounded" />
                   <div className="space-y-2">
                     <div className="w-full h-2 bg-emerald-50 rounded" />
                     <div className="w-full h-2 bg-emerald-50 rounded" />
                   </div>
                </div>
              </div>
            </div>
            {/* Trust badge mockup */}
            <div className="absolute -bottom-6 -left-6 bg-white standard-card shadow-lg flex items-center gap-3 p-4">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ATS Result</div>
                <div className="text-sm font-bold">98% Optimization</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-light-gray section-spacing px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-center mb-16">How it Works (In 3 Simple Steps)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard number="1" title="Enter Your Details" description="Paste your existing experience or enter your details from scratch." />
            <StepCard number="2" title="AI Generates Your CV" description="Our AI builds a localized, ATS-optimized CV for the Gulf market." />
            <StepCard number="3" title="Tailor It to Any Job" description="Paste a job description to synchronize keywords instantly." />
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="section-spacing px-6 max-w-7xl mx-auto">
        <h2 className="text-center mb-16">See the Transformation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch bg-dark-gray rounded-[16px] overflow-hidden p-8 md:p-20 relative">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                 <X className="w-5 h-5" />
               </div>
               <span className="text-red-400 font-bold uppercase tracking-widest text-[11px]">The Generic CV (90% Rejection)</span>
            </div>
            <div className="bg-white/5 rounded-[12px] p-8 border border-white/5 blur-[2px] opacity-30 grayscale h-full min-h-[300px]">
              <div className="h-4 w-1/2 bg-white/20 mb-6 rounded" />
              <div className="space-y-3">
                <div className="h-2 w-full bg-white/10 rounded" />
                <div className="h-2 w-full bg-white/10 rounded" />
                <div className="h-2 w-3/4 bg-white/10 rounded" />
              </div>
              <div className="mt-12 space-y-3">
                <div className="h-4 w-1/3 bg-white/20 mb-4 rounded" />
                <div className="h-2 w-full bg-white/10 rounded" />
                <div className="h-2 w-full bg-white/10 rounded" />
              </div>
            </div>
          </div>

          <div className="space-y-6 relative z-10 mt-12 md:mt-0">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center text-accent-green">
                 <Check className="w-5 h-5" />
               </div>
               <span className="text-accent-green font-bold uppercase tracking-widest text-[11px]">The Optimized AI CV (Interview Ready)</span>
            </div>
            <div className="bg-white rounded-[12px] shadow-2xl p-8 border-t-4 border-primary-blue h-full min-h-[300px]">
              <div className="flex justify-between items-start mb-10">
                <div className="h-6 w-1/2 bg-slate-900 mb-2 rounded" />
                <div className="px-3 py-1 bg-blue-50 text-primary-blue text-[9px] font-black uppercase tracking-widest rounded border border-blue-100">Gulf Optimized</div>
              </div>
              <div className="space-y-4">
                <div className="h-2 w-full bg-slate-100 rounded" />
                <div className="h-2 w-full bg-slate-100 rounded" />
                <div className="h-2 w-2/3 bg-slate-100 rounded" />
              </div>
              <div className="mt-12 space-y-4">
                <div className="h-3 w-1/4 bg-blue-50 rounded" />
                <div className="space-y-2">
                  <div className="h-2 w-full bg-emerald-50 rounded-full" />
                  <div className="h-2 w-[85%] bg-emerald-50 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center px-6 section-spacing">
        <h2 className="mb-8 max-w-2xl mx-auto">Ready to land your dream job in Dubai, Doha or Riyadh?</h2>
        <button onClick={onStart} className="btn-primary text-xl px-12 py-5 shadow-lg">
          Create Your CV Free
        </button>
        <div className="mt-8 flex justify-center gap-8 text-sm text-[#9CA3AF] font-medium uppercase tracking-widest">
           <div className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-green" /> Free to Try</div>
           <div className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-green" /> ATS Proof</div>
           <div className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-green" /> Gulf Specific</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-standard py-16 px-6 bg-light-gray">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-sm text-[#6B7280]">
          <div className="flex items-center gap-2 text-dark-gray">
            <Zap className="text-primary-blue w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">GulfCV AI</span>
          </div>
          <div className="flex gap-8">
            <span>Dubai Office</span>
            <span>Riyadh Office</span>
            <span>Support</span>
          </div>
          <p className="italic">© 2026 GulfCV AI. Designed for trust.</p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, description }: any) {
  return (
    <div className="standard-card space-y-4">
      <div className="w-10 h-10 bg-primary-blue text-white rounded-full flex items-center justify-center font-bold">
        {number}
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-[#4B5563] leading-relaxed">{description}</p>
    </div>
  );
}

// --------------------------------------------------------------------------------
// INPUT VIEW
// --------------------------------------------------------------------------------

function InputView({ onGenerate, isLoading }: any) {
  const [formData, setFormData] = useState({
    name: '',
    jobTitle: '',
    yearsExp: '',
    rawDetails: '',
    skills: '',
    education: ''
  });

  return (
    <div className="bg-light-gray min-h-[calc(100vh-72px)] py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="standard-card shadow-xl p-10 space-y-8"
        >
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold">Build Your Profile</h2>
            <p className="text-[#6B7280]">Make it feel easy—paste what you have and let our AI do the heavy lifting.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup label="Full Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} placeholder="Ahmed Al-Said" />
            <InputGroup label="Target Job" value={formData.jobTitle} onChange={(v: string) => setFormData({...formData, jobTitle: v})} placeholder="Project Manager" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup label="Years of Exp" value={formData.yearsExp} onChange={(v: string) => setFormData({...formData, yearsExp: v})} placeholder="5" />
            <InputGroup label="Location" value={formData.education} onChange={(v: string) => setFormData({...formData, education: v})} placeholder="Dubai, UAE" />
          </div>
          
          <div className="space-y-2">
            <label className="label-standard">Experience Details</label>
            <textarea 
              className="input-field h-48 resize-none" 
              placeholder="Paste your rough work history, bullets, or professional summary..."
              value={formData.rawDetails}
              onChange={(e) => setFormData({...formData, rawDetails: e.target.value})}
            />
            <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1 mt-1 uppercase font-bold tracking-widest">
              <ShieldCheck className="w-3 h-3 text-accent-green" /> Data handled securely
            </p>
          </div>

          <button 
            disabled={!formData.rawDetails || !formData.jobTitle || isLoading}
            onClick={() => onGenerate(formData)}
            className="w-full btn-primary text-lg py-4 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Generate CV"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder }: any) {
  return (
    <div className="space-y-1">
      <label className="label-standard">{label}</label>
      <input 
        className="input-field" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------
// RESULT VIEW (SPLIT SCREEN)
// --------------------------------------------------------------------------------

function ResultView({ resume, onDownload, onTailor, isLoading, atsFeedback, isPaid }: any) {
  const [jd, setJd] = useState('');

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-72px)] overflow-hidden">
      {/* Left: Generated CV Preview */}
      <div className="flex-1 bg-light-gray p-8 md:p-12 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.99 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-[800px] mx-auto cv-preview-container"
        >
          <div className="mb-10 text-center pb-8 border-b-2 border-dark-gray">
            <h1 className="text-3xl mb-2">{resume.fullName}</h1>
            <div className="text-[#6B7280] text-sm font-medium space-x-2">
              <span>{resume.email}</span>
              <span>•</span>
              <span>{resume.phone}</span>
              <span>•</span>
              <span>{resume.location}</span>
            </div>
          </div>

          <div className="space-y-10 text-[14px]">
            <section>
              <h2 className="text-[12px] font-bold uppercase tracking-[3px] text-primary-blue mb-4">Professional Overview</h2>
              <p className="text-[#374151] leading-relaxed text-justify">{resume.summary}</p>
            </section>

            <section>
              <h2 className="text-[12px] font-bold uppercase tracking-[3px] text-primary-blue mb-6 border-b border-border-standard pb-2">Work Experience</h2>
              <div className="space-y-8">
                {resume.experience.map((exp: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline mb-2">
                      <h3 className="font-bold text-[16px]">{exp.position} — {exp.company}</h3>
                      <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">{exp.startDate} – {exp.endDate}</span>
                    </div>
                    <ul className="list-disc list-outside ml-4 space-y-1.5 text-[#374151]">
                      {exp.description.map((point: string, j: number) => (
                        <li key={j}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-border-standard">
              <section>
                <h2 className="text-[12px] font-bold uppercase tracking-[3px] text-primary-blue mb-4">Core Skills</h2>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[#4B5563]">
                  {resume.skills.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-slate-50 border border-border-standard rounded uppercase">{s}</span>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-[12px] font-bold uppercase tracking-[3px] text-primary-blue mb-4">Academic Background</h2>
                <div className="space-y-4">
                  {resume.education.map((edu: any, i: number) => (
                    <div key={i}>
                      <div className="font-bold text-dark-gray">{edu.school}</div>
                      <div className="text-[#6B7280] text-[11px] font-bold uppercase tracking-widest">{edu.degree} — {edu.graduationDate}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right: Actions sidebar */}
      <div className="w-full lg:w-[420px] border-l border-border-standard p-10 flex flex-col justify-between bg-white z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="space-y-10">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="text-primary-blue w-6 h-6" /> Tailor Your CV
            </h2>
            <p className="text-sm text-[#6B7280]">The Gulf market is competitive. Tailoring your CV to a Job Description makes you 3x more likely to be seen.</p>
            <div className="space-y-2">
              <label className="label-standard uppercase tracking-widest text-[10px]">Job Description</label>
              <textarea 
                className="input-field h-56 resize-none" 
                placeholder="Paste the Job Description you're applying for..."
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
            </div>
            <button 
              disabled={!jd || isLoading}
              onClick={() => onTailor(jd)}
              className="w-full btn-secondary flex items-center gap-2 hover:border-primary-blue hover:text-primary-blue transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : "Tailor My CV"}
            </button>
          </div>

          {atsFeedback && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 bg-slate-50 rounded-[12px] border border-border-standard space-y-4"
            >
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">ATS Match Score</div>
                  <div className={cn(
                    "text-4xl font-bold",
                    atsFeedback.score > 80 ? "text-accent-green" : "text-amber-500"
                  )}>
                    {atsFeedback.score}%
                  </div>
                </div>
                <div className="text-[11px] font-bold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded">
                  {atsFeedback.score > 80 ? 'Excellent' : 'Improving'}
                </div>
              </div>

              {atsFeedback.missingKeywords.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Missing Keywords</div>
                  <div className="flex flex-wrap gap-1.5">
                    {atsFeedback.missingKeywords.slice(0, 5).map((kw: string, i: number) => (
                      <span key={i} className="text-[11px] font-medium bg-white border border-border-standard px-2 py-0.5 rounded text-slate-600">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        <div className="pt-10 space-y-4 border-t border-border-standard">
          {isPaid ? (
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-[8px] border border-emerald-100 flex items-center gap-3">
              <Check className="w-5 h-5" />
              <div className="text-[11px] font-bold uppercase tracking-wide">Pro Access Unlocked</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-primary-blue bg-blue-50/50 p-4 rounded-[8px] border border-blue-100/50">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-wide">Secure Checkout via Stripe</p>
            </div>
          )}
          <button 
            onClick={onDownload}
            className="w-full btn-primary py-5 shadow-lg flex items-center gap-3"
          >
            {isPaid ? <Download className="w-5 h-5" /> : null}
            {isPaid ? "Download PDF Now" : "Download Job-Optimized CV ($5)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// DASHBOARD VIEW
// --------------------------------------------------------------------------------

function DashboardView({ resumes, onSelect, onDelete, onNew }: any) {
  return (
    <div className="max-w-7xl mx-auto section-spacing px-6">
      <div className="mb-12 flex justify-between items-center">
        <h2 className="text-4xl font-bold">My Career Dashboard</h2>
        <button onClick={onNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> New AI CV
        </button>
      </div>

      {resumes.length === 0 ? (
        <div className="standard-card py-24 text-center space-y-6">
          <FileText className="w-16 h-16 mx-auto text-[#D1D5DB]" />
          <p className="text-[#6B7280] text-xl">You haven't generated any optimized CVs yet.</p>
          <button onClick={onNew} className="btn-secondary">Start Your First Profile</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {resumes.map((r: any, i: number) => (
            <div key={i} className="standard-card standard-card-hover group cursor-pointer relative" onClick={() => onSelect(r)}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r.id);
                }}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors z-10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex justify-between items-start mb-6">
                 <div className="w-10 h-10 bg-blue-50 text-primary-blue rounded-[8px] flex items-center justify-center">
                   <FileText className="w-6 h-6" />
                 </div>
                 <div className="bg-accent-green/10 text-accent-green px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Optimized</div>
              </div>
              <h3 className="text-xl mb-2 group-hover:text-primary-blue transition-colors font-bold uppercase tracking-tight">{r.fullName}</h3>
              <p className="text-sm text-[#6B7280] line-clamp-2 italic mb-6 leading-relaxed">{r.summary}</p>
              <div className="flex justify-between items-center pt-6 border-t border-border-standard">
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Saved to cloud</span>
                <ArrowRight className="w-5 h-5 text-[#D1D5DB] group-hover:text-primary-blue group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------
// PAYWALL MODAL
// --------------------------------------------------------------------------------

function PaywallModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onSuccess();
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-dark-gray/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[12px] w-full max-w-xl overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-[#9CA3AF] hover:text-dark-gray p-2 transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="p-12 text-center">
          <div className="w-20 h-20 bg-blue-50 text-primary-blue rounded-[12px] flex items-center justify-center mx-auto mb-8">
             {isProcessing ? <Loader2 className="w-10 h-10 animate-spin" /> : <CreditCard className="w-10 h-10" />}
          </div>
          <h2 className="text-3xl font-bold mb-4">Export Your Optimized CV</h2>
          <p className="text-[#6B7280] mb-12 text-lg">Your CV is ready and tailored for the Gulf market. Unlock download access and full dashboard history.</p>

          <div className="space-y-4">
            <button 
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full btn-primary text-lg py-5 rounded-[8px] flex items-center justify-between px-8 shadow-md disabled:opacity-50"
            >
               <span>{isProcessing ? "Connecting to Stripe..." : "Download Once"}</span>
               <span className="font-bold flex items-center gap-1">$5 <Check className="w-5 h-5 text-white/50" /></span>
            </button>
            <button 
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full bg-dark-gray text-white font-semibold py-5 rounded-[8px] flex items-center justify-between px-8 hover:bg-black transition-all disabled:opacity-50"
            >
               <span>{isProcessing ? "Processing..." : "Weekly Pass (Unlimited)"}</span>
               <span className="font-bold">$9 <span className="text-xs font-normal text-white/40">/wk</span></span>
            </button>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-border-standard pt-8 italic text-[#9CA3AF] text-[10px] uppercase font-bold tracking-widest">
            <div className="flex flex-col items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#E5E7EB]" /> AES-256
            </div>
            <div className="flex flex-col items-center gap-2">
              <Building2 className="w-5 h-5 text-[#E5E7EB]" /> Stripe Verified
            </div>
            <div className="flex flex-col items-center gap-2">
              <Users className="w-5 h-5 text-[#E5E7EB]" /> Job Secured
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
