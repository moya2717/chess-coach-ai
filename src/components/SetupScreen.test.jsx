import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SetupScreen from './SetupScreen';

describe('SetupScreen', () => {
  it('disables submit until at least one username is provided', () => {
    render(<SetupScreen onSubmit={vi.fn()} error="" />);

    const submitButton = screen.getByRole('button', { name: /analyze my games/i });
    expect(submitButton.disabled).toBe(true);
  });

  it('submits trimmed usernames', () => {
    const onSubmit = vi.fn();
    render(<SetupScreen onSubmit={onSubmit} error="" />);

    fireEvent.change(screen.getByLabelText(/chess\.com username/i), {
      target: { value: '  CoachPlayer  ' },
    });

    const submitButton = screen.getByRole('button', { name: /analyze my games/i });
    expect(submitButton.disabled).toBe(false);

    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith('CoachPlayer', '');
  });
});
