import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
const ADMIN_TOKEN_KEY = 'golfGameAdminToken';

export function getAdminToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
}

export function setAdminToken(token) {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) window.localStorage.setItem(ADMIN_TOKEN_KEY, trimmed);
  else window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  setAdminToken('');
}

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['x-admin-token'] = token;
  }
  return config;
});

// ── ESPN ─────────────────────────────────────────────────────────────────────
export const getEspnTournaments = () => api.get('/espn', { params: { route: 'tournaments' } }).then((r) => r.data);
export const getEspnSchedule = (year) => api.get('/espn', { params: { route: 'schedule', year } }).then((r) => r.data);
export const getEspnPlayers = (tournamentId) =>
  api.get('/espn', { params: { route: 'players', id: tournamentId } }).then((r) => r.data);
export const getEspnTournamentDetails = (espnId) =>
  api.get('/espn', { params: { route: 'details', id: espnId } }).then((r) => r.data);

// ── Teams ─────────────────────────────────────────────────────────────────────
export const getTeams = () => api.get('/teams').then((r) => r.data);
export const createTeam = (name) => api.post('/teams', { name }).then((r) => r.data);
export const updateTeam = (id, name) => api.patch('/teams', { name }, { params: { id } }).then((r) => r.data);
export const deleteTeam = (id) => api.delete('/teams', { params: { id } }).then((r) => r.data);

// ── Tournaments ───────────────────────────────────────────────────────────────
export const getTournaments = () => api.get('/tournaments').then((r) => r.data);
export const saveTournament = (data) => api.post('/tournaments', data).then((r) => r.data);
export const deleteTournament = (id) => api.delete('/tournaments', { params: { id } }).then((r) => r.data);
export const updateTournamentStatus = (id, status) =>
  api.patch('/tournaments', { status }, { params: { id } }).then((r) => r.data);

// ── Picks ─────────────────────────────────────────────────────────────────────
export const getPicks = (tournamentId) =>
  api.get('/picks', { params: { tournamentId } }).then((r) => r.data);
export const savePicks = (data) => api.post('/picks', data).then((r) => r.data);

// ── Scoreboard ────────────────────────────────────────────────────────────────
export const getScoreboard = (tournamentId) =>
  api.get('/scoreboard', { params: { tournamentId } }).then((r) => r.data);

// ── Season ────────────────────────────────────────────────────────────────────
export const getSeasonStandings = () =>
  api.get('/scoreboard/season/standings').then((r) => r.data);
