import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Mail, ShieldCheck, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, {
        y: 40,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out'
      });
    });

    return () => ctx.revert();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-surface flex items-center justify-center p-6 selection:bg-primary-container selection:text-on-surface relative overflow-hidden">
      {/* Decorative Silk Elements */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] -z-10"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-secondary-container/20 rounded-full blur-[120px] -z-10"></div>

      <div ref={cardRef} className="w-full max-w-md">
        <Card className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl shadow-primary/5">
          <CardContent className="p-0 space-y-10">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-primary-container rounded-full flex items-center justify-center shadow-lg shadow-primary/5">
                <Key className="w-10 h-10 text-primary" />
              </div>
            </div>

            <div className="space-y-3 text-center">
              <h2 className="font-serif text-3xl text-on-surface">Forgot Password?</h2>
              <p className="text-on-surface-variant font-sans font-light leading-relaxed">No worries, we'll send you reset instructions to your family email.</p>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md font-sans">
                {error}
              </div>
            )}

            {success ? (
              <div className="space-y-6 text-center">
                <div className="p-6 bg-primary-container text-on-primary-container rounded-xl font-sans">
                  <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
                  <p className="font-medium">Check your inbox</p>
                  <p className="text-sm opacity-80 mt-2">We've sent password reset instructions to {email}</p>
                </div>
                <Button 
                  onClick={() => navigate('/signin')}
                  className="w-full h-14 bg-primary text-on-primary hover:bg-primary/90 rounded-md text-lg font-sans transition-all"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-6">
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

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-primary text-on-primary hover:bg-primary/90 rounded-md text-lg font-sans transition-all active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Reset Password'}
                </Button>

                <Link 
                  to="/signin" 
                  className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-sans font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
