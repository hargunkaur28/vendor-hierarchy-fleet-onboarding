import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';
import { devApiConfig, resetDb } from '@/api/client';
import { DevPanel } from './DevPanel';

describe('Phase 8: DevPanel Controls', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
    devApiConfig.latencyMax = 400;
    devApiConfig.latencyMin = 150;
    devApiConfig.failureRate = 0;
    devApiConfig.forceFailNext = false;
  });

  it('updates API latency when slider changes', () => {
    render(<DevPanel isOpen={true} onClose={() => {}} />);

    const latencySlider = screen.getByLabelText(/mock api latency/i);
    expect(latencySlider).toBeInTheDocument();

    fireEvent.change(latencySlider, { target: { value: '800' } });

    expect(devApiConfig.latencyMax).toBe(800);
    expect(devApiConfig.latencyMin).toBe(320);
    expect(screen.getByText('800 ms')).toBeInTheDocument();
  });

  it('toggles flaky network preset (15% failure rate)', () => {
    render(<DevPanel isOpen={true} onClose={() => {}} />);

    const flakyBtn = screen.getByRole('button', { name: /flaky network preset/i });
    expect(flakyBtn).toBeInTheDocument();

    // Toggle on (15%)
    fireEvent.click(flakyBtn);
    expect(useAppStore.getState().failureRate).toBe(0.15);
    expect(devApiConfig.failureRate).toBe(0.15);

    // Toggle off (0%)
    fireEvent.click(flakyBtn);
    expect(useAppStore.getState().failureRate).toBe(0);
    expect(devApiConfig.failureRate).toBe(0);
  });

  it('shows confirmation dialog before resetting to golden seed', async () => {
    render(<DevPanel isOpen={true} onClose={() => {}} />);

    const resetBtn = screen.getByRole('button', { name: /reset to golden seed/i });
    expect(resetBtn).toBeInTheDocument();

    // Clicking button opens confirmation modal
    fireEvent.click(resetBtn);

    expect(screen.getByText('Reset to Golden Seed?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, reset database/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Clicking cancel closes dialog
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Reset to Golden Seed?')).not.toBeInTheDocument();

    // Open again and confirm
    fireEvent.click(resetBtn);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, reset database/i }));
    });

    expect(screen.queryByText('Reset to Golden Seed?')).not.toBeInTheDocument();
  });
});
