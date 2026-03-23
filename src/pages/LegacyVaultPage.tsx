import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Lock, FileText, Image as ImageIcon, 
  Video, Music, Plus, Search, Filter, 
  MoreVertical, Download, Share2, Trash2,
  Clock, Heart, Star, ShieldCheck, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import gsap from 'gsap';

const VaultItem = ({ title, type, date, icon: Icon, color }: any) => (
  <Card className="bg-surface/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 hover:bg-surface-container-low/50 transition-all duration-500 cursor-pointer group shadow-lg shadow-black/5 vault-item">
    <div className="flex items-start justify-between mb-6">
      <div className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-500`}>
        <Icon className="w-7 h-7 text-on-surface" />
      </div>
      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant">
        <MoreVertical className="w-5 h-5" />
      </Button>
    </div>
    <div className="space-y-2">
      <h4 className="font-serif text-xl text-on-surface truncate group-hover:text-primary transition-colors">{title}</h4>
      <div className="flex items-center gap-3 text-xs text-on-surface-variant font-sans font-medium uppercase tracking-widest">
        <span>{type}</span>
        <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
        <span>{date}</span>
      </div>
    </div>
  </Card>
);

export default function LegacyVaultPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(headerRef.current?.children || [], {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'expo.out'
      })
      .from(statsRef.current?.children || [], {
        y: 20,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'power2.out'
      }, "-=0.6")
      .from('.vault-item', {
        scale: 0.9,
        opacity: 0,
        stagger: 0.05,
        duration: 0.8,
        ease: 'back.out(1.7)'
      }, "-=0.4");
    });

    return () => ctx.revert();
  }, []);

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'documents', label: 'Documents' },
    { id: 'memories', label: 'Memories' },
    { id: 'legal', label: 'Legal & Wills' },
    { id: 'financial', label: 'Financial' },
  ];

  return (
    <div className="max-w-[1160px] mx-auto p-8 md:p-12 space-y-16 selection:bg-primary-container selection:text-on-surface relative overflow-hidden">
      {/* Decorative Silk Elements */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary-container/10 rounded-full blur-[160px] -z-10"></div>
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-secondary-container/10 rounded-full blur-[160px] -z-10"></div>

      {/* Header */}
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-end justify-between gap-12">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="w-8 h-[1px] bg-primary"></span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-sans font-bold">
              THE SANCTUARY
            </span>
          </div>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] text-on-surface tracking-tight">
            Legacy <span className="italic text-primary/70">Vault</span>
          </h1>
          <p className="body-lg text-on-surface-variant max-w-xl font-light leading-relaxed">
            Securely preserve your family's most precious documents, memories, and wisdom for generations to come. A digital heirloom for the modern age.
          </p>
        </div>
        <div>
          <Button className="h-16 px-10 bg-primary text-on-primary hover:bg-primary/90 rounded-md flex items-center gap-3 shadow-xl shadow-primary/10 uppercase tracking-[0.2em] text-xs font-sans font-bold transition-all active:scale-95">
            <Plus className="w-5 h-5" />
            Secure New Asset
          </Button>
        </div>
      </div>

      {/* Stats / Overview */}
      <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Security Level', value: 'Quantum Encrypted', icon: Shield, color: 'bg-primary-container text-primary' },
          { label: 'Storage Used', value: '12.4 GB / 100 GB', icon: Lock, color: 'bg-tertiary-container text-on-tertiary-container' },
          { label: 'Shared Legacies', value: '4 Family Members', icon: Heart, color: 'bg-secondary-container text-on-secondary-container' },
        ].map((stat, i) => (
          <Card key={i} className="bg-surface/40 backdrop-blur-md border border-white/5 rounded-2xl p-8 flex items-center gap-8 shadow-lg shadow-black/5 group">
            <div className={`w-16 h-16 ${stat.color} rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-sans text-on-surface-variant uppercase tracking-widest font-bold">{stat.label}</p>
              <p className="font-serif text-2xl text-on-surface">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="relative w-full md:w-[400px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
            <Input 
              placeholder="Search your legacy..."
              className="bg-surface-container-low/50 border-none h-14 pl-14 rounded-xl focus:bg-surface-container-low transition-all font-sans text-on-surface placeholder:text-on-surface-variant/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
            {categories.map((cat) => (
              <Button 
                key={cat.id}
                variant="ghost" 
                className="whitespace-nowrap rounded-full px-8 h-12 bg-surface-container-low/50 hover:bg-surface-container-low text-on-surface-variant font-sans font-medium text-sm transition-all"
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid of Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <VaultItem 
            title="Family Will & Trust 2024" 
            type="PDF Document" 
            date="Mar 12, 2024" 
            icon={FileText} 
            color="bg-primary-container/40"
          />
          <VaultItem 
            title="Rohan's First Steps" 
            type="Video Memory" 
            date="Jan 05, 2025" 
            icon={Video} 
            color="bg-tertiary-container/40"
          />
          <VaultItem 
            title="Ancestral Home Deeds" 
            type="Scanned Document" 
            date="Dec 20, 2023" 
            icon={Shield} 
            color="bg-secondary-container/40"
          />
          <VaultItem 
            title="Wedding Anniversary 2023" 
            type="Photo Album" 
            date="Oct 15, 2023" 
            icon={ImageIcon} 
            color="bg-primary-container/40"
          />
          <VaultItem 
            title="Grandpa's Voice Notes" 
            type="Audio Memory" 
            date="Aug 10, 2023" 
            icon={Music} 
            color="bg-tertiary-container/40"
          />
          <VaultItem 
            title="Property Tax Receipts" 
            type="Financial" 
            date="Feb 28, 2024" 
            icon={FileText} 
            color="bg-surface-container-high/40"
          />
          <VaultItem 
            title="Ananya's Birth Certificate" 
            type="Legal" 
            date="Jun 14, 2016" 
            icon={ShieldCheck} 
            color="bg-primary-container/40"
          />
          <VaultItem 
            title="Family Tree Archive" 
            type="Interactive" 
            date="Updated Today" 
            icon={Star} 
            color="bg-secondary-container/40"
          />
        </div>
      </div>

      {/* Featured Memory Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <Card className="lg:col-span-2 bg-surface/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden flex flex-col md:flex-row items-stretch group shadow-xl shadow-black/5">
          <div className="w-full md:w-1/2 overflow-hidden relative">
            <img 
              src="https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop" 
              alt="Family memory" 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>
          </div>
          <div className="w-full md:w-1/2 p-10 md:p-14 space-y-10 flex flex-col justify-center">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-[1px] bg-primary"></span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-sans font-bold">MEMORY OF THE MONTH</span>
              </div>
              <h3 className="font-serif text-3xl md:text-4xl text-on-surface leading-tight tracking-tight">The Diwali of 2023</h3>
            </div>
            <p className="body-lg text-on-surface-variant font-serif italic leading-relaxed opacity-80">
              "Remembering the light, the laughter, and the way the house smelled of marigolds and sweets. This was the first year Rohan helped with the rangoli."
            </p>
            <div className="flex items-center gap-8 pt-4">
              <Button className="bg-primary text-on-primary hover:bg-primary/90 rounded-md px-10 h-12 transition-all active:scale-95">Relive Memory</Button>
              <button className="text-sm text-primary hover:text-on-surface transition-all font-serif italic border-b border-primary/30 hover:border-on-surface pb-1">Share with Family</button>
            </div>
          </div>
        </Card>

        {/* Guardian Insight Card */}
        <Card className="bg-surface-container-low/60 backdrop-blur-xl border border-white/10 rounded-2xl p-10 md:p-12 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-primary/5 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-container/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-1000"></div>
          
          <div className="space-y-8 relative z-10">
            <div className="w-14 h-14 bg-surface/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg shadow-black/5">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-4">
              <h3 className="font-serif text-2xl text-on-surface leading-tight">Guardian Insight</h3>
              <p className="text-on-surface-variant font-light leading-relaxed opacity-90">
                "I've noticed you haven't updated your family tree since Rohan's last birthday. Would you like me to pull the latest photos from your Google Photos 'Family' album?"
              </p>
            </div>
          </div>
          
          <Button className="w-full h-14 bg-primary text-on-primary hover:bg-primary/90 rounded-md font-sans font-medium transition-all active:scale-95 mt-10">
            Update Now
          </Button>
        </Card>
      </div>
    </div>
  );
}
