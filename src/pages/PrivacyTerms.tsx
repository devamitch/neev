import React from 'react';
import { Navbar, Footer } from './LandingPage';
import { Card } from '@/components/ui/card';

export default function PrivacyTerms() {
  return (
    <div className="min-h-screen bg-surface selection:bg-primary-container selection:text-on-surface">
      <Navbar />
      <main className="py-24 px-6 md:px-20">
        <div className="max-w-3xl mx-auto">
          <span className="label-md text-primary mb-4 block">Legal & Trust</span>
          <h1 className="font-serif text-4xl md:text-5xl text-on-surface mb-12">
            Privacy & <br />
            <em className="italic text-primary">Terms of Service</em>
          </h1>

          <div className="space-y-12">
            <section>
              <h2 className="font-serif text-2xl text-on-surface mb-4">Privacy Commitment</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                Your family's data is sacred. BloomParents is built on the principle of "Privacy by Design." We do not sell your data, we do not use it for advertising, and we encrypt everything at rest and in transit.
              </p>
              <Card className="p-6 bg-surface-container-low border-none shadow-none mb-4">
                <h3 className="font-serif text-lg text-on-surface mb-2">Data We Access</h3>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span> Google Calendar (to sync family schedules)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span> Gmail (to parse school and extracurricular notices)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span> Google Drive (to organize family documents and memories)
                  </li>
                </ul>
              </Card>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-on-surface mb-4">Terms of Service</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                By using BloomParents, you agree to provide accurate information and to use the service responsibly. We reserve the right to suspend accounts that violate our community guidelines or attempt to misuse the AI Guardian.
              </p>
              <p className="text-on-surface-variant leading-relaxed">
                Membership fees are billed monthly or annually. You can cancel at any time, and your data will remain accessible for 30 days following cancellation to allow for export.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-on-surface mb-4">The AI Guardian</h2>
              <p className="text-on-surface-variant leading-relaxed">
                The Guardian is an AI assistant designed to help manage family logistics. While highly capable, it is not a substitute for professional advice (medical, legal, or financial). Always verify critical information.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
