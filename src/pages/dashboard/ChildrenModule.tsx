import React, { useEffect, useRef } from 'react';
import { Heart, Activity, BookOpen, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import gsap from 'gsap';

const children = [
  {
    id: 1,
    name: 'Ananya',
    age: '8 years old',
    grade: 'Grade 3',
    initial: 'A',
    color: 'bg-sage-pale',
    textColor: 'text-sage-dim',
    milestones: [
      { date: 'Today', event: 'PTM at 4pm', type: 'school' },
      { date: 'Next Week', event: 'Piano Recital', type: 'activity' },
    ],
    health: {
      lastCheckup: '2 months ago',
      nextVaccine: 'None due',
      allergies: 'Peanuts'
    }
  },
  {
    id: 2,
    name: 'Rohan',
    age: '4 years old',
    grade: 'Pre-K',
    initial: 'R',
    color: 'bg-sand/30',
    textColor: 'text-sand',
    milestones: [
      { date: 'Tomorrow', event: 'Soccer Practice', type: 'activity' },
      { date: 'Next Month', event: '5th Birthday', type: 'family' },
    ],
    health: {
      lastCheckup: '6 months ago',
      nextVaccine: 'MMR Booster (Due next week)',
      allergies: 'None'
    }
  }
];

export default function ChildrenModule() {
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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
      .from(gridRef.current?.children || [], {
        y: 30,
        opacity: 0,
        stagger: 0.2,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.4");
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="max-w-[1160px] mx-auto p-6 md:p-10">
      <div ref={headerRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-text-ink mb-2">Child Timelines</h1>
          <p className="text-sm text-text-muted font-sans font-light">Track medical, educational, and emotional milestones.</p>
        </div>
        <Button variant="primary" size="sm" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Child
        </Button>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {children.map(child => (
          <Card key={child.id} className="bg-surface-hi border-none rounded-md p-8">
            <div className="flex items-center gap-6 mb-10">
              <Avatar className="w-20 h-20">
                <AvatarFallback className={`${child.color} ${child.textColor} text-3xl font-serif`}>
                  {child.initial}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-serif text-2xl text-text-ink">{child.name}</h2>
                <p className="text-sm text-text-muted font-sans font-light">{child.age} · {child.grade}</p>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="label mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Upcoming
                </h3>
                <div className="space-y-3">
                  {child.milestones.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-sm bg-surface-lo">
                      <span className="text-sm text-text-ink font-medium font-sans">{m.event}</span>
                      <span className="text-xs text-text-muted font-sans font-light">{m.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="label mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Health Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-sm bg-surface-lo">
                    <p className="text-[0.68rem] text-text-muted mb-1 font-sans font-medium uppercase tracking-wider">Last Checkup</p>
                    <p className="text-sm text-text-ink font-medium font-sans">{child.health.lastCheckup}</p>
                  </div>
                  <div className="p-4 rounded-sm bg-surface-lo">
                    <p className="text-[0.68rem] text-text-muted mb-1 font-sans font-medium uppercase tracking-wider">Next Vaccine</p>
                    <p className={`text-sm font-medium font-sans ${child.health.nextVaccine.includes('Due') ? 'text-terracotta' : 'text-text-ink'}`}>
                      {child.health.nextVaccine}
                    </p>
                  </div>
                  <div className="col-span-2 p-4 rounded-sm bg-surface-lo">
                    <p className="text-[0.68rem] text-text-muted mb-1 font-sans font-medium uppercase tracking-wider">Allergies</p>
                    <p className="text-sm text-text-ink font-medium font-sans">{child.health.allergies}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
