import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/',       icon: '🏆', label: 'Scores'  },
  { to: '/season', icon: '📊', label: 'Season'  },
  { to: '/picks',  icon: '⛳', label: 'Picks'   },
  { to: '/setup',  icon: '⚙️', label: 'Setup'   },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-pool-elevated border-t border-pool-rim z-50">
      <div className="max-w-2xl mx-auto flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ to, icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active
                  ? 'text-pool-under'
                  : 'text-gray-500 hover:text-pool-muted'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
