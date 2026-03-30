import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LockWarningDialog from '../../../src/components/user/LockWarningDialog.js';

const noop = vi.fn();
beforeEach(() => noop.mockClear());

describe('LockWarningDialog', () => {
  it('renders unsaved count and minutes in dialog text', () => {
    render(
      <LockWarningDialog
        open={true}
        unsavedCount={3}
        minutesUntilLock={8}
        onSubmit={noop}
        onDismiss={noop}
      />
    );
    expect(screen.getByText(/3 unsaved picks/)).toBeInTheDocument();
    expect(screen.getByText(/8 minutes/)).toBeInTheDocument();
  });

  it('uses singular forms when count and minutes are 1', () => {
    render(
      <LockWarningDialog
        open={true}
        unsavedCount={1}
        minutesUntilLock={1}
        onSubmit={noop}
        onDismiss={noop}
      />
    );
    expect(screen.getByText(/1 unsaved pick\./)).toBeInTheDocument();
    expect(screen.getByText(/1 minute\./)).toBeInTheDocument();
  });

  it('calls onSubmit when Submit Now is clicked', async () => {
    const onSubmit = vi.fn();
    render(
      <LockWarningDialog
        open={true}
        unsavedCount={2}
        minutesUntilLock={5}
        onSubmit={onSubmit}
        onDismiss={noop}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /submit now/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when Dismiss is clicked', async () => {
    const onDismiss = vi.fn();
    render(
      <LockWarningDialog
        open={true}
        unsavedCount={2}
        minutesUntilLock={5}
        onSubmit={noop}
        onDismiss={onDismiss}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('is not visible when open is false', () => {
    render(
      <LockWarningDialog
        open={false}
        unsavedCount={2}
        minutesUntilLock={5}
        onSubmit={noop}
        onDismiss={noop}
      />
    );
    expect(screen.queryByText(/unsaved pick/)).not.toBeInTheDocument();
  });
});
