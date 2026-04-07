import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── ESPN ─────────────────────────────────────────────────────────────────────
export const getEspnTournaments = () => api.get('/espn?route=tournaments').then((r) => r.data);
export const getEspnSchedule = (year) => api.get(`/espn?route=schedule&year=${year}`).then((r) => r.data);
export const getEspnPlayers = (tournamentId) =>
  api.get(`/espn?route=players&id=${tournamentId}`).then((r) => r.data);
export const getEspnTournamentDetails = (espnId) =>
  api.get(`/espn?route=details&id=${espnId}`).then((r) => r.data);

// ── Teams ─────────────────────────────────────────────────────────────────────
export const getTeams = () => api.get('/teams').then((r) => r.data);
export const createTeam = (name) => api.post('/teams', { name }).then((r) => r.data);
export const updateTeam = (id, name) => api.patch(`/teams?id=${id}`, { name }).then((r) => r.data);
export const deleteTeam = (id) => api.delete(`/teams?id=${id}`).then((r) => r.data);

// ── Tournaments ───────────────────────────────────────────────────────────────
export const getTournaments = () => api.get('/tournaments').then((r) => r.data);
export const saveTournament = (data) => api.post('/tournaments', data).then((r) => r.data);
export const deleteTournament = (id) => api.delete(`/tournaments?id=${id}`).then((r) => r.data);
export const updateTournamentStatus = (id, status) =>
  api.patch(`/tournaments?id=${id}`, { status }).then((r) => r.data);

// ── Picks ─────────────────────────────────────────────────────────────────────
export const getPicks = (tournamentId) =>
  api.get(`/picks?tournamentId=${tournamentId}`).then((r) => r.data);
export const savePicks = (data) => api.post('/picks', data).then((r) => r.data);

// ── Scoreboard ────────────────────────────────────────────────────────────────
export const getScoreboard = (tournamentId) =>
  api.get(`/scoreboard?tournamentId=${tournamentId}`).then((r) => r.data);

// ── Season ────────────────────────────────────────────────────────────────────
export const getSeasonStandings = () =>
  api.get('/scoreboard/season/standings').then((r) => r.data);
