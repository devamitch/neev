import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Heart, Shield, Sparkles, Users, User, Star } from 'lucide-react';
import gsap from 'gsap';

const roles = [
  {
    id: 'mother',
    label: 'MOTHER',
    title: 'The Nurturer',
    description: 'The heart of the family, managing the emotional and logistical rhythm.',
    icon: <Heart className="w-6 h-6" />,
    color: 'bg-primary-container',
    image: 'https://images.unsplash.com/photo-1594122230689-45899d9e6f69?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'father',
    label: 'FATHER',
    title: 'The Protector',
    description: 'The pillar of strength, ensuring security and long-term vision.',
    icon: <Shield className="w-6 h-6" />,
    color: 'bg-secondary-container',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'elder',
    label: 'ELDER',
    title: 'The Sage',
    description: 'The keeper of wisdom, passing down heritage and ancestral lessons.',
    icon: <Star className="w-6 h-6" />,
    color: 'bg-tertiary-container',
    image: 'https://images.unsplash.com/photo-1544120190-2751b862e366?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'child',
    label: 'CHILD',
    title: 'The Future',
    description: 'The blooming legacy, learning and growing within the family sanctuary.',
    icon: <Sparkles className="w-6 h-6" />,
    color: 'bg-primary-container',
    image: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=2070&auto=format&fit=crop'
  }
];

export default function RoleSetupPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(headerRef.current, {
        y: -30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      })
      .from(cardsRef.current?.children || [], {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1.2,
        ease: 'expo.out'
      }, "-=0.6")
      .from(footerRef.current, {
        opacity: 0,
        duration: 1,
        ease: 'power2.out'
      }, "-=0.4");
    });

    return () => ctx.revert();
  }, []);

  const handleComplete = () => {
    if (selectedRole) {
      navigate('/goals-setup');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col overflow-hidden selection:bg-primary-container selection:text-on-primary-container relative">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full silk-texture opacity-5 -z-10"></div>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary-container/10 rounded-full blur-[150px] -z-10"></div>
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-secondary-container/10 rounded-full blur-[150px] -z-10"></div>

      <header ref={headerRef} className="px-8 py-10 text-center">
        <div className="space-y-4">
          <span className="label-md text-primary tracking-[0.4em] block">IDENTITY</span>
          <h1 className="font-serif text-4xl md:text-6xl text-on-surface">Define your <span className="italic text-primary">role</span></h1>
          <p className="font-sans text-on-surface-variant max-w-lg mx-auto font-light">
            Every family member plays a vital part in the lineage. Choose the archetype that best represents your presence.
          </p>
        </div>
      </header>

      <main className="flex-grow px-6 lg:px-24 pb-24">
        <div ref={cardsRef} className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roles.map((role, idx) => (
            <div key={role.id}>
              <Card 
                onClick={() => setSelectedRole(role.id)}
                className={`group relative h-[400px] overflow-hidden cursor-pointer transition-all duration-700 border-none rounded-2xl ${
                  selectedRole === role.id 
                    ? 'ring-2 ring-primary ring-offset-8 ring-offset-surface scale-[1.02]' 
                    : 'hover:scale-[1.01]'
                }`}
              >
                <div className="absolute inset-0">
                  <img 
                    src={role.image} 
                    alt={role.title} 
                    className={`w-full h-full object-cover transition-transform duration-1000 ${
                      selectedRole === role.id ? 'scale-110' : 'group-hover:scale-105'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t from-on-surface/90 via-on-surface/20 to-transparent transition-opacity duration-700 ${
                    selectedRole === role.id ? 'opacity-100' : 'opacity-80 group-hover:opacity-90'
                  }`}></div>
                </div>

                <CardContent className="absolute inset-0 p-8 flex flex-col justify-end text-white">
                  <div className={`w-12 h-12 rounded-xl ${role.color} flex items-center justify-center text-primary mb-6 transform transition-transform duration-700 group-hover:scale-110`}>
                    {role.icon}
                  </div>
                  <span className="label-md text-[0.65rem] tracking-[0.3em] text-white/60 mb-2">{role.label}</span>
                  <h3 className="font-serif text-2xl mb-3">{role.title}</h3>
                  <p className="text-sm font-sans font-light text-white/70 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {role.description}
                  </p>
                </CardContent>

                {selectedRole === role.id && (
                  <div className="absolute top-6 right-6 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                    <Sparkles className="w-4 h-4 text-on-primary" />
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button
            onClick={handleComplete}
            disabled={!selectedRole}
            variant="primary"
            className="px-16 py-8 text-sm uppercase tracking-[0.3em] rounded-md shadow-xl shadow-primary/10 disabled:opacity-30"
          >
            Enter the Sanctuary
          </Button>
        </div>
      </main>

      <footer ref={footerRef} className="py-12 text-center opacity-30">
        <p className="label-md text-[0.6rem] tracking-[0.2em]">NEEV · THE MODERN HEIRLOOM</p>
      </footer>
    </div>
  );
}
