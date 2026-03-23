import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Clock, Plus, Filter, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import gsap from 'gsap';

const tasks = [
  { id: 1, title: 'Pay school fees', due: 'Friday', assignee: 'Vikram', status: 'pending', priority: 'high' },
  { id: 2, title: 'Review PTM notes', due: 'Today', assignee: 'Priya', status: 'pending', priority: 'medium' },
  { id: 3, title: 'Order groceries', due: 'Yesterday', assignee: 'Vikram', status: 'completed', priority: 'low' },
  { id: 4, title: 'Schedule dentist appointment', due: 'Next Week', assignee: 'Priya', status: 'pending', priority: 'medium' },
  { id: 5, title: 'Buy birthday gift for Rohan', due: 'Tomorrow', assignee: 'Vikram', status: 'pending', priority: 'high' },
];

export default function TasksModule() {
  const [filter, setFilter] = useState('all');
  const headerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'high') return task.priority === 'high';
    if (filter === 'medium') return task.priority === 'medium';
    if (filter === 'low') return task.priority === 'low';
    return true;
  });

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
      .from(filterRef.current?.children || [], {
        x: 20,
        opacity: 0,
        stagger: 0.05,
        duration: 0.6,
        ease: 'power2.out'
      }, "-=0.4")
      .from(cardRef.current, {
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
      <div ref={headerRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-text-ink mb-2">Task Engine</h1>
          <p className="text-sm text-text-muted font-sans font-light">Role-based assignment with quiet confirmations.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="ghost" size="sm" className="flex items-center gap-2 bg-surface-hi text-text-ink border border-surface-mid hover:bg-surface-lo">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="primary" size="sm" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      <div ref={filterRef} className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {['all', 'pending', 'completed', 'high', 'medium', 'low'].map(f => (
          <Button 
            key={f}
            onClick={() => setFilter(f)}
            variant={filter === f ? "primary" : "ghost"}
            size="sm"
            className={`rounded-full px-6 whitespace-nowrap transition-colors ${
              filter !== f ? 'bg-surface-hi text-text-muted hover:text-text-ink' : ''
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div ref={cardRef}>
        <Card className="bg-surface-hi border-none rounded-md overflow-hidden">
        <div className="divide-y divide-surface-lo">
          {filteredTasks.map(task => (
            <div key={task.id} className="p-6 flex items-center justify-between hover:bg-surface-lo transition-colors group">
              <div className="flex items-start gap-4">
                <input 
                  type="checkbox" 
                  className="mt-1 w-5 h-5 accent-sage rounded-sm border-sage-dim cursor-pointer"
                  defaultChecked={task.status === 'completed'}
                />
                <div>
                  <h3 className={`text-[1.05rem] font-medium transition-colors font-sans ${
                    task.status === 'completed' ? 'text-text-ghost line-through' : 'text-text-ink group-hover:text-sage-dim'
                  }`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-3">
                    <span className={`text-[0.68rem] flex items-center gap-1 font-sans font-medium uppercase tracking-wider ${
                      task.priority === 'high' ? 'text-terracotta' : 'text-text-muted'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {task.due}
                    </span>
                    <span className="text-[0.68rem] text-text-muted flex items-center gap-1 font-sans font-medium uppercase tracking-wider">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="bg-sage-pale text-[0.6rem] text-sage-dim font-serif">
                          {task.assignee.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {task.assignee}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-text-ghost hover:text-text-ink opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
}
