import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithGoogle } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

export default function SignInPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const leftSideRef = useRef<HTMLDivElement>(null);
  const rightSideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.to(containerRef.current, {
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out'
      })
      .from(leftSideRef.current?.children || [], {
        y: 30,
        opacity: 0,
        stagger: 0.15,
        duration: 1.2,
        ease: 'expo.out'
      }, "-=0.4")
      .from(rightSideRef.current, {
        x: 40,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out'
      }, "-=1");
    });

    return () => ctx.revert();
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      gsap.to(containerRef.current, {
        opacity: 0,
        y: -20,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => navigate('/onboarding')
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-surface flex items-center justify-center p-6 opacity-0 selection:bg-primary-container selection:text-on-surface relative overflow-hidden">
      {/* Decorative Silk Elements */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] -z-10"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-secondary-container/20 rounded-full blur-[120px] -z-10"></div>

      <div className="w-full max-w-[1160px] grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
        
        {/* Left Side: Brand & Imagery */}
        <div 
          ref={leftSideRef}
          className="hidden lg:block space-y-12"
        >
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-primary text-4xl">NEEV</span>
          </div>
          
          <h1 className="font-serif text-[clamp(3rem,5vw,4.5rem)] leading-[0.95] text-on-surface tracking-tight">
            Welcome back to<br />
            <span className="italic text-primary/70">the Sanctuary</span>
          </h1>
          
          <p className="body-lg text-on-surface-variant max-w-md font-light leading-relaxed">
            Your family's rhythm is waiting. Sign in to continue your legacy and lead with AI-guided wisdom.
          </p>

          <div className="relative aspect-[4/5] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transform rotate-[2deg] hover:rotate-0 transition-transform duration-700">
            <img 
              src="https://images.unsplash.com/photo-1617633265040-17940a702e06?q=80&w=2070&auto=format&fit=crop" 
              alt="Indian family moment" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent"></div>
            <div className="absolute bottom-8 left-8 right-8 p-8 bg-surface/90 backdrop-blur-xl rounded-xl shadow-2xl">
              <p className="font-serif italic text-on-surface text-xl leading-relaxed">
                "Wisdom is the bridge between generations."
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div ref={rightSideRef}>
          <Card className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl shadow-primary/5">
            <CardContent className="p-0 space-y-10">
              <div className="space-y-3">
                <h2 className="font-serif text-3xl text-on-surface">Sign In</h2>
                <p className="text-on-surface-variant font-sans font-light leading-relaxed">Enter your family's digital heirloom.</p>
              </div>

              {error && (
                <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md font-sans">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant font-sans font-medium">Secret Key</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
                    <input 
                      type="password"
                      placeholder="••••••••••••"
                      disabled
                      className="w-full bg-surface-container-low border-none h-14 pl-12 rounded-md focus:bg-surface-container-highest transition-colors font-sans opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-primary text-sm hover:underline font-sans">
                      Forgot Password?
                    </Link>
                  </div>
                </div>

                <Button 
                  className="w-full h-14 bg-primary text-on-primary hover:bg-primary/90 rounded-md text-lg font-sans transition-all active:scale-[0.98]"
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  {loading ? 'Opening Vault...' : 'Access Vault with Google'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-surface-container"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-surface/80 px-4 text-on-surface-variant font-sans tracking-widest">Or continue with</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full h-14 bg-surface-container-low border-none hover:bg-surface-container-highest rounded-md text-on-surface font-sans transition-all"
                  disabled
                >
                  Sign in with Secret Key
                </Button>

                <p className="text-center text-on-surface-variant font-sans">
                  New to the lineage?{' '}
                  <Link to="/signup" className="text-primary hover:underline font-medium">Create Legacy Account</Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
