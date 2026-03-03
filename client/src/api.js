import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── ESPN ─────────────────────────────────────────────────────────────────────
export const getEspnTournaments = () => api.get('/espn/tournaments').then((r) => r.data);
export const getEspnPlayers = (tournamentId) =>
  api.get(`/espn/tournaments/${tournamentId}/players`).then((r) => r.data);
export const getEspnTournamentDetails = (espnId) =>
  api.get(`/espn/tournaments/${espnId}/details`).then((r) => r.data);

// ── Teams ─────────────────────────────────────────────────────────────────────
export const getTeams = () => api.get('/teams').then((r) => r.data);
export const createTeam = (name) => api.post('/teams', { name }).then((r) => r.data);
export const deleteTeam = (id) => api.delete(`/teams/${id}`).then((r) => r.data);

// ── Tournaments ───────────────────────────────────────────────────────────────
export const getTournaments = () => api.get('/tournaments').then((r) => r.data);
export const saveTournament = (data) => api.post('/tournaments', data).then((r) => r.data);
export const updateTournamentStatus = (id, status) =>
  api.patch(`/tournaments/${id}/status`, { status }).then((r) => r.data);

// ── Picks ─────────────────────────────────────────────────────────────────────
export const getPicks = (tournamentId) =>
  api.get(`/picks/${tournamentId}`).then((r) => r.data);
export const savePicks = (data) => api.post('/picks', data).then((r) => r.data);

// ── Scoreboard ────────────────────────────────────────────────────────────────
export const getScoreboard = (tournamentId) =>
  api.get(`/scoreboard/${tournamentId}`).then((r) => r.data);

// ── Season ────────────────────────────────────────────────────────────────────
export const getSeasonStandings = () =>
  api.get('/scoreboard/season/standings').then((r) => r.data);
