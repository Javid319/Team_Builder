import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

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
};
