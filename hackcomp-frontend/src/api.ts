import axios from 'axios';

const SERVER_URL = 'http://localhost:8000';
const API_URL = `${SERVER_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.method === 'get') {
    config.params = { ...config.params, _t: new Date().getTime() };
  }
  return config;
});

// Build a cache-busting absolute URL for a server-relative asset (e.g. /uploads/avatars/x.png)
export const assetUrl = (relativeUrl?: string | null): string | null => {
  if (!relativeUrl) return null;
  const sep = relativeUrl.includes('?') ? '&' : '?';
  return `${SERVER_URL}${relativeUrl}${sep}_=${Date.now()}`;
};

export const api = {
  // Auth
  register: (data: any) => apiClient.post('/auth/register', data),
  login: (data: any) => apiClient.post('/auth/login', data),
  getMe: () => apiClient.get('/auth/me'),

  // Profile
  getProfile: () => apiClient.get('/profile/'),
  createProfile: (data: any) => apiClient.post('/profile/', data),
  updateProfile: (data: any) => apiClient.patch('/profile/', data),
  addSkill: (data: { name: string, level: string }) => apiClient.post('/profile/skills', data),
  getSkills: () => apiClient.get('/profile/skills'),
  deleteSkill: (skillId: string) => apiClient.delete(`/profile/skills/${skillId}`),
  uploadResume: (formData: FormData) => apiClient.post('/profile/resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getVerificationStatus: () => apiClient.get('/profile/verification-status'),

  // Avatar
  uploadAvatar: (formData: FormData) => apiClient.post('/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  removeAvatar: () => apiClient.delete('/profile/avatar'),

  // Skill Assessment
  startSkillAssessment: () => apiClient.post('/assessment/start'),
  submitSkillAssessment: (data: any) => apiClient.post('/assessment/submit', data),
  getSkillResults: () => apiClient.get('/assessment/results'),
  getSkillSessions: () => apiClient.get('/assessment/sessions'),

  // Collaboration Assessment
  startCollabAssessment: () => apiClient.post('/collaboration/start'),
  submitCollabAssessment: (data: any) => apiClient.post('/collaboration/submit', data),
  getCollabResult: () => apiClient.get('/collaboration/result'),
  getCollabStatus: () => apiClient.get('/collaboration/status'),

  // AI-powered team recommendations
  getRecommendations: () => apiClient.get('/collaboration/recommendations'),
  generateRecommendations: () => apiClient.post('/collaboration/recommendations'),

  // Personality Assessment
  startPersonalityAssessment: () => apiClient.get('/personality/start'),
  submitPersonalityAssessment: (data: any) => apiClient.post('/personality/submit', data),
  getPersonalityResult: () => apiClient.get('/personality/result'),
  getPersonalityStatus: () => apiClient.get('/personality/status'),
};
