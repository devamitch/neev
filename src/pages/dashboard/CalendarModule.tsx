import React, { useState, useEffect, useRef } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import gsap from 'gsap';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const myEventsList = [
  {
    title: 'School Drop-off',
    start: new Date(new Date().setHours(8, 0, 0, 0)),
    end: new Date(new Date().setHours(8, 30, 0, 0)),
    type: 'routine',
  },
  {
    title: "Ananya's PTM",
    start: new Date(new Date().setHours(16, 0, 0, 0)),
    end: new Date(new Date().setHours(17, 0, 0, 0)),
    type: 'school',
  },
  {
    title: 'Family Dinner',
    start: new Date(new Date().setHours(19, 30, 0, 0)),
    end: new Date(new Date().setHours(20, 30, 0, 0)),
    type: 'family',
  },
];

export default function CalendarModule() {
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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
      .from(cardRef.current, {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.4");
    });

    return () => ctx.revert();
  }, []);

  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#F5F4E8'; // surface-lo
    let color = '#3D3F38'; // text-body
    let borderLeft = '3px solid transparent';

    if (event.type === 'school') {
      borderLeft = '3px solid #8FA38F'; // sage
    } else if (event.type === 'family') {
      borderLeft = '3px solid #C4A882'; // sand
    } else if (event.type === 'routine') {
      backgroundColor = '#EFEEE0'; // surface-mid
    }

    return {
      style: {
        backgroundColor,
        color,
        border: 'none',
        borderLeft,
        borderRadius: '4px',
        opacity: 0.9,
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 6px',
      }
    };
  };

  return (
    <div className="max-w-[1160px] mx-auto p-6 md:p-10">
      <div ref={headerRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-text-ink mb-2">Family Calendar</h1>
          <p className="text-sm text-text-muted font-sans font-light">Unified view of everyone's rhythm.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="ghost" size="sm" className="flex items-center gap-2 bg-surface-hi text-text-ink border border-surface-mid hover:bg-surface-lo">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="primary" size="sm" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Event
          </Button>
        </div>
      </div>

      <div ref={cardRef}>
        <Card className="bg-surface-hi border-none rounded-md p-6 h-[600px]">
        <style>{`
          .rbc-calendar { font-family: 'Manrope', sans-serif; }
          .rbc-header { padding: 10px 0; font-weight: 500; color: #7A7C72; border-bottom: 1px solid #EFEEE0; }
          .rbc-today { background-color: #FBFAEE; }
          .rbc-time-view { border: none; }
          .rbc-time-header { border-bottom: 1px solid #EFEEE0; }
          .rbc-time-content { border-top: none; }
          .rbc-timeslot-group { border-bottom: 1px solid #F5F4E8; }
          .rbc-day-slot .rbc-time-slot { border-top: 1px solid #F5F4E8; }
          .rbc-event { padding: 0; }
          .rbc-toolbar button { color: #3D3F38; border: 1px solid #EFEEE0; border-radius: 4px; padding: 6px 12px; margin-right: 8px; font-family: 'Manrope', sans-serif; font-size: 0.875rem; transition: all 0.2s ease; }
          .rbc-toolbar button:hover { background-color: #F5F4E8; }
          .rbc-toolbar button.rbc-active { background-color: #8FA38F; color: white; border-color: #8FA38F; box-shadow: none; }
          .rbc-toolbar button:active { box-shadow: none; }
          .rbc-toolbar button:focus { outline: none; }
        `}</style>
        <BigCalendar
          localizer={localizer}
          events={myEventsList}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          view={view as any}
          onView={(newView) => setView(newView)}
          date={date}
          onNavigate={(newDate) => setDate(newDate)}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day']}
        />
      </Card>
      </div>
    </div>
  );
}
