// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BottomSheet from './BottomSheet.tsx';

afterEach(cleanup);

function setup(onClose = vi.fn()) {
  render(
    <>
      <button>outside</button>
      <BottomSheet titleId="t" onClose={onClose}>
        <h2 id="t">Title</h2>
        <button>first</button>
        <button>last</button>
      </BottomSheet>
    </>,
  );
  return onClose;
}

describe('BottomSheet', () => {
  it('is a modal dialog named by its title and takes focus', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Title' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
  });

  it('keeps Tab and Shift+Tab inside the sheet', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    const first = screen.getByText('first');
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and on a backdrop tap, but not on a tap inside', () => {
    const onClose = setup();
    fireEvent.click(screen.getByText('first'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('.sheet-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('restores focus to the opener on unmount', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <BottomSheet titleId="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
      </BottomSheet>,
    );
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('restores focus to an SVG opener', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    svg.appendChild(g);
    document.body.appendChild(svg);
    g.focus();
    expect(document.activeElement).toBe(g);
    const { unmount } = render(
      <BottomSheet titleId="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
      </BottomSheet>,
    );
    expect(document.activeElement).not.toBe(g);
    unmount();
    expect(document.activeElement).toBe(g);
    svg.remove();
  });
});
