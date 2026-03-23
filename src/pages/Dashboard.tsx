import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Shield, 
  Sparkles, 
  Settings, 
  Bell, 
  Search, 
  Menu, 
  X,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { logOut } from '../firebase';
import gsap from 'gsap';

// Import Modules
import DashboardHome from './dashboard/DashboardHome';
import VaultModule from './dashboard/VaultModule';
import GuardianModule from './dashboard/GuardianModule';
import SettingsModule from './dashboard/SettingsModule';
import CalendarModule from './dashboard/CalendarModule';
import TasksModule from './dashboard/TasksModule';
import ChildrenModule from './dashboard/ChildrenModule';
import PlansModule from './dashboard/PlansModule';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, userRole } = useAuth();
  const sidebarRef = useRef<HTMLElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(sidebarRef.current, {
        x: -100,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out'
      })
      .from(mainContentRef.current, {
        opacity: 0,
        duration: 1,
        ease: 'power2.out'
      }, "-=0.8");
    });

    return () => ctx.revert();
  }, []);

  const handleLogout = async () => {
    try {
      await logOut();
      navigate('/');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const navItems = [
    { path: '/dashboard', label: 'HOME', icon: <LayoutDashboard className="w-6 h-6" /> },
    { path: '/dashboard/plans', label: 'PLANS', icon: <Target className="w-6 h-6" /> },
    { path: '/dashboard/vault', label: 'VAULT', icon: <Shield className="w-6 h-6" /> },
    { path: '/dashboard/guidance', label: 'GUIDANCE', icon: <Sparkles className="w-6 h-6" /> },
    { path: '/dashboard/settings', label: 'SETTINGS', icon: <Settings className="w-6 h-6" /> },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row selection:bg-primary-container selection:text-on-primary-container relative overflow-hidden">
      {/* Decorative Silk Elements */}
      <div className="absolute -top-40 -left-40 w-[800px] h-[800px] bg-primary-container/5 rounded-full blur-[180px] -z-10"></div>
      <div className="absolute -bottom-40 -right-40 w-[800px] h-[800px] bg-secondary-container/5 rounded-full blur-[180px] -z-10"></div>

      {/* Desktop Sidebar */}
      <aside ref={sidebarRef} className="hidden lg:flex flex-col w-80 bg-surface-container-low/40 backdrop-blur-3xl border-r border-outline-variant/10 p-12 fixed h-full z-50">
          <div className="flex items-center gap-3 mb-20">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6 text-on-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-serif italic text-primary tracking-widest leading-none">NEEV</span>
            </div>
          </div>

        <nav className="flex-grow space-y-6">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path}
              className={`flex items-center gap-5 px-6 py-5 rounded-2xl transition-all duration-700 group relative ${
                isActive(item.path) 
                  ? 'bg-primary text-on-primary shadow-2xl shadow-primary/30' 
                  : 'text-on-surface-variant hover:bg-surface-container-mid hover:text-on-surface'
              }`}
            >
              <span className={`transition-transform duration-700 ${isActive(item.path) ? '' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span className="label-md tracking-[0.25em] text-[0.75rem] uppercase">{item.label}</span>
              {isActive(item.path) && (
                <motion.div 
                  layoutId="activeNavIndicator"
                  className="ml-auto w-2 h-2 rounded-full bg-on-primary"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-12 border-t border-outline-variant/10">
          <div className="flex items-center justify-between p-4 bg-surface-container-high/30 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12 rounded-2xl border-2 border-primary/10 shadow-md">
                <AvatarFallback className="bg-primary text-on-primary font-serif">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5 overflow-hidden">
                <p className="font-serif text-lg truncate max-w-[120px]">{user?.displayName || 'User'}</p>
                <p className="label-md text-[0.65rem] text-primary tracking-[0.15em] uppercase">{userRole || 'STEWARD'}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-on-surface-variant hover:text-destructive transition-colors">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main ref={mainContentRef} className="flex-grow lg:ml-80 min-h-screen flex flex-col relative">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-surface/60 backdrop-blur-2xl px-8 md:px-16 py-8 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <button 
              className="lg:hidden p-3 text-on-surface-variant hover:text-primary transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-7 h-7" />
            </button>
            <div className="relative hidden md:block group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors duration-500" />
              <input 
                placeholder="Search lineage..." 
                className="bg-surface-container-low/50 border-none h-14 pl-14 pr-8 rounded-full w-72 focus:w-96 transition-all duration-1000 font-sans text-sm focus:bg-surface-container-mid focus:shadow-xl focus:shadow-primary/5"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 md:gap-10">
            <button className="relative p-3 text-on-surface-variant hover:text-primary transition-all duration-500 hover:scale-110">
              <Bell className="w-7 h-7" />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface shadow-sm"></span>
            </button>
            <div className="h-10 w-[1px] bg-outline-variant/20 hidden md:block"></div>
            <div className="flex items-center gap-5">
              <div className="text-right hidden sm:block">
                <p className="font-serif text-base">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="label-md text-[0.65rem] text-on-surface-variant/60 tracking-[0.15em] uppercase">SUNSET 6:42 PM</p>
              </div>
              <Avatar className="w-12 h-12 rounded-2xl lg:hidden shadow-lg">
                <AvatarFallback className="bg-primary text-on-primary font-serif">
                  {user?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Content Router */}
        <div className="p-8 md:p-16 max-w-[1400px] mx-auto w-full flex-grow">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="vault" element={<VaultModule />} />
            <Route path="guidance" element={<GuardianModule />} />
            <Route path="settings" element={<SettingsModule />} />
            <Route path="calendar" element={<CalendarModule />} />
            <Route path="tasks" element={<TasksModule />} />
            <Route path="children" element={<ChildrenModule />} />
            <Route path="plans" element={<PlansModule />} />
          </Routes>
        </div>

        {/* Mobile Bottom Tab Bar */}
        <nav className="lg:hidden fixed bottom-8 left-8 right-8 z-50">
          <div className="bg-on-surface/95 backdrop-blur-2xl rounded-3xl p-3 flex justify-between items-center shadow-2xl shadow-primary/30">
            {navItems.map((item) => (
              <Link 
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all duration-700 relative ${
                  isActive(item.path) 
                    ? 'bg-primary text-on-primary shadow-xl shadow-primary/20' 
                    : 'text-surface-container-lowest/40 hover:text-surface-container-lowest'
                }`}
              >
                {item.icon}
                <span className="text-[0.6rem] label-md tracking-[0.1em] mt-2 uppercase">{item.label}</span>
                {isActive(item.path) && (
                  <motion.div 
                    layoutId="mobileActiveTab"
                    className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-on-primary"
                  />
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* Persistent Emergency Button */}
        <button className="fixed bottom-36 right-8 lg:bottom-16 lg:right-16 bg-destructive text-on-primary p-6 rounded-full shadow-2xl shadow-destructive/40 hover:scale-110 hover:rotate-12 transition-all duration-700 z-50 flex items-center justify-center group">
          <AlertTriangle className="w-8 h-8" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-4 transition-all duration-700 ease-[0.16,1,0.3,1] font-medium text-sm font-sans uppercase tracking-[0.2em]">
            Emergency
          </span>
        </button>
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-on-surface/40 backdrop-blur-md z-[60] lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-surface z-[70] p-12 lg:hidden flex flex-col shadow-2xl"
            >
              <div className="flex justify-between items-center mb-20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                    <Sparkles className="w-5 h-5 text-on-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-serif italic text-primary tracking-widest leading-none">NEEV</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-3 text-on-surface-variant hover:text-primary transition-colors">
                  <X className="w-7 h-7" />
                </button>
              </div>

              <nav className="flex-grow space-y-6">
                {navItems.map((item) => (
                  <Link 
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-5 px-6 py-5 rounded-2xl transition-all duration-700 ${
                      isActive(item.path) 
                        ? 'bg-primary text-on-primary shadow-2xl shadow-primary/30' 
                        : 'text-on-surface-variant hover:bg-surface-container-mid hover:text-on-surface'
                    }`}
                  >
                    {item.icon}
                    <span className="label-md tracking-[0.25em] text-[0.75rem] uppercase">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="mt-auto pt-12 border-t border-outline-variant/10">
                <div className="flex items-center justify-between p-4 bg-surface-container-high/30 rounded-2xl backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12 rounded-2xl border-2 border-primary/10 shadow-md">
                      <AvatarFallback className="bg-primary text-on-primary font-serif">
                        {user?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="font-serif text-lg truncate max-w-[120px]">{user?.displayName || 'User'}</p>
                      <p className="label-md text-[0.65rem] text-primary tracking-[0.15em] uppercase">{userRole || 'STEWARD'}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="text-on-surface-variant hover:text-destructive transition-colors">
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
