import React, { useEffect, useRef } from 'react';
import { User, Bell, Shield, Smartphone, CreditCard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import gsap from 'gsap';

export default function SettingsModule() {
  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
      .from(sidebarRef.current?.children || [], {
        x: -20,
        opacity: 0,
        stagger: 0.05,
        duration: 0.6,
        ease: 'power2.out'
      }, "-=0.4")
      .from(contentRef.current, {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.4");
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="max-w-[1160px] mx-auto p-6 md:p-10">
      <div ref={headerRef} className="mb-10">
        <h1 className="font-serif text-3xl text-text-ink mb-2">Settings</h1>
        <p className="text-sm text-text-muted font-sans font-light">Manage your family's operating system.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        <div className="w-full md:w-64 flex-shrink-0">
          <nav ref={sidebarRef} className="space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-sage-mist text-sage-dim rounded-md font-medium transition-colors font-sans text-sm">
              <User className="w-4 h-4" />
              Profile
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-muted hover:bg-surface-lo hover:text-text-ink rounded-md transition-colors font-sans text-sm">
              <Bell className="w-4 h-4" />
              Notifications
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-muted hover:bg-surface-lo hover:text-text-ink rounded-md transition-colors font-sans text-sm">
              <Shield className="w-4 h-4" />
              Privacy & Security
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-muted hover:bg-surface-lo hover:text-text-ink rounded-md transition-colors font-sans text-sm">
              <Smartphone className="w-4 h-4" />
              Integrations
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-muted hover:bg-surface-lo hover:text-text-ink rounded-md transition-colors font-sans text-sm">
              <CreditCard className="w-4 h-4" />
              Billing
            </a>
          </nav>
        </div>

        <div ref={contentRef} className="flex-1">
          <Card className="bg-surface-hi border-none rounded-md p-8">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="font-serif text-2xl text-text-ink">Profile Information</CardTitle>
            </CardHeader>
            
            <div className="flex items-center gap-8 mb-10">
              <Avatar className="w-24 h-24">
                <AvatarFallback className="bg-sage text-surface-hi font-serif text-3xl">
                  V
                </AvatarFallback>
              </Avatar>
              <div>
                <Button variant="ghost" size="sm" className="bg-surface-lo text-text-ink border border-surface-mid hover:bg-surface-mid">
                  Change Photo
                </Button>
                <p className="text-[0.68rem] text-text-muted mt-3 font-sans font-medium uppercase tracking-wider">JPG, GIF or PNG. Max size of 800K</p>
              </div>
            </div>

            <form className="space-y-8 max-w-md">
              <div className="space-y-3">
                <Label className="text-[0.68rem] font-sans font-medium uppercase tracking-widest text-sage-dim">Full Name</Label>
                <Input 
                  type="text" 
                  defaultValue="Vikram Sharma"
                  className="bg-surface-lo border-none focus:ring-2 focus:ring-sage-pale"
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-[0.68rem] font-sans font-medium uppercase tracking-widest text-sage-dim">Email Address</Label>
                <Input 
                  type="email" 
                  defaultValue="vikram.s@example.com"
                  className="bg-surface-lo border-none focus:ring-2 focus:ring-sage-pale"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[0.68rem] font-sans font-medium uppercase tracking-widest text-sage-dim">Role in Family</Label>
                <select className="w-full px-4 py-3 bg-surface-lo text-text-ink rounded-sm border-none focus:ring-2 focus:ring-sage-pale transition-shadow appearance-none font-sans text-sm">
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Grandparent</option>
                  <option>Guardian</option>
                </select>
              </div>

              <div className="pt-8 border-t border-surface-lo flex justify-between items-center">
                <Button variant="ghost" type="button" className="text-terracotta text-sm font-medium flex items-center gap-2 hover:opacity-80 p-0">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
                <Button variant="primary" type="submit" className="px-8">
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
