import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Sparkles, Send, Mic, 
  Image as ImageIcon, Paperclip, 
  ChevronRight, Brain, Lightbulb,
  ShieldCheck, Heart, Star, Info, Settings, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import gsap from 'gsap';

const Message = ({ text, isUser, timestamp }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-10`}
  >
    <div className={`flex gap-6 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="w-14 h-14 border-none shadow-lg shadow-black/5 shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-primary text-on-primary font-sans text-sm font-bold">U</AvatarFallback>
        ) : (
          <AvatarFallback className="bg-primary-container text-primary font-serif text-2xl">G</AvatarFallback>
        )}
      </Avatar>
      <div className={`p-8 rounded-2xl ${isUser ? 'bg-primary text-on-primary shadow-xl shadow-primary/10' : 'bg-surface/40 backdrop-blur-md text-on-surface border border-white/5 shadow-xl shadow-black/5'} relative group`}>
        {!isUser && (
          <div className="absolute -left-2 top-6 w-4 h-4 bg-surface/40 backdrop-blur-md rotate-45 rounded-sm -z-10 border-l border-b border-white/5"></div>
        )}
        {isUser && (
          <div className="absolute -right-2 top-6 w-4 h-4 bg-primary rotate-45 rounded-sm -z-10"></div>
        )}
        <p className="text-base md:text-lg font-sans leading-relaxed font-light opacity-90">{text}</p>
        <div className={`flex items-center gap-3 mt-4 opacity-40 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] font-sans uppercase tracking-widest font-bold">{timestamp}</span>
          {!isUser && <Sparkles className="w-3 h-3 text-primary" />}
        </div>
      </div>
    </div>
  </motion.div>
);

const WisdomCard = ({ title, description, icon: Icon }: any) => (
  <Card className="bg-surface/40 backdrop-blur-md border border-white/5 rounded-2xl p-8 hover:bg-surface-container-low/50 transition-all duration-500 cursor-pointer group shadow-lg shadow-black/5">
    <div className="w-12 h-12 rounded-xl bg-primary-container/40 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h4 className="font-serif text-xl text-on-surface mb-3 group-hover:text-primary transition-colors">{title}</h4>
    <p className="text-sm text-on-surface-variant font-sans font-light leading-relaxed opacity-80">{description}</p>
  </Card>
);

export default function GuidancePage() {
  const [messages, setMessages] = useState([
    { text: "Good morning, Arjun. I've analyzed your family's schedule for the week. Ananya has a math test on Thursday, and Rohan's swimming class is rescheduled. How can I guide you today?", isUser: false, timestamp: "09:00 AM" },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(headerRef.current?.children || [], {
        y: 20,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out'
      })
      .from(chatAreaRef.current, {
        x: -30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.4")
      .from(sidebarRef.current?.children || [], {
        x: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power2.out'
      }, "-=0.6");
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { text: input, isUser: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    setMessages(newMessages);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        text: "I've noted that. I'll coordinate with Meena Aunty for the pickup and update the family calendar. Would you like me to also suggest a healthy dinner recipe for tonight?", 
        isUser: false, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    }, 1500);
  };

  const suggestions = [
    { icon: Brain, label: "Analyze Schedule", color: "bg-primary-container/40" },
    { icon: Lightbulb, label: "Parenting Tip", color: "bg-tertiary-container/40" },
    { icon: Heart, label: "Family Wellness", color: "bg-secondary-container/40" },
    { icon: Star, label: "Legacy Planning", color: "bg-primary-container/40" },
  ];

  const wisdomCards = [
    { title: "Digital Fasting", description: "The family is feeling a bit disconnected. Suggesting a 'No-Phone Sunday' to restore the rhythm.", icon: Clock },
    { title: "Ancestral Stories", description: "Ananya is curious about her roots. I've prepared a story about your grandfather's journey.", icon: Star },
    { title: "Academic Balance", description: "Math test prep is going well, but Ananya needs more sleep. Adjusting bedtime by 30 mins.", icon: Brain },
  ];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col max-w-[1160px] mx-auto p-8 md:p-12 selection:bg-primary-container selection:text-on-surface relative overflow-hidden">
      {/* Decorative Silk Elements */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary-container/10 rounded-full blur-[160px] -z-10"></div>
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-secondary-container/10 rounded-full blur-[160px] -z-10"></div>

      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-16">
        <div className="flex items-center gap-8">
          <div className="w-16 h-16 bg-primary-container/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl shadow-primary/5 relative group">
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
            <Sparkles className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="space-y-1">
            <h1 className="font-serif text-4xl text-on-surface tracking-tight">AI <span className="italic text-primary/70">Guardian</span></h1>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-sans font-bold">Always here for your family</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-12 h-12 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all rounded-full">
            <Info className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" className="w-12 h-12 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all rounded-full">
            <Settings className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-16 overflow-hidden">
        {/* Chat Area */}
        <div ref={chatAreaRef} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar mb-10 pr-6" ref={scrollRef}>
            <div className="max-w-4xl mx-auto">
              <AnimatePresence>
                {messages.map((msg, index) => (
                  <Message key={index} {...msg} />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Input Area */}
          <div className="w-full space-y-8 bg-surface/20 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-2xl shadow-black/5">
            {/* Quick Suggestions */}
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {suggestions.map((s, i) => (
                <button 
                  key={i}
                  className={`flex items-center gap-3 px-6 py-3 rounded-full ${s.color} hover:bg-primary hover:text-on-primary transition-all whitespace-nowrap shadow-sm group active:scale-95`}
                >
                  <s.icon className="w-4 h-4 text-on-surface group-hover:text-on-primary transition-colors" />
                  <span className="text-xs font-sans font-bold uppercase tracking-widest">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Input Box */}
            <div className="relative bg-surface-container-low/50 rounded-2xl p-3 shadow-inner focus-within:bg-surface-container-low transition-all duration-500 border border-white/5">
              <div className="flex items-center gap-4 px-4">
                <Button variant="ghost" size="icon" className="w-12 h-12 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-full transition-all">
                  <Paperclip className="w-6 h-6" />
                </Button>
                <Input 
                  placeholder="Ask your Guardian anything..."
                  className="bg-transparent border-none h-16 focus:ring-0 font-sans text-on-surface text-lg placeholder:text-on-surface-variant/30"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="w-12 h-12 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-full transition-all hidden sm:flex">
                    <Mic className="w-6 h-6" />
                  </Button>
                  <Button 
                    onClick={handleSend}
                    className="bg-primary text-on-primary hover:bg-primary/90 w-14 h-14 p-0 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xl shadow-primary/20"
                  >
                    <Send className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-center text-on-surface-variant font-sans opacity-40 uppercase tracking-[0.3em] font-bold">
              Quantum-Encrypted Wisdom · NEEV AI
            </p>
          </div>
        </div>

        {/* Sidebar / Wisdom Cards */}
        <div ref={sidebarRef} className="hidden lg:flex flex-col w-[340px] gap-10 overflow-y-auto no-scrollbar">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-[1px] bg-primary"></span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-sans font-bold">PROACTIVE GUIDANCE</span>
            </div>
            <h3 className="font-serif text-2xl text-on-surface">Wisdom Cards</h3>
          </div>
          <div className="space-y-8">
            {wisdomCards.map((card, i) => (
              <WisdomCard key={i} {...card} />
            ))}
          </div>
          
          <Card className="bg-primary-container/40 backdrop-blur-md border border-primary/10 rounded-2xl p-8 mt-auto shadow-xl shadow-primary/5 group">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-surface/40 rounded-full flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] font-sans font-bold text-primary uppercase tracking-widest">Privacy Shield</span>
            </div>
            <p className="text-sm text-on-surface-variant font-sans font-light leading-relaxed opacity-90">
              Your conversations are private. Not even NEEV staff can access your family's wisdom data.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
