import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center selection:bg-primary-container selection:text-on-surface">
      <span className="label-md text-primary mb-4 block">404 Error</span>
      <h1 className="font-serif text-5xl md:text-7xl text-on-surface mb-6">
        Page not <em className="italic text-primary">found</em>
      </h1>
      <p className="font-sans font-light text-on-surface-variant text-lg max-w-md mb-10">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link 
        to="/" 
        className="bg-primary text-on-primary px-8 py-3 rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
