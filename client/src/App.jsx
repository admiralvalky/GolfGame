import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Setup from './pages/Setup.jsx';
import Picks from './pages/Picks.jsx';
import TeamDetail from './pages/TeamDetail.jsx';
import Season from './pages/Season.jsx';
import TeamSeasonStats from './pages/TeamSeasonStats.jsx';

// Wrap each page in its own ErrorBoundary so a crash on one route
// doesn't take down the entire app — other routes remain navigable.
const wrap = (el) => <ErrorBoundary>{el}</ErrorBoundary>;

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={wrap(<Home />)} />
          <Route path="/setup" element={wrap(<Setup />)} />
          <Route path="/picks" element={wrap(<Picks />)} />
          <Route path="/picks/:tournamentId" element={wrap(<Picks />)} />
          <Route path="/scoreboard" element={<Navigate to="/" replace />} />
          <Route path="/team/:teamId" element={wrap(<TeamDetail />)} />
          <Route path="/season" element={wrap(<Season />)} />
          <Route path="/season/team/:teamId" element={wrap(<TeamSeasonStats />)} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
