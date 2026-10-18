import { Suspense } from 'react';
import { ContactCards } from './_components/contact-cards';
import { ContactForm } from './_components/contact-form';
import { ContactHero } from './_components/contact-hero';

/**
 * `/contact` — hero → the two-column grid with the secure request
 * form (`#contact-form`) and the direct-channels column. The form reads
 * `?category=` through `useSearchParams`, so it sits inside a Suspense
 * boundary (Next requires one for static rendering). The marketing layout
 * supplies the chrome; the footer's dark `contact` variant is
 * pathname-derived .
 */
export default function ContactPage() {
  return (
    <>
      <ContactHero />
      <section id="contact" className="py-10 md:py-14 bg-paper border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vv-contact-grid">
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
            <ContactCards />
          </div>
        </div>
      </section>
    </>
  );
}
