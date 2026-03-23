import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Globe, Shield, Heart, Loader2 } from 'lucide-react';
import gsap from 'gsap';

export default function DataPreparationOverlay({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { text: "Reading family goals and intentions...", icon: <Heart className="w-6 h-6" /> },
    { text: "Syncing Google Calendar & Tasks...", icon: <Globe className="w-6 h-6" /> },
    { text: "Curating memories from Google Photos...", icon: <Sparkles className="w-6 h-6" /> },
    { text: "Preparing your family sanctuary...", icon: <Shield className="w-6 h-6" /> }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => {
        if (prev === steps.length - 1) {
          clearInterval(timer);
          setTimeout(onComplete, 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [onComplete, steps.length]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="absolute top-0 left-0 w-full h-full silk-texture opacity-5 -z-10"></div>
      
      <div className="space-y-12 max-w-md w-full">
        <div className="relative">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-primary shadow-lg animate-bounce">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-serif text-3xl text-on-surface">Preparing your <span className="italic text-primary">Sanctuary</span></h2>
          <p className="font-sans text-on-surface-variant font-light">
            NEEV is curating your family's digital lineage and daily rhythm.
          </p>
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div 
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-4 bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30"
            >
              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
                {steps[step].icon}
              </div>
              <span className="text-sm font-sans font-light text-on-surface text-left">
                {steps[step].text}
              </span>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-2 justify-center">
            {steps.map((_, i) => (
              <div 
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === step ? 'w-8 bg-primary' : 'w-2 bg-primary/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <footer className="absolute bottom-12 text-center opacity-30">
        <p className="label-md text-[0.6rem] tracking-[0.2em]">NEEV · THE MODERN HEIRLOOM</p>
      </footer>
    </motion.div>
  );
}
