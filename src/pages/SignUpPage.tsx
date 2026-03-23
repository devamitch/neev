import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import { signInWithGoogle, auth } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Mail, Lock, User, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: fullName });
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
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
            Begin your <br />
            <span className="italic text-primary/70">family legacy</span>
          </h1>
          
          <p className="body-lg text-on-surface-variant max-w-md font-light leading-relaxed">
            Join a sanctuary designed for the modern Indian family. Automate the mundane, preserve the precious, and lead with wisdom.
          </p>

          <div className="relative aspect-[4/5] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transform rotate-[-2deg] hover:rotate-0 transition-transform duration-700">
            <img 
              src="https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop" 
              alt="Indian family moment" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent"></div>
            <div className="absolute bottom-8 left-8 right-8 p-8 bg-surface/90 backdrop-blur-xl rounded-xl shadow-2xl">
              <p className="font-serif italic text-on-surface text-xl leading-relaxed">
                "The greatest inheritance we can leave our children is a life well-lived and well-documented."
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div ref={rightSideRef}>
          <Card className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl shadow-primary/5">
            <CardContent className="p-0 space-y-10">
              <div className="space-y-3">
                <h2 className="font-serif text-3xl text-on-surface">Create Account</h2>
                <p className="text-on-surface-variant font-sans font-light leading-relaxed">Enter the sanctuary of NEEV.</p>
              </div>

              {error && (
                <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md font-sans">
                  {error}
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="label-md text-on-surface-variant">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
                    <Input 
                      id="fullName"
                      type="text"
                      placeholder="Arjun Sharma"
                      className="bg-surface-container-low border-none h-14 pl-12 rounded-md focus:bg-surface-container-highest transition-colors font-sans"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="label-md text-on-surface-variant">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
                    <Input 
                      id="email"
                      type="email"
                      placeholder="arjun@legacy.com"
                      className="bg-surface-container-low border-none h-14 pl-12 rounded-md focus:bg-surface-container-highest transition-colors font-sans"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="label-md text-on-surface-variant">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
                    <Input 
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="bg-surface-container-low border-none h-14 pl-12 rounded-md focus:bg-surface-container-highest transition-colors font-sans"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-primary text-on-primary hover:bg-primary/90 rounded-md text-lg font-sans transition-all active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Legacy Account'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-surface-container"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface-container-lowest px-4 text-on-surface-variant font-sans tracking-widest">Or continue with</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-14 bg-surface-container-low border-none hover:bg-surface-container-highest rounded-md text-on-surface font-sans transition-all"
                onClick={handleGoogleSignIn}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-3" />
                Google Account
              </Button>

              <p className="text-center text-on-surface-variant font-sans">
                Already have an account?{' '}
                <Link to="/signin" className="text-primary hover:underline font-medium">Sign In</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
