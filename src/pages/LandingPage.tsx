import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Shield, Heart, ArrowRight, Sparkles, BookOpen, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <nav className="fixed top-0 w-full z-50 h-[72px] flex items-center justify-between px-6 md:px-20 bg-surface/80 backdrop-blur-[20px]">
      <div className="font-serif text-2xl tracking-tight text-on-surface">
        <span className="italic text-primary">NEEV</span>
      </div>
      <div className="hidden md:flex gap-12 text-sm font-light tracking-wide text-on-surface-variant">
        <a href="#philosophy" className="hover:text-on-surface transition-colors relative after:absolute after:bottom-[-4px] after:left-1/2 after:h-[1px] after:w-0 after:bg-primary after:transition-all hover:after:left-0 hover:after:w-full">Sanctuary</a>
        <a href="#lineage" className="text-on-surface relative after:absolute after:bottom-[-4px] after:left-0 after:h-[1px] after:w-full after:bg-primary">Life Cycles</a>
        <a href="#vault" className="hover:text-on-surface transition-colors relative after:absolute after:bottom-[-4px] after:left-1/2 after:h-[1px] after:w-0 after:bg-primary after:transition-all hover:after:left-0 hover:after:w-full">Legacy Vault</a>
        <a href="#guidance" className="hover:text-on-surface transition-colors relative after:absolute after:bottom-[-4px] after:left-1/2 after:h-[1px] after:w-0 after:bg-primary after:transition-all hover:after:left-0 hover:after:w-full">Guidance</a>
      </div>
      {user ? (
        <Button onClick={() => navigate('/dashboard')} variant="primary">
          Go to Dashboard
        </Button>
      ) : (
        <Button onClick={handleSignIn} variant="primary">
          Connect with Guardian
        </Button>
      )}
    </nav>
  );
};

const Hero = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(textRef.current?.children || [], {
        y: 40,
        opacity: 0,
        stagger: 0.15,
        duration: 1.2,
        ease: 'expo.out'
      })
      .from(imageRef.current, {
        scale: 1.1,
        opacity: 0,
        duration: 1.5,
        ease: 'power2.out'
      }, "-=1")
      .from(planeRef.current, {
        x: 40,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      }, "-=0.8");
    });

    return () => ctx.revert();
  }, []);

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <section ref={containerRef} className="pt-[140px] pb-32 px-6 md:px-20 max-w-[1240px] mx-auto overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-24 items-start relative">
        {/* Asymmetrical Text Column */}
        <div ref={textRef} className="lg:w-[55%] z-10">
          <span className="label-md text-primary mb-6 block tracking-[0.2em]">
            THE MODERN HEIRLOOM
          </span>
          <h1 className="font-serif text-[clamp(3.5rem,8vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-on-surface mb-12">
            Build your family's<br/>
            <span className="italic text-primary/80">Foundation</span><br/>
            with wisdom.
          </h1>
          <p className="text-[1.25rem] font-light leading-relaxed text-on-surface-variant max-w-lg mb-16">
            NEEV is a digital sanctuary for modern Indian families. Automate your daily rhythm, secure your legacy, and lead your children with AI-guided wisdom.
          </p>
          <div className="flex flex-wrap gap-8 items-center">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} variant="primary" className="px-10 py-8 text-sm uppercase tracking-[0.25em] rounded-md shadow-xl shadow-primary/10">Go to Dashboard</Button>
            ) : (
              <Button onClick={() => navigate('/signup')} variant="primary" className="px-10 py-8 text-sm uppercase tracking-[0.25em] rounded-md shadow-xl shadow-primary/10">Begin the Cycle</Button>
            )}
            <div className="flex flex-col">
              <span className="label-md text-[0.65rem] text-on-surface-variant/40">ESTABLISHED</span>
              <span className="font-serif italic text-on-surface-variant">MMXXIV</span>
            </div>
          </div>
        </div>

        {/* Overlapping Image Column */}
        <div className="lg:w-[45%] relative mt-12 lg:mt-0">
          <div 
            ref={imageRef}
            className="rounded-2xl overflow-hidden bg-surface-container-low aspect-[4/5] w-full transform rotate-[-3deg] hover:rotate-0 hover:scale-[1.01] transition-all duration-700 shadow-2xl"
          >
            <img 
              src="https://images.unsplash.com/photo-1617633265040-17940a702e06?q=80&w=2070&auto=format&fit=crop" 
              alt="Indian family sharing a quiet moment" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          
          {/* Overlapping Plane Element */}
          <div 
            ref={planeRef}
            className="absolute -bottom-10 -left-12 bg-surface/90 backdrop-blur-xl p-10 rounded-xl shadow-2xl overlap-plane max-w-[240px] hidden md:block"
          >
             <div className="flex items-center gap-3 mb-4">
               <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
               <span className="label-md text-[0.65rem] text-primary tracking-[0.2em]">GUARDIAN VOICE</span>
             </div>
             <h3 className="font-serif italic text-2xl text-on-surface leading-tight mb-4">"We curate the story of your family's growth."</h3>
             <div className="w-10 h-[2px] bg-primary/30 mt-6"></div>
          </div>

          {/* Floating Silk Element (Decorative) */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-container/20 rounded-full blur-[100px] -z-10"></div>
        </div>
      </div>
    </section>
  );
};

