/**
 * Simple theme manager for the basic-host example.
 * Manages light/dark theme state and notifies listeners.
 */

export type Theme = "light" | "dark";

type ThemeListener = (theme: Theme) => void;

const listeners = new Set<ThemeListener>();

// Get initial theme from system preference
let currentTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";

// Apply theme to document
const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
};

// Initial application
applyTheme(currentTheme);

/**
 * Get current theme.
 */
export const getTheme = (): Theme => {
  return currentTheme;
};

/**
 * Set theme and notify all listeners.
 */
export const setTheme = (theme: Theme): void => {
  if (theme === currentTheme) return;
  currentTheme = theme;
  applyTheme(theme);
  listeners.forEach((listener) => listener(theme));
};

/**
 * Toggle between light and dark themes.
 */
export const toggleTheme = (): Theme => {
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
  return newTheme;
};

/**
 * Subscribe to theme changes.
 * Returns unsubscribe function.
 */
export const onThemeChange = (listener: ThemeListener): () => void => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Also listen for system preference changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  setTheme(e.matches ? "dark" : "light");
});
