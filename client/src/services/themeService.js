// Theme service for managing whiteboard canvas & UI appearance
export const THEMES = [
  { id: 'natural', name: 'Natural White', description: 'Crisp Miro-style grid', isDark: false },
  { id: 'dots', name: 'Dot Grid', description: 'Subtle dot matrix', isDark: false },
  { id: 'warm', name: 'Warm Cream', description: 'Paper sketchbook tone', isDark: false },
  { id: 'dark', name: 'Dark Mode', description: 'Deep slate aesthetic', isDark: true },
];

const THEME_KEY = 'whiteboard_theme';

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved;
    }
  } catch (e) {}
  return 'natural'; // Default to Natural (like the photo)
}

export function saveTheme(themeId) {
  try {
    localStorage.setItem(THEME_KEY, themeId);
    applyThemeToDocument(themeId);
  } catch (e) {}
}

export function applyThemeToDocument(themeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
  root.classList.add(`theme-${themeId}`);
  
  const theme = THEMES.find(t => t.id === themeId);
  if (theme?.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