const Philosophy = () => {
  return (
    <section id="philosophy" className="py-32 bg-surface-container-low px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <span className="label-md text-primary mb-6 block">OUR ETHOS</span>
        <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-[-0.02em] mb-12">
          <span className="block text-on-surface">Built by sincere people,</span>
          <span className="block italic text-primary/70">for sincere families</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <p className="body-lg text-on-surface-variant leading-relaxed">
              Parenting is not a productivity problem. It is a presence problem. NEEV does not try to make you faster — it tries to make you more present.
            </p>
            <p className="text-[1rem] text-on-surface-variant/70 leading-relaxed font-light">
              We believe in the modern heirloom. Every screen should feel like a well-loved family archive. Tactile. Precious. Wise. Not a SaaS product. Not a dashboard. A sanctuary.
            </p>
          </div>
          
          <div className="relative">
            {/* Tonal Layering: Card on surface-lo */}
            <Card className="p-12 rounded-lg border-none bg-surface-container-lowest shadow-none overlap-plane">
              <div className="w-1 h-12 bg-primary/20 absolute left-0 top-12"></div>
              <p className="font-serif italic text-[1.5rem] text-on-surface leading-[1.6] mb-8">
                "A family is not a static portrait, but a living breathing story. The Guardian is here to help you write it."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-8 h-[1px] bg-primary/30"></div>
                <p className="label-md text-[0.65rem] text-primary tracking-[0.2em]">
                  THE GUARDIAN AI
                </p>
              </div>
            </Card>
            {/* Decorative Overlap Element */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-tertiary-container/30 rounded-full blur-2xl -z-10"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  return (
    <section id="features" className="py-40 px-6 md:px-20 relative overflow-hidden bg-surface">
      <div className="max-w-[1240px] mx-auto flex flex-col lg:flex-row items-center gap-32">
        <div className="w-full lg:w-1/2 relative">
          <div className="relative w-full aspect-square max-w-[540px]">
            {/* Overlapping Planes for Images */}
            <div className="absolute top-0 right-0 w-4/5 h-4/5 bg-primary-container/40 transform rotate-[2deg] rounded-lg overflow-hidden z-0">
              <img 
                className="w-full h-full object-cover grayscale-[20%] mix-blend-multiply opacity-80" 
                src="https://images.unsplash.com/photo-1524492459413-0296b71d4744?q=80&w=2070&auto=format&fit=crop" 
                alt="Indian ancestral wisdom" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div className="absolute bottom-10 left-0 w-3/5 h-3/5 bg-tertiary-container transform rotate-[-2deg] p-3 rounded-lg z-10 shadow-none">
              <img 
                className="w-full h-full object-cover rounded-md" 
                src="https://images.unsplash.com/photo-1532375811400-24b26938c975?q=80&w=2069&auto=format&fit=crop" 
                alt="Indian family gathering" 
                referrerPolicy="no-referrer" 
              />
            </div>
            {/* Silk Texture Overlay */}
            <div className="absolute inset-0 silk-texture pointer-events-none"></div>
          </div>
        </div>
        
        <div className="w-full lg:w-1/2">
          <span className="label-md text-primary mb-8 block">THE VIRASAT LEDGER</span>
          <h2 className="font-serif text-[clamp(2.5rem,5vw,4rem)] mb-12 leading-[1.1] text-on-surface tracking-tight">
            Preserve <span className="text-primary/70 italic">every</span> breath, every <span className="text-primary/70 italic">lesson</span>.
          </h2>
          <div className="space-y-16">
            <div className="flex gap-10 group">
              <span className="font-serif text-3xl italic text-primary/30">01</span>
              <div className="space-y-3">
                <h4 className="font-serif text-2xl text-on-surface">Automated Lineage Mapping</h4>
                <p className="text-on-surface-variant font-light leading-relaxed">Visualise your family tree as a blooming garden, showing connections and inherited wisdom over 500 years.</p>
              </div>
            </div>
            <div className="flex gap-10 group">
              <span className="font-serif text-3xl italic text-primary/30">02</span>
              <div className="space-y-3">
                <h4 className="font-serif text-2xl text-on-surface">Ancestral Audio Preservation</h4>
                <p className="text-on-surface-variant font-light leading-relaxed">High-fidelity voice synthesis that keeps the tone and warmth of your family's storytellers alive.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Personas = () => {
  const [activeTab, setActiveTab] = React.useState('mother');

  const tabs = [
    { id: 'mother', label: 'FOR MOTHERS' },
    { id: 'father', label: 'FOR FATHERS' },
    { id: 'grandparent', label: 'FOR ELDERS' },
  ];

  const content = {
    mother: {
      quote: "The mental load is finally visible, and shared.",
      text: "NEEV organizes the invisible labor of parenting. School notices are automatically parsed, vaccinations are tracked, and the Guardian ensures nothing falls through the cracks without adding to your notification fatigue."
    },
    father: {
      quote: "I can finally be present without asking what needs to be done.",
      text: "Gain immediate visibility into the family's rhythm. The Guardian briefs you on what matters today, so you can step in proactively rather than waiting for instructions."
    },
    grandparent: {
      quote: "Connected to their growth, without the noise.",
      text: "A quiet, curated view of your grandchildren's milestones and important family events. No chaotic group chats, just the moments that matter, securely shared."
    }
  };

  return (
    <section className="py-32 bg-surface-container-low px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-24 items-center">
          <div className="w-full lg:w-1/2">
            <span className="label-md text-primary mb-6 block">EVERY ROLE</span>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-[-0.02em] mb-12">
              <span className="block text-on-surface">A sanctuary for</span>
              <span className="block italic text-primary/70">every generation</span>
            </h2>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-12">
              <TabsList className="flex-wrap h-auto gap-4 bg-transparent p-0">
                {tabs.map(tab => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="data-[state=active]:bg-primary data-[state=active]:text-on-primary data-[state=active]:shadow-none bg-surface-container-lowest text-on-surface-variant/60 hover:text-on-surface px-8 py-4 rounded-full transition-all label-md text-[0.7rem] tracking-[0.2em]"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map(tab => (
                <TabsContent key={tab.id} value={tab.id} className="min-h-[200px] mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <p className="font-serif italic text-3xl text-on-surface leading-tight mb-8">
                    "{content[tab.id as keyof typeof content].quote}"
                  </p>
                  <p className="body-lg text-on-surface-variant leading-relaxed max-w-lg">
                    {content[tab.id as keyof typeof content].text}
                  </p>
                </TabsContent>
              ))}
            </Tabs>
          </div>
          
          <div className="w-full lg:w-1/2">
            <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container-lowest p-12 flex items-center justify-center overlap-plane shadow-none">
               <Card className="w-full max-w-sm bg-surface-container-low p-10 border-none shadow-none rounded-xl">
                 <div className="flex items-center gap-6 mb-10">
                   <div className="w-16 h-16 rounded-full bg-primary-container/50 flex items-center justify-center text-primary font-serif text-2xl">
                     {activeTab === 'mother' ? 'M' : activeTab === 'father' ? 'F' : 'E'}
                   </div>
                   <div>
                     <p className="font-serif text-xl text-on-surface">
                       {activeTab === 'mother' ? 'Mother Mode' : activeTab === 'father' ? 'Father Mode' : 'Elder Mode'}
                     </p>
                     <p className="label-md text-[0.6rem] text-primary tracking-[0.15em] mt-1">ACTIVE ARCHETYPE</p>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <div className="h-2 bg-surface-container-highest/30 rounded-full w-full"></div>
                   <div className="h-2 bg-surface-container-highest/30 rounded-full w-5/6"></div>
                   <div className="h-2 bg-surface-container-highest/30 rounded-full w-4/6"></div>
                 </div>
               </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const GuardianQuote = () => {
  return (
    <section className="py-32 bg-surface px-6 md:px-20 overflow-hidden">
      <div className="max-w-[900px] mx-auto">
        <Card className="p-12 md:p-20 rounded-lg border-none shadow-none bg-surface-container-lowest relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/40 group-hover:bg-primary transition-colors duration-700"></div>
          <p className="font-serif italic text-[1.5rem] md:text-[2rem] text-on-surface leading-[1.6] mb-10">
            "You have 3 hours of unstructured time this Sunday. I have declined the non-essential birthday party invitation. Protect this time. Your family needs rest more than they need to be seen."
          </p>
          <div className="flex items-center gap-6">
            <div className="w-12 h-[1px] bg-primary/20"></div>
            <p className="label-md text-[0.7rem] text-primary tracking-[0.25em]">
              THE GUARDIAN · SUNDAY BRIEFING
            </p>
          </div>
          {/* Subtle silk texture */}
          <div className="absolute inset-0 silk-texture opacity-5 pointer-events-none"></div>
        </Card>
      </div>
    </section>
  );
};

const AIGuardian = () => {
  return (
    <section className="py-32 bg-surface-container-low px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-24 items-center">
          <div className="w-full lg:w-1/2 order-2 lg:order-1 relative">
             <div className="aspect-[4/5] rounded-[28px] overflow-hidden bg-surface-container-lowest p-12 flex flex-col justify-end relative shadow-none">
                <div className="absolute inset-0 bg-primary-container/20"></div>
                <div className="relative z-10 space-y-6">
                  <div className="bg-surface-container-lowest p-6 rounded-xl shadow-none transform -translate-x-6 opacity-0 animate-[slideIn_0.8s_ease-out_forwards]">
                    <p className="text-sm text-on-surface-variant font-light">Did we pay the school fees for this term?</p>
                  </div>
                  <div className="bg-primary p-6 rounded-xl shadow-none self-end ml-auto transform translate-x-6 opacity-0 animate-[slideIn_0.8s_ease-out_0.3s_forwards] max-w-[80%]">
                    <p className="text-sm text-on-primary font-serif italic leading-relaxed">"Yes, it was paid on the 12th. The receipt is saved in the Vault under 'Education 2026'."</p>
                  </div>
                </div>
                {/* Silk Texture */}
                <div className="absolute inset-0 silk-texture opacity-10 pointer-events-none"></div>
             </div>
             {/* Decorative element */}
             <div className="absolute -top-10 -left-10 w-40 h-40 bg-tertiary-container/40 rounded-full blur-3xl -z-10"></div>
          </div>
          <div className="w-full lg:w-1/2 order-1 lg:order-2">
            <span className="label-md text-primary mb-6 block">GUARDIAN INSIGHT</span>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-[-0.02em] mb-10">
              <span className="block text-on-surface">Not a chatbot,</span>
              <span className="block italic text-primary/70">a family elder</span>
            </h2>
            <p className="body-lg text-on-surface-variant leading-relaxed mb-12">
              The Guardian doesn't just answer questions; it anticipates needs. It knows your family's rhythms, remembers the small details, and gently guides you toward better balance.
            </p>
            <ul className="space-y-8">
              <li className="flex items-start gap-6">
                <div className="w-2 h-2 rounded-full bg-primary mt-2.5"></div>
                <div className="space-y-1">
                  <p className="font-serif text-xl text-on-surface">Contextual Memory</p>
                  <p className="text-sm text-on-surface-variant font-light">Remembers allergies, preferences, and past decisions.</p>
                </div>
              </li>
              <li className="flex items-start gap-6">
                <div className="w-2 h-2 rounded-full bg-primary mt-2.5"></div>
                <div className="space-y-1">
                  <p className="font-serif text-xl text-on-surface">Proactive Briefings</p>
                  <p className="text-sm text-on-surface-variant font-light">Morning summaries of what truly matters today.</p>
                </div>
              </li>
              <li className="flex items-start gap-6">
                <div className="w-2 h-2 rounded-full bg-primary mt-2.5"></div>
                <div className="space-y-1">
                  <p className="font-serif text-xl text-on-surface">Conflict Resolution</p>
                  <p className="text-sm text-on-surface-variant font-light">Gently points out scheduling clashes before they happen.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

const Integrations = () => {
  return (
    <section className="py-32 bg-surface px-6 md:px-20 text-center overflow-hidden">
      <div className="max-w-[800px] mx-auto">
        <span className="label-md text-primary mb-6 block">SEAMLESS HARMONY</span>
        <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-[-0.02em] mb-10">
          <span className="block text-on-surface">Integrated with your</span>
          <span className="block italic text-primary/70">Google Ecosystem</span>
        </h2>
        <p className="body-lg text-on-surface-variant leading-relaxed mb-16">
          NEEV breathes within the tools you already use. We synchronize with Google Calendar, Gmail, and Drive to automate your family's logistics without you lifting a finger.
        </p>
        
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {[
            { name: 'Calendar', icon: 'https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png' },
            { name: 'Gmail', icon: 'https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png' },
            { name: 'Drive', icon: 'https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png' },
            { name: 'Photos', icon: 'https://www.gstatic.com/images/branding/product/2x/photos_2020q4_48dp.png' }
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-4 group">
              <div className="w-20 h-20 rounded-2xl bg-surface-container-low flex items-center justify-center transition-all duration-500 group-hover:bg-surface-container-highest group-hover:scale-105">
                <img src={item.icon} alt={item.name} className="w-10 h-10" />
              </div>
              <span className="label-md text-[0.65rem] text-on-surface-variant tracking-[0.2em]">{item.name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-32 bg-surface-container-low px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <span className="label-md text-primary mb-6 block text-center">THE PROCESS</span>
        <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-[-0.02em] mb-20 text-center">
          <span className="block text-on-surface">Simplicity by</span>
          <span className="block italic text-primary/70">design</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-[1px] bg-primary/10"></div>
          
          {[
            { num: '1', title: 'Connect', text: "Link your family's Google accounts. We securely sync calendars, emails, and drive folders." },
            { num: '2', title: 'Configure', text: "Set up profiles for each family member. Define roles, permissions, and notification preferences." },
            { num: '3', title: 'Breathe', text: "Let the Guardian take over the mental load. Receive curated morning briefs and proactive alerts." }
          ].map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-32 h-32 rounded-full bg-surface-container-lowest flex items-center justify-center mb-10 transition-all duration-700 group-hover:bg-primary group-hover:text-on-primary">
                <span className="font-serif text-4xl text-primary group-hover:text-on-primary transition-colors">{step.num}</span>
              </div>
              <h3 className="font-serif text-2xl text-on-surface mb-4">{step.title}</h3>
              <p className="body-md text-on-surface-variant leading-relaxed max-w-[280px]">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  return (
    <section className="py-32 bg-surface px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <span className="label-md text-primary mb-6 block text-center">THE COMMUNITY</span>
        <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-[-0.02em] mb-20 text-center">
          <span className="block text-on-surface">A quiet revolution in</span>
          <span className="block italic text-primary/70">modern parenting</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24">
          <div className="flex flex-col group">
            <span className="font-serif text-[5rem] text-primary/10 leading-none mb-4 transition-colors group-hover:text-primary/30">“</span>
            <p className="font-serif italic text-xl md:text-2xl text-on-surface leading-[1.72] mb-10">
              It feels like having a wise elder living with us. It doesn't nag or send push notifications for every little thing. It just quietly ensures we don't drop the ball on what matters.
            </p>
            <p className="label-md text-[0.7rem] text-on-surface-variant tracking-[0.2em]">
              PRIYA M. · MOTHER OF TWO
            </p>
          </div>
          
          <div className="flex flex-col md:mt-11 group">
            <span className="font-serif text-[5rem] text-primary/10 leading-none mb-4 transition-colors group-hover:text-primary/30">“</span>
            <p className="font-serif italic text-xl md:text-2xl text-on-surface leading-[1.72] mb-10">
              I used to feel guilty about missing school emails. Now, the Guardian parses them and just tells me what I need to know in my morning brief. The mental load is finally shared.
            </p>
            <p className="label-md text-[0.7rem] text-on-surface-variant tracking-[0.2em]">
              RAHUL S. · WORKING FATHER
            </p>
          </div>
          
          <div className="flex flex-col md:mt-5 group">
            <span className="font-serif text-[5rem] text-primary/10 leading-none mb-4 transition-colors group-hover:text-primary/30">“</span>
            <p className="font-jp font-serif font-light text-xl md:text-2xl text-on-surface leading-[1.72] mb-10">
              家族のスケジュールが一つにまとまり、本当に助かっています。静かで、必要な時だけ教えてくれる。
            </p>
            <p className="label-md text-[0.7rem] text-on-surface-variant tracking-[0.2em]">
              YUKI T. · TOKYO
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <section id="pricing" className="py-32 bg-surface-container-low px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-24 items-start">
          <div className="w-full lg:w-[30%]">
            <span className="label-md text-primary mb-6 block">MEMBERSHIP</span>
            <h2 className="font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.1] tracking-[-0.02em] mb-10">
              <span className="block text-on-surface">Invest in your</span>
              <span className="block italic text-primary/70">family's peace</span>
            </h2>
            <p className="body-md text-on-surface-variant mb-12 leading-relaxed">
              Choose the tier that fits your household. Early access families lock in their rate forever.
            </p>
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-3 label-md text-[0.65rem] text-on-surface-variant tracking-[0.1em]">
                 <div className="w-1 h-1 rounded-full bg-primary"></div>
                 ANNUAL SAVINGS 40%
               </div>
               <div className="flex items-center gap-3 label-md text-[0.65rem] text-on-surface-variant tracking-[0.1em]">
                 <div className="w-1 h-1 rounded-full bg-primary"></div>
                 CANCEL ANYTIME
               </div>
            </div>
          </div>
          
          <div className="w-full lg:w-[70%] grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* Seed Plan */}
            <Card className="p-10 bg-surface-container-lowest border-none shadow-none rounded-2xl flex flex-col h-full transition-all duration-700 hover:bg-surface-container-mid">
              <h3 className="label-md tracking-[0.25em] mb-6 opacity-60">SEED</h3>
              <p className="font-serif text-4xl text-on-surface mb-10">Free</p>
              <ul className="space-y-6 mb-12 flex-grow">
                <li className="text-sm font-light text-on-surface-variant flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div> Calendar sync
                </li>
                <li className="text-sm font-light text-on-surface-variant flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div> 2 children
                </li>
                <li className="text-sm font-light text-on-surface-variant flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div> Basic tasks
                </li>
              </ul>
              {user ? (
                <Button onClick={() => navigate('/dashboard')} className="w-full bg-transparent text-primary hover:bg-primary/10 rounded-none border-b border-primary/20 h-14 label-md tracking-[0.2em]">GO TO DASHBOARD</Button>
              ) : (
                <Button onClick={handleSignIn} className="w-full bg-transparent text-primary hover:bg-primary/10 rounded-none border-b border-primary/20 h-14 label-md tracking-[0.2em]">BEGIN FREE</Button>
              )}
            </Card>

            {/* Family Plan (Featured) */}
            <Card className="p-12 relative lg:-translate-y-6 bg-on-surface border-none shadow-none rounded-2xl flex flex-col h-full z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[0.65rem] font-medium px-6 py-2 rounded-full uppercase tracking-[0.25em] whitespace-nowrap">
                Founding Rate
              </div>
              <h3 className="label-md tracking-[0.25em] mb-6 text-surface-container-lowest opacity-60">FAMILY</h3>
              <p className="font-serif text-4xl text-surface-container-lowest mb-10">₹299 <span className="text-sm font-light opacity-50">/mo</span></p>
              <ul className="space-y-6 mb-12 flex-grow">
                <li className="text-sm font-light text-surface-container-lowest/80 flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div> Unlimited Members
                </li>
                <li className="text-sm font-light text-surface-container-lowest/80 flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div> Full AI Guardian
                </li>
                <li className="text-sm font-light text-surface-container-lowest/80 flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div> Automated Logistics
                </li>
              </ul>
              <Button onClick={handleSignIn} className="w-full bg-primary text-on-primary hover:bg-primary-dark h-16 rounded-sm label-md tracking-[0.2em]">SECURE LEGACY</Button>
            </Card>

            {/* Premium Plan */}
            <Card className="p-10 bg-primary-container/20 border-none shadow-none rounded-2xl flex flex-col h-full transition-all duration-700 hover:bg-primary-container/30">
              <h3 className="label-md tracking-[0.25em] mb-6 opacity-60">PREMIUM</h3>
              <p className="font-serif text-4xl text-on-surface mb-10">₹999 <span className="text-sm font-light opacity-50">/mo</span></p>
              <ul className="space-y-6 mb-12 flex-grow">
                <li className="text-sm font-light text-on-surface-variant flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div> Concierge Support
                </li>
                <li className="text-sm font-light text-on-surface-variant flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div> Heritage Archiving
                </li>
                <li className="text-sm font-light text-on-surface-variant flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div> Custom AI Training
                </li>
              </ul>
              <Button onClick={handleSignIn} className="w-full bg-primary text-on-primary hover:bg-primary-dark h-14 rounded-sm label-md tracking-[0.2em]">ENTER SANCTUARY</Button>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

const Waitlist = () => {
  return (
    <section className="py-32 bg-on-surface px-6 md:px-20 overflow-hidden">
      <div className="max-w-[800px] mx-auto text-center">
        <span className="label-md text-primary-container mb-10 block tracking-[0.3em]">THE FINAL STEP</span>
        <h2 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.1] tracking-[-0.025em] text-surface-container-lowest mb-12">
          Begin your <span className="italic text-primary-container/80">legacy</span>
        </h2>
        <p className="body-lg text-surface-container-lowest/60 leading-relaxed mb-16 max-w-xl mx-auto">
          We are currently inviting families in waves to ensure the highest quality of care. Secure your place in the lineage.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <Input 
            placeholder="Enter your email" 
            className="bg-surface-container-lowest/10 border-none text-surface-container-lowest placeholder:text-surface-container-lowest/30 h-16 px-8 rounded-sm font-sans focus:bg-surface-container-lowest/20 transition-all"
          />
          <Button className="bg-primary text-on-primary h-16 px-10 rounded-sm label-md tracking-[0.2em] hover:bg-primary-dark transition-all duration-500">
            JOIN WAITLIST
          </Button>
        </div>
        <p className="mt-12 text-[0.7rem] text-surface-container-lowest/30 label-md tracking-[0.15em]">
          NO SPAM · ONLY ESSENTIAL UPDATES · PRIVACY FIRST
        </p>
      </div>
    </section>
  );
};

export const Footer = () => {
  return (
    <footer className="bg-surface py-20 px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
        <div className="flex items-center gap-2">
          <span className="font-serif italic text-primary text-2xl">NEEV</span>
        </div>
        <div className="flex gap-10">
          <Link to="/privacy" className="label-md text-[0.7rem] text-on-surface-variant hover:text-on-surface transition-colors tracking-[0.1em]">PRIVACY</Link>
          <Link to="/terms" className="label-md text-[0.7rem] text-on-surface-variant hover:text-on-surface transition-colors tracking-[0.1em]">TERMS</Link>
          <Link to="/contact" className="label-md text-[0.7rem] text-on-surface-variant hover:text-on-surface transition-colors tracking-[0.1em]">CONTACT</Link>
        </div>
        <p className="font-jp font-serif text-lg text-primary/40 italic">परिवार की नींव</p>
      </div>
      <div className="max-w-[1240px] mx-auto mt-16 pt-8 border-t border-primary/5 text-center">
        <p className="label-md text-[0.6rem] text-on-surface-variant/40 tracking-[0.1em]">© 2026 NEEV · THE MODERN HEIRLOOM</p>
      </div>
    </footer>
  );
};

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.rv').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-surface selection:bg-primary-container selection:text-on-surface">
      <Navbar />
      <main>
        <Hero />
        <Philosophy />
        <Features />
        <Personas />
        <GuardianQuote />
        <AIGuardian />
        <Integrations />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
