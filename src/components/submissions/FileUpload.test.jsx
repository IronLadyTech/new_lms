// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from './FileUpload';

/**
 * Documents had no size ceiling at all — only video did — so nothing stopped a
 * half-gigabyte "resume" being uploaded and paid for every month it sat there.
 *
 * The Storage rules enforce the same 15MB independently. This is the half that
 * tells the learner why, before they wait through an upload that would be
 * refused at the end of it.
 */

const uploadFile = vi.fn();

vi.mock('./submissionProgramConfig', () => ({
  getSubmissionProgramConfig: () => ({ storageEnabled: true, uploadFile }),
}));
vi.mock('../../utils/submissionBlobStore', () => ({
  saveSubmissionBlob: vi.fn().mockResolvedValue(undefined),
  submissionBlobKey: () => 'k',
}));
vi.mock('./TaskTemplateDownloads', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  uploadFile.mockReset();
});

const TASK = { id: 'lep-via-survey', accept: '.pdf,.doc,.docx', uploadSubmitLabel: 'Submit VIA report' };

const fileOf = (mb, name = 'report.pdf') => {
  const f = new File(['x'], name, { type: 'application/pdf' });
  // Size is read-only on File; define it rather than allocate megabytes.
  Object.defineProperty(f, 'size', { value: Math.round(mb * 1024 * 1024) });
  return f;
};

const setup = () =>
  render(
    <FileUpload task={TASK} submission={null} canSubmit userId="u1" onSubmit={vi.fn()} program="lep" />
  );

describe('FileUpload size limit', () => {
  it('states the limit before a file is chosen', () => {
    setup();
    expect(screen.getByText(/up to 15\.0 MB/i)).toBeTruthy();
  });

  it('refuses a file over the limit and says how big it is', async () => {
    setup();
    await userEvent.upload(document.querySelector('input[type=file]'), fileOf(20));
    await waitFor(() => expect(screen.getByText(/20\.0 MB/)).toBeTruthy());
    expect(screen.getByText(/limit is 15\.0 MB/i)).toBeTruthy();
  });

  it('never starts an upload for an oversized file', async () => {
    setup();
    await userEvent.upload(document.querySelector('input[type=file]'), fileOf(20));
    await waitFor(() => expect(screen.getByText(/limit is 15\.0 MB/i)).toBeTruthy());
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('accepts a file inside the limit', async () => {
    setup();
    await userEvent.upload(document.querySelector('input[type=file]'), fileOf(2));
    await waitFor(() => expect(screen.queryByText(/limit is/i)).toBeNull());
  });

  it('accepts a file just under the ceiling', async () => {
    setup();
    await userEvent.upload(document.querySelector('input[type=file]'), fileOf(14.9));
    await waitFor(() => expect(screen.queryByText(/limit is/i)).toBeNull());
  });

  it('clears a stale error when a smaller file is chosen next', async () => {
    setup();
    const input = document.querySelector('input[type=file]');
    await userEvent.upload(input, fileOf(20));
    await waitFor(() => expect(screen.getByText(/limit is 15\.0 MB/i)).toBeTruthy());
    await userEvent.upload(input, fileOf(1));
    await waitFor(() => expect(screen.queryByText(/limit is/i)).toBeNull());
  });
});
