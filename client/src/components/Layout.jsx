import { Link } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-pool-base">
      {/* Slim top bar */}
      <header className="fixed top-0 left-0 right-0 bg-pool-elevated border-b border-pool-rim/60 z-40">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between" style={{ height: '52px' }}>
          <Link to="/" className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-pool-primary">
            <span className="grid place-items-center w-6 h-6 rounded-lg text-[13px] text-[#1a1403] bg-gradient-to-br from-pool-gold to-[#b8912a]">⛳</span>
            GOLF POOL
          </Link>
          <span className="text-[11px] font-mono text-pool-muted border border-pool-rim/60 rounded-full px-2.5 py-1">
            {new Date().getFullYear()}
          </span>
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
