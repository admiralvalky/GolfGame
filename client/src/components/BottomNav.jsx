import { Link, useLocation } from 'react-router-dom';

// Line-style icons (inherit currentColor) — cleaner than emoji at small sizes.
function IconScores() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M6 21V10M12 21V4M18 21v-7" strokeLinecap="round" />
    </svg>
  );
}
function IconRecords() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M4 19h16M7 16V9m5 7V5m5 11v-5" strokeLinecap="round" />
    </svg>
  );
}
function IconSetup() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m0-11.4 1.4 1.4m8.2 8.2 1.4 1.4" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { to: '/',       Icon: IconScores,  label: 'Scores'  },
  { to: '/season', Icon: IconRecords, label: 'Records' },
  { to: '/setup',  Icon: IconSetup,   label: 'Setup'   },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-pool-elevated border-t border-pool-rim/60 z-50">
      <div className="max-w-2xl mx-auto flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ to, Icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                active
                  ? 'text-pool-under'
                  : 'text-gray-500 hover:text-pool-muted'
              }`}
            >
              <Icon />
              <span className={`text-[10.5px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
