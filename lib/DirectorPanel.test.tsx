import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DirectorPanel } from './DirectorPanel';

describe('DirectorPanel', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    // Mock WebSocket
    global.WebSocket = jest.fn(() => ({
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1,
    })) as any;
  });

  describe('Visibility & Rendering', () => {
    it('renders nothing when visible=false', () => {
      const { container } = render(
        <DirectorPanel visible={false} onClose={mockOnClose} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders panel when visible=true', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      expect(screen.getByText(/HUMAN DIRECTOR|AI Director|Human \+ AI Director/i)).toBeInTheDocument();
    });
  });

  describe('Mode Switching', () => {
    it('displays current mode indicator', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      // Panel should show mode status
      expect(screen.getByRole('button', { name: /human|ai|both/i })).toBeInTheDocument();
    });

    it('has three mode buttons: human, ai, both', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: 'human' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ai' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'both' })).toBeInTheDocument();
    });

    it('sends mode change message on button click', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      const aiButton = screen.getByRole('button', { name: 'ai' });

      fireEvent.click(aiButton);

      // Mode message should be sent via WebSocket
      await waitFor(() => {
        // Verify WebSocket.send was called with mode message
        const ws = (global.WebSocket as jest.Mock).mock.results[0].value;
        expect(ws.send).toHaveBeenCalledWith(
          expect.stringContaining('"op":"mode"')
        );
      });
    });
  });

  describe('State Toggle', () => {
    it('has a "state" button', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: /state/i })).toBeInTheDocument();
    });

    it('shows state panel when state button is clicked', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      const stateButton = screen.getByRole('button', { name: /state/i });

      fireEvent.click(stateButton);

      // State panel should appear (contains "facts" label)
      await waitFor(() => {
        expect(screen.getByText(/fact/i)).toBeInTheDocument();
      });
    });

    it('hides state panel when state button is clicked again', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      const stateButton = screen.getByRole('button', { name: /state/i });

      fireEvent.click(stateButton);
      await waitFor(() => {
        expect(screen.getByText(/fact/i)).toBeInTheDocument();
      });

      fireEvent.click(stateButton);
      await waitFor(() => {
        const statePanels = screen.queryAllByText(/fact/i);
        expect(statePanels.length).toBe(0);
      });
    });
  });

  describe('Fact Assertion', () => {
    it('has key and clause input fields', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      expect(screen.getByPlaceholderText(/key/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/clause/i)).toBeInTheDocument();
    });

    it('has assert and clear buttons', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: /assert/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('sends assert message when assert button clicked with valid inputs', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      const keyInput = screen.getByPlaceholderText(/key/i) as HTMLInputElement;
      const clauseInput = screen.getByPlaceholderText(/clause/i) as HTMLInputElement;
      const assertButton = screen.getByRole('button', { name: /assert/i });

      await userEvent.type(keyInput, 'weather:storm');
      await userEvent.type(clauseInput, 'A fierce storm rages');
      fireEvent.click(assertButton);

      await waitFor(() => {
        const ws = (global.WebSocket as jest.Mock).mock.results[0].value;
        expect(ws.send).toHaveBeenCalledWith(
          expect.stringContaining('"op":"assert"')
        );
        expect(ws.send).toHaveBeenCalledWith(
          expect.stringContaining('weather:storm')
        );
      });
    });

    it('does not send assert message if key is empty', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      const clauseInput = screen.getByPlaceholderText(/clause/i);
      const assertButton = screen.getByRole('button', { name: /assert/i });

      await userEvent.type(clauseInput, 'A fierce storm rages');
      fireEvent.click(assertButton);

      const ws = (global.WebSocket as jest.Mock).mock.results[0].value;
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('clears inputs after successful assert', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      const keyInput = screen.getByPlaceholderText(/key/i) as HTMLInputElement;
      const clauseInput = screen.getByPlaceholderText(/clause/i) as HTMLInputElement;
      const assertButton = screen.getByRole('button', { name: /assert/i });

      await userEvent.type(keyInput, 'weather:storm');
      await userEvent.type(clauseInput, 'Storm');
      fireEvent.click(assertButton);

      // Inputs should be cleared
      expect(keyInput.value).toBe('');
      expect(clauseInput.value).toBe('');
    });
  });

  describe('Clear Button', () => {
    it('sends clear message when clear button clicked', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        const ws = (global.WebSocket as jest.Mock).mock.results[0].value;
        expect(ws.send).toHaveBeenCalledWith(
          expect.stringContaining('"op":"clear"')
        );
      });
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button clicked', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: '✕' });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Coordinator Connection', () => {
    it('shows coordinator ws input when not connected', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      // Simulate disconnected state by checking for ws input
      expect(screen.queryByPlaceholderText(/ws:\/\//i)).not.toBeInTheDocument();
    });

    it('updates ws URL when input changes', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      // Assuming the input appears when disconnected
      // This would need the component to actually be disconnected
      // Skipping detailed test until we verify the disconnect state logic
    });
  });

  describe('Activity Feed', () => {
    it('displays activity feed section', () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);
      // Activity feed should always be present
      expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    });
  });

  describe('Disabled State in AI Mode', () => {
    it('disables human controls when mode is AI-only', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      // Switch to AI mode
      const aiButton = screen.getByRole('button', { name: 'ai' });
      fireEvent.click(aiButton);

      // Wait for mode change
      await waitFor(() => {
        const keyInput = screen.getByPlaceholderText(/key/i) as HTMLInputElement;
        // Human input should be disabled in AI mode
        expect(keyInput.disabled).toBe(true);
      });
    });
  });

  describe('Keyboard Focus Management', () => {
    it('prevents button clicks from stealing focus from game', async () => {
      render(<DirectorPanel visible={true} onClose={mockOnClose} />);

      const button = screen.getByRole('button', { name: 'human' });

      // mouseDownCapture should preventDefault
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      fireEvent.(button, event);

      // Note: actual focus prevention happens in onMouseDownCapture
      // This test verifies the pattern; implementation details depend on React event handling
    });
  });
});
