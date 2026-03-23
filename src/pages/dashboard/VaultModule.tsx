import React, { useState, useEffect, useRef } from 'react';
import { Shield, FileText, Folder, Search, Upload, MoreVertical, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import gsap from 'gsap';

const documents = [
  { id: 1, name: "Ananya's Passport", type: 'pdf', size: '2.4 MB', date: 'Oct 12, 2025', folder: 'Identity' },
  { id: 2, name: 'Rohan Vaccination Record', type: 'image', size: '1.1 MB', date: 'Sep 05, 2025', folder: 'Medical' },
  { id: 3, name: 'School Fee Receipt Q1', type: 'pdf', size: '800 KB', date: 'Aug 20, 2025', folder: 'Education' },
  { id: 4, name: 'House Lease Agreement', type: 'doc', size: '3.2 MB', date: 'Jan 15, 2025', folder: 'Home' },
  { id: 5, name: 'Family Insurance Policy', type: 'pdf', size: '5.5 MB', date: 'Nov 01, 2024', folder: 'Insurance' },
];

const folders = [
  { name: 'Identity', count: 4, icon: Shield },
  { name: 'Medical', count: 12, icon: FileText },
  { name: 'Education', count: 8, icon: Folder },
  { name: 'Home', count: 3, icon: Folder },
];

export default function VaultModule() {
  const [searchQuery, setSearchQuery] = useState('');
  const headerRef = useRef<HTMLDivElement>(null);
  const foldersRef = useRef<HTMLDivElement>(null);
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
      .from(foldersRef.current?.children || [], {
        scale: 0.9,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'back.out(1.7)'
      }, "-=0.4")
      .from(cardRef.current, {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'expo.out'
      }, "-=0.6");
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="max-w-[1160px] mx-auto p-6 md:p-10">
      <div ref={headerRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-text-ink mb-2">Document Vault</h1>
          <p className="text-sm text-text-muted flex items-center gap-2 font-sans font-light">
            <Lock className="w-3 h-3" /> Secure Google Drive-backed storage.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input 
              type="text" 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-surface-hi border-surface-mid focus:border-sage"
            />
          </div>
          <Button variant="primary" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>
      </div>

      <div ref={foldersRef} className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {folders.map(folder => (
          <Card key={folder.name} className="bg-surface-hi p-6 border-none rounded-md hover:bg-surface-lo transition-colors cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-sage-mist flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <folder.icon className="w-6 h-6 text-sage-dim" />
            </div>
            <h3 className="font-serif text-lg text-text-ink mb-1">{folder.name}</h3>
            <p className="text-[0.68rem] text-text-muted font-sans font-medium uppercase tracking-wider">{folder.count} files</p>
          </Card>
        ))}
      </div>

      <div ref={cardRef}>
        <Card className="bg-surface-hi border-none rounded-md overflow-hidden">
        <CardHeader className="px-6 py-5 border-b border-surface-lo">
          <CardTitle className="font-serif text-xl text-text-ink">Recent Documents</CardTitle>
        </CardHeader>
        <div className="divide-y divide-surface-lo">
          {documents.map(doc => (
            <div key={doc.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-surface-lo transition-colors group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-surface-mid flex items-center justify-center">
                  <FileText className="w-5 h-5 text-text-muted" />
                </div>
                <div>
                  <h3 className="text-[1.05rem] font-medium text-text-ink group-hover:text-sage-dim transition-colors font-sans">
                    {doc.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-[0.68rem] text-text-muted font-sans font-medium uppercase tracking-wider">
                    <span>{doc.folder}</span>
                    <span className="text-text-ghost">•</span>
                    <span>{doc.date}</span>
                    <span className="text-text-ghost">•</span>
                    <span>{doc.size}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-text-ghost hover:text-text-ink opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
}
