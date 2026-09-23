import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { resetDb } from '@/api/client';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { VerificationQueue } from './VerificationQueue';
import { DocumentUploader } from './DocumentUploader';
import { DocumentStatusChip } from './DocumentStatusChip';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

describe('Phase 6: Documents & Compliance Verification (F7)', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
    vi.clearAllMocks();
  });

  describe('DocumentStatusChip', () => {
    it('renders correct labels and icons for all document statuses', () => {
      const { rerender } = render(<DocumentStatusChip status="APPROVED" />);
      expect(screen.getByText('Approved')).toBeInTheDocument();

      rerender(<DocumentStatusChip status="PENDING" />);
      expect(screen.getByText('Pending Review')).toBeInTheDocument();

      rerender(<DocumentStatusChip status="EXPIRING_SOON" />);
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();

      rerender(<DocumentStatusChip status="EXPIRED" />);
      expect(screen.getByText('Expired')).toBeInTheDocument();

      rerender(<DocumentStatusChip status="REJECTED" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();

      rerender(<DocumentStatusChip status="MISSING" />);
      expect(screen.getByText('Missing')).toBeInTheDocument();
    });
  });

  describe('DocumentUploader', () => {
    it('validates expiry date before file attachment and blocks past dates', async () => {
      const onUploadSuccess = vi.fn();

      render(
        <DocumentUploader
          docType="RC"
          onUploadSuccess={onUploadSuccess}
        />,
      );

      expect(screen.getByText(/RC Certificate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Expiry Date/i)).toBeInTheDocument();

      // Set past expiry date
      const expiryInput = screen.getByLabelText(/Expiry Date/i);
      await act(async () => {
        fireEvent.change(expiryInput, { target: { value: '2020-01-01' } });
      });

      // Try uploading a mock file
      const file = new File(['mock content'], 'test-rc.pdf', { type: 'application/pdf' });
      const dropzone = screen.getByRole('button', { name: /Upload RC document/i });

      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [file] },
        });
      });

      // Past date error message displayed
      expect(screen.getByText(/Expiry date cannot be in the past/i)).toBeInTheDocument();
      expect(onUploadSuccess).not.toHaveBeenCalled();
    });

    it('rejects unsupported file mime types', async () => {
      const onUploadSuccess = vi.fn();

      render(
        <DocumentUploader
          docType="PERMIT"
          initialExpiry="2027-12-31"
          onUploadSuccess={onUploadSuccess}
        />,
      );

      const invalidFile = new File(['exe content'], 'malicious.exe', { type: 'application/x-msdownload' });
      const dropzone = screen.getByRole('button', { name: /Upload PERMIT document/i });

      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [invalidFile] },
        });
      });

      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      expect(onUploadSuccess).not.toHaveBeenCalled();
    });
  });

  describe('VerificationQueue (F7)', () => {
    it('renders queue of pending documents with approve and reject actions', () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <VerificationQueue />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Document Verification Queue/i)).toBeInTheDocument();

      // Find approve buttons
      const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
      expect(approveButtons.length).toBeGreaterThan(0);
    });

    it('approves a pending document and shows confirmation toast', async () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <VerificationQueue />
        </MemoryRouter>,
      );

      const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
      const firstApprove = approveButtons[0]!;

      await act(async () => {
        fireEvent.click(firstApprove);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/Approved/i),
        );
      });
    });

    it('opens rejection modal and enforces minimum rejection reason length', async () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <VerificationQueue />
        </MemoryRouter>,
      );

      const rejectButtons = screen.getAllByRole('button', { name: /Reject/i });
      const firstReject = rejectButtons[0]!;

      await act(async () => {
        fireEvent.click(firstReject);
      });

      // Modal opens
      expect(screen.getByText(/Reject .* Document/i)).toBeInTheDocument();
      const reasonInput = screen.getByLabelText(/Rejection Reason/i);
      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });

      // Initially disabled
      expect(confirmBtn).toBeDisabled();

      // Type short reason (< 5 chars)
      await act(async () => {
        fireEvent.change(reasonInput, { target: { value: 'bad' } });
      });
      expect(confirmBtn).toBeDisabled();

      // Type valid reason (>= 5 chars)
      await act(async () => {
        fireEvent.change(reasonInput, { target: { value: 'Document photo is blurred and unreadable' } });
      });
      expect(confirmBtn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/Rejected/i),
        );
      });
    });
  });

  describe('DocumentsPage (F7)', () => {
    it('switches between Verification Queue and All Documents tabs', async () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <DocumentsPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Compliance Documents \(F7\)/i)).toBeInTheDocument();

      // Switch to All Documents tab
      const allDocsTab = screen.getByRole('button', { name: /All Fleet Documents/i });
      await act(async () => {
        fireEvent.click(allDocsTab);
      });

      expect(screen.getByRole('table', { name: /Documents Roster/i })).toBeInTheDocument();
    });
  });
});
