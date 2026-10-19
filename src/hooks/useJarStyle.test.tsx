// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JAR_STYLE_KEY, useJarStyle } from './useJarStyle';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useJarStyle', () => {
  it('defaults to grid and ignores junk in storage', () => {
    expect(renderHook(() => useJarStyle()).result.current[0]).toBe('grid');
    localStorage.setItem(JAR_STYLE_KEY, 'nope');
    expect(renderHook(() => useJarStyle()).result.current[0]).toBe('grid');
  });

  it('reads the saved style', () => {
    localStorage.setItem(JAR_STYLE_KEY, 'loose');
    expect(renderHook(() => useJarStyle()).result.current[0]).toBe('loose');
  });

  it('saves to localStorage and updates every hook instance in the tab', () => {
    const a = renderHook(() => useJarStyle());
    const b = renderHook(() => useJarStyle());
    act(() => a.result.current[1]('loose'));
    expect(localStorage.getItem(JAR_STYLE_KEY)).toBe('loose');
    expect(a.result.current[0]).toBe('loose');
    expect(b.result.current[0]).toBe('loose');
    act(() => b.result.current[1]('grid'));
    expect(a.result.current[0]).toBe('grid');
  });

  it('follows changes made in another tab', () => {
    const { result } = renderHook(() => useJarStyle());
    act(() => {
      localStorage.setItem(JAR_STYLE_KEY, 'loose');
      window.dispatchEvent(new StorageEvent('storage', { key: JAR_STYLE_KEY, newValue: 'loose' }));
    });
    expect(result.current[0]).toBe('loose');
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current[0]).toBe('grid');
  });

  it('still works for this tab when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useJarStyle());
    act(() => result.current[1]('loose'));
    expect(result.current[0]).toBe('loose');
    vi.restoreAllMocks();
    act(() => result.current[1]('grid'));
    expect(result.current[0]).toBe('grid');
  });
});
