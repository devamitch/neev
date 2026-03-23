import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

export default function OTPVerificationPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, {
        scale: 0.95,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out'
      });
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    // Simulate verification
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 selection:bg-primary-container selection:text-on-surface relative overflow-hidden">
      {/* Decorative Silk Elements */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] -z-10"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-secondary-container/20 rounded-full blur-[120px] -z-10"></div>

      <div
        ref={cardRef}
        className="w-full max-w-md"
      >
        <Card className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl shadow-primary/5">
          <CardContent className="p-0 space-y-10">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-primary-container rounded-full flex items-center justify-center shadow-lg shadow-primary/5">
                <ShieldCheck className="w-10 h-10 text-primary" />
              </div>
            </div>

            <div className="space-y-3 text-center">
              <h2 className="font-serif text-3xl text-on-surface">Verify Identity</h2>
              <p className="text-on-surface-variant font-sans font-light leading-relaxed">We've sent a 6-digit code to your family email.</p>
            </div>

            <div className="flex justify-between gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 md:w-14 md:h-16 text-center text-xl font-bold bg-surface-container-low border-none rounded-md focus:bg-surface-container-highest transition-colors font-sans"
                />
              ))}
            </div>

            <Button 
              onClick={handleVerify}
              className="w-full h-14 bg-primary text-on-primary hover:bg-primary/90 rounded-md text-lg font-sans transition-all active:scale-[0.98]"
              disabled={loading || otp.some(d => !d)}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>

            <div className="text-center space-y-4">
              <p className="text-on-surface-variant font-sans text-sm">
                Didn't receive the code?{' '}
                {timer > 0 ? (
                  <span className="text-primary font-medium">Resend in {timer}s</span>
                ) : (
                  <button 
                    onClick={() => setTimer(30)}
                    className="text-primary hover:underline font-medium flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend Code
                  </button>
                )}
              </p>
              
              <button 
                onClick={() => navigate('/signin')}
                className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-sans font-medium mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
