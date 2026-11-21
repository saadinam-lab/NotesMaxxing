import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ThemeComfortSettings, WorkspaceTheme } from '../types';

const STORAGE_KEY = 'notesmaxxing:theme-comfort';

const DEFAULT_SETTINGS: ThemeComfortSettings = {
  theme: 'dark',
  dimImagesInDark: false,
  warmSepiaTint: false,
};

function readInitialSettings(): ThemeComfortSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ThemeComfortSettings>;
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      dimImagesInDark: Boolean(parsed.dimImagesInDark),
      warmSepiaTint: Boolean(parsed.warmSepiaTint),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applyThemeToDom(theme: WorkspaceTheme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#0C0C0E' : '#F9F8F6');
  }
}

function resolveRippleOrigin(origin?: { x: number; y: number }): { x: number; y: number } {
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    return origin;
  }
  const btn = document.querySelector('[data-theme-toggle]') as HTMLElement | null;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }
  return {
    x: window.innerWidth / 2,
    y: 28,
  };
}

export function useThemeComfort() {
  const [settings, setSettings] = useState<ThemeComfortSettings>(readInitialSettings);

  useEffect(() => {
    applyThemeToDom(settings.theme);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  const toggleTheme = useCallback((origin?: { x: number; y: number }) => {
    const nextTheme: WorkspaceTheme = settings.theme === 'dark' ? 'light' : 'dark';

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };

    if (typeof docWithTransition.startViewTransition !== 'function' || prefersReducedMotion) {
      applyThemeToDom(nextTheme);
      setSettings((prev) => ({ ...prev, theme: nextTheme }));
      return;
    }

    const { x, y } = resolveRippleOrigin(origin);
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = docWithTransition.startViewTransition(() => {
      applyThemeToDom(nextTheme);
      flushSync(() => {
        setSettings((prev) => ({ ...prev, theme: nextTheme }));
      });
    });

    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
  }, [settings.theme]);

  const toggleDimImages = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      dimImagesInDark: !prev.dimImagesInDark,
    }));
  }, []);

  const toggleWarmSepia = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      warmSepiaTint: !prev.warmSepiaTint,
    }));
  }, []);

  return {
    settings,
    toggleTheme,
    toggleDimImages,
    toggleWarmSepia,
  };
}
