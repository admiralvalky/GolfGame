import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/scoreboard', label: 'Scoreboard' },
  { to: '/season', label: 'Season' },
  { to: '/setup', label: 'Setup' },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-golf-dark text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight flex items-center gap-2">
            ⛳ Golf Pool
          </Link>
          <nav className="flex gap-1 sm:gap-2">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname === to
                    ? 'bg-golf-light text-white'
                    : 'text-gray-300 hover:text-white hover:bg-golf-green'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
        Golf Pool App · Data via ESPN
      </footer>
    </div>
  );
}
