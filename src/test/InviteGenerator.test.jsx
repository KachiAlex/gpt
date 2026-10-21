import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InviteGenerator from '../components/InviteGenerator';

vi.mock('../services/api', () => ({
  inviteAPI: { create: vi.fn() },
}));
vi.mock('../utils/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import { inviteAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { beforeEach } from 'vitest';

describe('InviteGenerator', () => {
  beforeEach(() => {
    inviteAPI.create.mockReset();
    showError.mockClear();
    showSuccess.mockClear();
  });

  it('generates and displays the invite URL', async () => {
    inviteAPI.create.mockResolvedValueOnce({
      success: true,
      data: { invite: { url: 'https://gptapp.vercel.app/invite/abc123' } },
    });
    render(<InviteGenerator role="ME_OFFICER" />);

    fireEvent.click(screen.getByText('Generate invite link'));

    await waitFor(() =>
      expect(screen.getByText('https://gptapp.vercel.app/invite/abc123')).toBeInTheDocument()
    );
    expect(inviteAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ME_OFFICER' })
    );
    expect(showSuccess).toHaveBeenCalled();
  });

  it('shows an error toast when creation fails', async () => {
    inviteAPI.create.mockResolvedValueOnce({ success: false, message: 'nope' });
    render(<InviteGenerator role="CONTRACTOR" />);

    fireEvent.click(screen.getByText('Generate invite link'));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('nope'));
  });

  it('does not double-submit while a request is in flight', async () => {
    let resolve;
    inviteAPI.create.mockImplementation(() => new Promise((r) => { resolve = r; }));
    render(<InviteGenerator role="CONTRACTOR" />);

    const btn = screen.getByText('Generate invite link');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(inviteAPI.create).toHaveBeenCalledTimes(1);

    resolve({ success: true, data: { invite: { url: 'x' } } });
  });
});
