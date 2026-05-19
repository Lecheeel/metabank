import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AccessibilityContext = createContext(null);
const STORAGE_KEY = 'metabank_a11y';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { fontScale: 'normal', highContrast: false };
    const v = JSON.parse(raw);
    return {
      fontScale: v.fontScale === 'large' ? 'large' : 'normal',
      highContrast: !!v.highContrast,
    };
  } catch {
    return { fontScale: 'normal', highContrast: false };
  }
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(readStored);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('a11y-large', settings.fontScale === 'large');
    el.classList.toggle('a11y-contrast', !!settings.highContrast);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* ignore quota */ }
  }, [settings]);

  const toggleFontScale = useCallback(() => {
    setSettings(s => ({ ...s, fontScale: s.fontScale === 'large' ? 'normal' : 'large' }));
  }, []);

  const toggleContrast = useCallback(() => {
    setSettings(s => ({ ...s, highContrast: !s.highContrast }));
  }, []);

  return (
    <AccessibilityContext.Provider value={{ ...settings, toggleFontScale, toggleContrast }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used inside AccessibilityProvider');
  return ctx;
}
