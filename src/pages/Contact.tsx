import React from 'react';
import { Navbar, Footer } from './LandingPage';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function Contact() {
  return (
    <div className="min-h-screen bg-surface selection:bg-primary-container selection:text-on-surface">
      <Navbar />
      <main className="py-24 px-6 md:px-20">
        <div className="max-w-3xl mx-auto">
          <span className="label-md text-primary mb-4 block">Get in Touch</span>
          <h1 className="font-serif text-4xl md:text-5xl text-on-surface mb-12">
            Connect with <br />
            <em className="italic text-primary">the sanctuary</em>
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                Whether you have a question about membership, need technical support, or just want to share your family's story, we're here to listen.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="label-md text-[0.6rem] text-outline-variant mb-1">Email</span>
                  <p className="font-serif text-lg text-on-surface">hello@bloomparents.com</p>
                </div>
                <div className="flex flex-col">
                  <span className="label-md text-[0.6rem] text-outline-variant mb-1">Support</span>
                  <p className="font-serif text-lg text-on-surface">help@bloomparents.com</p>
                </div>
              </div>
            </div>

            <Card className="p-8 bg-surface-container-low border-none shadow-none overlap-plane">
              <form className="space-y-6">
                <div>
                  <label className="label-md text-[0.6rem] text-outline-variant mb-2 block">Name</label>
                  <Input 
                    placeholder="Your name" 
                    className="bg-surface border-none placeholder:italic placeholder:font-serif focus:bg-surface-container-lowest transition-colors"
                  />
                </div>
                <div>
                  <label className="label-md text-[0.6rem] text-outline-variant mb-2 block">Email</label>
                  <Input 
                    type="email" 
                    placeholder="Your email address" 
                    className="bg-surface border-none placeholder:italic placeholder:font-serif focus:bg-surface-container-lowest transition-colors"
                  />
                </div>
                <div>
                  <label className="label-md text-[0.6rem] text-outline-variant mb-2 block">Message</label>
                  <Textarea 
                    placeholder="How can we help?" 
                    className="bg-surface border-none placeholder:italic placeholder:font-serif focus:bg-surface-container-lowest transition-colors min-h-[120px]"
                  />
                </div>
                <Button variant="primary" className="w-full transition-colors">
                  Send Message
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
