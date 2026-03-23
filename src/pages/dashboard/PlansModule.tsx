import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Target, Calendar, ArrowRight, Shield, Heart } from 'lucide-react';
import gsap from 'gsap';

const plans = [
  {
    id: 'education',
    title: 'Education & Growth',
    description: 'Curated learning paths based on Arjun\'s school syllabus and interests.',
    icon: <Target className="w-6 h-6" />,
    color: 'bg-primary-container text-primary',
    tasks: ['Math: Algebra Basics', 'Science: Solar System Project', 'Reading: 30 mins daily']
  },
  {
    id: 'legacy',
    title: 'Heritage & Legacy',
    description: 'Recording ancestral stories and organizing family archives.',
    icon: <Shield className="w-6 h-6" />,
    color: 'bg-secondary-container text-secondary',
    tasks: ['Interview Grandfather', 'Digitize 1980s Photo Album', 'Write Family Recipe Book']
  },
  {
    id: 'wellness',
    title: 'Family Wellness',
    description: 'Coordinating health checkups and mindful family rituals.',
    icon: <Heart className="w-6 h-6" />,
    color: 'bg-tertiary-container text-tertiary',
    tasks: ['Annual Health Checkup', 'Daily Evening Walk', 'Weekend Meditation']
  }
];

export default function PlansModule() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".plan-card", {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'expo.out'
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="space-y-12">
      <header className="space-y-4">
        <span className="label-md text-primary tracking-[0.4em] block uppercase">CURATED PLANS</span>
        <h1 className="font-serif text-4xl md:text-5xl">Your Family <span className="italic text-primary">Blueprints</span></h1>
        <p className="font-sans text-on-surface-variant max-w-2xl font-light">
          Based on your goals and Google ecosystem sync, I've prepared these actionable plans to nurture your family's growth and legacy.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <Card key={plan.id} className="plan-card border-none bg-surface-container-low hover:bg-surface-container-mid transition-all duration-700 rounded-2xl overflow-hidden group">
            <CardContent className="p-10 space-y-8">
              <div className={`w-14 h-14 rounded-2xl ${plan.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-700`}>
                {plan.icon}
              </div>
              <div className="space-y-3">
                <h3 className="font-serif text-2xl group-hover:text-primary transition-colors duration-500">{plan.title}</h3>
                <p className="text-sm font-sans font-light text-on-surface-variant leading-relaxed">
                  {plan.description}
                </p>
              </div>
              
              <div className="space-y-4">
                <span className="label-md text-[0.6rem] tracking-[0.2em] text-primary uppercase">ACTIVE TASKS</span>
                <ul className="space-y-3">
                  {plan.tasks.map((task, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-sans font-light text-on-surface-variant">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div>
                      {task}
                    </li>
                  ))}
                </ul>
              </div>

              <Button variant="ghost" className="w-full justify-between p-0 h-auto text-primary label-md tracking-[0.15em] hover:text-on-surface transition-colors group/btn">
                MANAGE PLAN <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
