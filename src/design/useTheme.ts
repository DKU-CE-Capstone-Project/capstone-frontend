import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'econmind.theme';

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // 프라이빗 모드 등에서 접근이 막힐 수 있다 — 기본값으로 진행
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * `<html data-theme>`를 직접 제어한다.
 * 'system'일 때는 속성을 제거해 tokens.css의 prefers-color-scheme 블록이 동작하게 둔다.
 */
function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    applyMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 저장 실패는 무시 — 이번 세션 동안은 정상 동작한다
    }
  }, [mode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  /** 현재 보이는 테마의 반대로 고정 전환한다. */
  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark]);

  return { mode, setMode, isDark, toggle };
}
