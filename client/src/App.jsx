import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Setup from './pages/Setup.jsx';
import Picks from './pages/Picks.jsx';
import Scoreboard from './pages/Scoreboard.jsx';
import TeamDetail from './pages/TeamDetail.jsx';
import Season from './pages/Season.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/picks/:tournamentId" element={<Picks />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/team/:teamId" element={<TeamDetail />} />
          <Route path="/season" element={<Season />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
