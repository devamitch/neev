import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import gsap from 'gsap';

const initialMessages = [
  {
    id: 1,
    sender: 'guardian',
    text: "Good evening, Vikram. I've reviewed the family schedule for tomorrow. Ananya has a piano recital at 5 PM. I noticed you have a meeting scheduled until 5:30 PM. Would you like me to suggest a reschedule for your meeting or notify Priya to attend the recital?",
    time: '8:00 PM',
  },
  {
    id: 2,
    sender: 'user',
    text: "Oh, I forgot about the recital. Please notify Priya and ask if she can make it. If not, I'll reschedule my meeting.",
    time: '8:05 PM',
  },
  {
    id: 3,
    sender: 'guardian',
    text: "I've sent a message to Priya. She confirmed she can attend the recital. Your meeting remains unchanged. I've also added a reminder for you to ask Ananya about the recital during dinner.",
    time: '8:10 PM',
  }
];

export default function GuardianModule() {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

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
      .from(chatRef.current, {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.4");
    });

    return () => ctx.revert();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: inputValue,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Simulate Guardian response
    setTimeout(() => {
      const guardianResponse = {
        id: messages.length + 2,
        sender: 'guardian',
        text: "I've noted that. Is there anything else you need assistance with tonight?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, guardianResponse]);
    }, 1500);
  };

  return (
    <div className="max-w-[1160px] mx-auto p-6 md:p-10 h-[calc(100vh-72px)] flex flex-col">
      <div ref={headerRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-text-ink mb-2">AI Guardian</h1>
          <p className="text-sm text-text-muted font-sans font-light">Your family's elder, always present, never intrusive.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-sage-mist text-sage-dim rounded-full text-[0.68rem] font-medium uppercase tracking-wider font-sans">
          <Sparkles className="w-4 h-4" />
          Active
        </div>
      </div>

      <div ref={chatRef} className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 bg-surface-hi border-none rounded-md overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <Avatar className={`w-10 h-10 flex-shrink-0 ${
                  msg.sender === 'guardian' ? 'bg-sage-pale text-sage-dim' : 'bg-surface-mid text-text-ink'
                }`}>
                  <AvatarFallback className="bg-transparent">
                    {msg.sender === 'guardian' ? <Sparkles className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[80%] md:max-w-[70%] ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`p-5 rounded-md ${
                    msg.sender === 'guardian' 
                      ? 'bg-surface-lo text-text-ink rounded-tl-none' 
                      : 'bg-sage text-surface-hi rounded-tr-none'
                  }`}>
                    <p className={`text-[0.95rem] leading-relaxed ${msg.sender === 'guardian' ? 'font-serif' : 'font-sans font-light'}`}>
                      {msg.text}
                    </p>
                  </div>
                  <span className="text-[0.68rem] text-text-ghost mt-3 px-1 font-sans font-medium uppercase tracking-wider">{msg.time}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 bg-surface-lo border-t border-surface-mid">
            <form onSubmit={handleSend} className="relative flex items-center gap-3">
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask the Guardian..."
                className="flex-1 bg-surface-hi text-text-ink placeholder:text-text-ghost placeholder:italic placeholder:font-serif px-6 py-6 rounded-sm border-none focus-visible:ring-sage-pale"
              />
              <Button 
                type="submit"
                disabled={!inputValue.trim()}
                variant="primary"
                size="icon"
                className="w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
