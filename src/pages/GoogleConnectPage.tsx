import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Image, CheckCircle2, Layout, Shield, ArrowRight, Loader2, Globe } from 'lucide-react';
import gsap from 'gsap';

const integrations = [
  {
    id: 'calendar',
    title: 'Google Calendar',
    description: 'Sync family schedules and important milestones.',
    icon: <Calendar className="w-6 h-6" />,
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    id: 'photos',
    title: 'Google Photos',
    description: 'Archive and curate family memories automatically.',
    icon: <Image className="w-6 h-6" />,
    color: 'bg-red-500/10 text-red-500',
  },
  {
    id: 'tasks',
    title: 'Google Tasks',
    description: 'Manage daily responsibilities and shared lists.',
    icon: <CheckCircle2 className="w-6 h-6" />,
    color: 'bg-yellow-500/10 text-yellow-500',
  }
];

export default function GoogleConnectPage() {
  const [connected, setConnected] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(headerRef.current, {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      })
      .from(gridRef.current?.children || [], {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.6");
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleConnect = (id: string) => {
    if (connected.includes(id)) return;
    
    setIsConnecting(id);
    // Simulate OAuth flow
    setTimeout(() => {
      setConnected(prev => [...prev, id]);
      setIsConnecting(null);
    }, 1500);
  };

  const handleComplete = () => {
    navigate('/dashboard');
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full silk-texture opacity-5 -z-10"></div>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary-container/10 rounded-full blur-[150px] -z-10"></div>
      
      <header ref={headerRef} className="px-8 pt-20 pb-12 text-center">
        <div className="space-y-4 max-w-2xl mx-auto">
          <span className="label-md text-primary tracking-[0.4em] block">ECOSYSTEM</span>
          <h1 className="font-serif text-4xl md:text-5xl text-on-surface">Connect your <span className="italic text-primary">digital</span> life</h1>
          <p className="font-sans text-on-surface-variant font-light">
            NEEV integrates with your Google ecosystem to automatically organize your family's history and future.
          </p>
        </div>
      </header>

      <main className="flex-grow px-6 max-w-4xl mx-auto w-full pb-24">
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {integrations.map((item) => (
            <Card 
              key={item.id}
              className={`group relative border-none rounded-2xl overflow-hidden transition-all duration-500 ${
                connected.includes(item.id) 
                  ? 'bg-primary-container/20' 
                  : 'bg-surface-container-low'
              }`}
            >
              <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${item.color}`}>
                  {item.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-xl text-on-surface">{item.title}</h3>
                  <p className="text-xs font-sans font-light text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                </div>
                
                <Button
                  onClick={() => handleConnect(item.id)}
                  disabled={connected.includes(item.id) || isConnecting === item.id}
                  variant={connected.includes(item.id) ? "ghost" : "outline"}
                  className="w-full rounded-md text-[0.65rem] uppercase tracking-[0.2em]"
                >
                  {isConnecting === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : connected.includes(item.id) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Connected
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 bg-surface-container-low/50 p-8 rounded-2xl border border-outline-variant/30 flex items-start gap-6 max-w-2xl mx-auto">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-serif text-lg text-on-surface">Privacy First Sanctuary</h4>
            <p className="text-sm font-sans font-light text-on-surface-variant leading-relaxed">
              We only access the data necessary to build your family dashboard. Your information remains secure and encrypted within the NEEV sanctuary.
            </p>
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <Button
            onClick={handleComplete}
            variant="primary"
            className="group px-16 py-8 text-sm uppercase tracking-[0.3em] rounded-md shadow-xl shadow-primary/10"
          >
            Finalize Sanctuary
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </main>

      <footer className="py-12 text-center opacity-30">
        <p className="label-md text-[0.6rem] tracking-[0.2em]">NEEV · THE MODERN HEIRLOOM</p>
      </footer>
    </div>
  );
}
