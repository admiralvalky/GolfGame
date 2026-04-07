import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Setup from './pages/Setup.jsx';
import Picks from './pages/Picks.jsx';
import Scoreboard from './pages/Scoreboard.jsx';
import TeamDetail from './pages/TeamDetail.jsx';
import Season from './pages/Season.jsx';
import TeamSeasonStats from './pages/TeamSeasonStats.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/picks" element={<Picks />} />
            <Route path="/picks/:tournamentId" element={<Picks />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/team/:teamId" element={<TeamDetail />} />
            <Route path="/season" element={<Season />} />
            <Route path="/season/team/:teamId" element={<TeamSeasonStats />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
