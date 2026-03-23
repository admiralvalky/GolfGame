import BottomNav from './BottomNav.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-pool-base">
      {/* Slim top bar */}
      <header className="fixed top-0 left-0 right-0 bg-pool-elevated border-b border-pool-rim z-40">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center">
          <span className="text-sm font-bold tracking-wide text-pool-primary">⛳ GOLF POOL</span>
        </div>
      </header>

      {/* Scrollable content — padded for fixed header (48px) and fixed bottom nav (~64px) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3 pt-16 pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
