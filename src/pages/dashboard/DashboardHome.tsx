import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Heart, 
  Sparkles, 
  ChevronRight, 
  Plus, 
  MoreVertical,
  Image as ImageIcon,
  CheckCircle2,
  TrendingUp,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '../../contexts/AuthContext';
import gsap from 'gsap';
import DataPreparationOverlay from '../../components/dashboard/DataPreparationOverlay';

export default function DashboardHome() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'User';
  const containerRef = useRef<HTMLDivElement>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const hasSeenOverlay = localStorage.getItem('neev_overlay_seen');
    if (!hasSeenOverlay) {
      setShowOverlay(true);
    }
  }, []);

  const handleOverlayComplete = () => {
    setShowOverlay(false);
    localStorage.setItem('neev_overlay_seen', 'true');
  };

  useEffect(() => {
    if (!showOverlay) {
      const ctx = gsap.context(() => {
        gsap.from(".dashboard-card", {
          y: 30,
          opacity: 0,
          stagger: 0.1,
          duration: 1.2,
          ease: 'expo.out'
        });
      }, containerRef);
      return () => ctx.revert();
    }
  }, [showOverlay]);

  return (
    <>
      <AnimatePresence>
        {showOverlay && <DataPreparationOverlay onComplete={handleOverlayComplete} />}
      </AnimatePresence>

      <div ref={containerRef} className={`space-y-12 pb-24 lg:pb-0 ${showOverlay ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'}`}>
      {/* Guardian Brief Card */}
      <div className="dashboard-card">
        <Card className="relative overflow-hidden border-none bg-on-surface text-surface-container-lowest rounded-2xl p-8 md:p-14 shadow-2xl shadow-primary/20 group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -z-0 group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span className="label-md text-[0.65rem] tracking-[0.4em] text-primary uppercase">GUARDIAN BRIEF · {new Date().toLocaleDateString('en-US', { weekday: 'long' })}</span>
              </div>
              <h2 className="font-serif text-3xl md:text-5xl leading-tight tracking-tight">
                "Good morning, {firstName}. I've synced your <span className="italic text-primary">Google Ecosystem</span>. Your day is optimized for <span className="italic">Deep Presence</span>."
              </h2>
              <p className="font-sans text-surface-container-lowest/60 font-light text-lg leading-relaxed max-w-xl">
                Based on your Google Calendar and Tasks, I've identified a 2-hour window for Arjun's math preparation. I've also curated 5 new memories from Google Photos for your evening ritual.
              </p>
            </div>
            <Button variant="outline" className="bg-surface-container-lowest/10 border-none text-surface-container-lowest hover:bg-surface-container-lowest/20 px-10 py-8 rounded-md label-md tracking-[0.2em] transition-all active:scale-95">
              VIEW SYNC DETAILS
            </Button>
          </div>
          <div className="absolute inset-0 silk-texture opacity-5 pointer-events-none"></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Family Rhythm & Tasks */}
        <div className="lg:col-span-2 space-y-12">
          <section className="dashboard-card space-y-8">
            <div className="flex justify-between items-end">
              <div className="space-y-2">
                <span className="label-md text-primary tracking-[0.3em] block uppercase text-[0.7rem]">GOOGLE SYNC</span>
                <h3 className="font-serif text-4xl">Integrated Calendar</h3>
              </div>
              <Button variant="ghost" className="text-primary label-md tracking-[0.15em] hover:bg-primary/5 px-4">
                OPEN GOOGLE CALENDAR <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            {/* Calendar Strip */}
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-6">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                <button 
                  key={day}
                  className={`flex-shrink-0 w-24 h-32 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-700 group ${
                    i === 2 ? 'bg-primary text-on-primary shadow-2xl shadow-primary/30' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-mid'
                  }`}
                >
                  <span className={`label-md text-[0.65rem] tracking-[0.15em] transition-opacity duration-500 ${i === 2 ? 'opacity-80' : 'opacity-50'}`}>{day}</span>
                  <span className="font-serif text-3xl">{22 + i}</span>
                  {i === 2 && <div className="w-1.5 h-1.5 rounded-full bg-on-primary" />}
                </button>
              ))}
            </div>

            {/* Google Tasks & Actions */}
            <div className="space-y-5">
              {[
                { title: 'Review Arjun\'s Math Progress', time: '10:00 AM - 11:30 AM', category: 'Education', icon: <TrendingUp className="w-5 h-5" />, source: 'Google Tasks' },
                { title: 'Pediatrician Checkup', time: 'Tomorrow, 2:00 PM', category: 'Health', icon: <CalendarIcon className="w-5 h-5" />, source: 'Google Calendar' },
                { title: 'Curate Anniversary Album', time: 'Evening Ritual', category: 'Legacy', icon: <ImageIcon className="w-5 h-5" />, source: 'Google Photos' }
              ].map((task, i) => (
                <Card key={i} className="group border-none bg-surface-container-low hover:bg-surface-container-mid transition-all duration-700 rounded-2xl p-8 cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-8">
                      <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform duration-700">
                        {task.icon}
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-serif text-2xl group-hover:text-primary transition-colors duration-500">{task.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-on-surface-variant/60 font-light">
                          <span>{task.time}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/30"></span>
                          <span className="label-md text-[0.65rem] tracking-[0.15em] text-primary uppercase">{task.source}</span>
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-on-surface-variant/20 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                </Card>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Children & Shared Ecosystem */}
        <div className="space-y-12">
          <section className="dashboard-card space-y-8">
            <div className="space-y-2">
              <span className="label-md text-primary tracking-[0.3em] block uppercase text-[0.7rem]">CHILDREN'S PROGRESS</span>
              <h3 className="font-serif text-4xl">Daily Growth</h3>
            </div>
            
            <div className="space-y-6">
              {[
                { name: 'Arjun', progress: '75%', note: 'Focused on Algebra today', activity: 'Mathematics Module', color: 'bg-primary-container', image: 'https://images.unsplash.com/photo-1511551203524-9a24350a5771?q=80&w=2070&auto=format&fit=crop' },
                { name: 'Diya', progress: '90%', note: 'Completed painting module', activity: 'Art & Expression', color: 'bg-secondary-container', image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=2040&auto=format&fit=crop' }
              ].map((child, i) => (
                <Card key={i} className="border-none bg-surface-container-low p-8 rounded-2xl hover:bg-surface-container-mid transition-all duration-700 group cursor-pointer">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-6">
                      <Avatar className="w-16 h-16 rounded-2xl shadow-lg group-hover:scale-105 transition-transform duration-700">
                        <AvatarImage src={child.image} className="object-cover" />
                        <AvatarFallback className={child.color}>{child.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h4 className="font-serif text-2xl group-hover:text-primary transition-colors duration-500">{child.name}</h4>
                        <p className="text-xs text-on-surface-variant/60 font-light italic">{child.note}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[0.65rem] label-md tracking-[0.1em] text-on-surface-variant/60">
                          <span>DAILY GOAL</span>
                          <span>{child.progress}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-1000 ease-out" 
                            style={{ width: child.progress }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                        <span className="text-[0.7rem] font-sans font-light text-on-surface-variant italic">Active: {child.activity}</span>
                        <Button variant="ghost" size="sm" className="h-7 text-[0.6rem] tracking-[0.1em] text-primary hover:bg-primary/5 px-2 uppercase">
                          ADD NOTE
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Shared Ecosystem Insight */}
          <div className="dashboard-card">
            <Card className="border-none bg-primary-container/30 p-10 rounded-2xl space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:scale-125 transition-transform duration-1000"></div>
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <span className="label-md text-[0.7rem] tracking-[0.3em] text-primary uppercase">SPOUSE ECOSYSTEM</span>
              </div>
              <p className="font-serif italic text-2xl text-on-surface leading-relaxed">
                "Your spouse has added 3 new documents to the Shared Vault. Review them during your evening sync."
              </p>
              <Button variant="ghost" className="p-0 text-primary label-md tracking-[0.15em] h-auto hover:text-on-surface transition-colors uppercase text-[0.7rem]">
                OPEN SHARED VAULT <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}
