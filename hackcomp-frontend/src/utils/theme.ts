export type Theme = 'dark' | 'light';

const THEME_KEY = 'hackcomp_theme';

export const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage unavailable — fall back to dark
  }
  return 'dark';
};

export const applyTheme = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable — theme still applies for this session
  }
  document.documentElement.dataset.theme = theme;
};
