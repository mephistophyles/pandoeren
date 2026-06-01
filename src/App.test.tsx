import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

describe('Hot-seat app', () => {
  it('renders the session ledger, bidding controls, and current hot-seat hand', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /pandoeren hot-seat/i })).toBeInTheDocument();
    expect(screen.getByText(/session ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/current bid/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /player \d hand/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new deal/i })).toBeInTheDocument();
  });

  it('shows selected trump and called card in the global status panel', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /pass/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));

    fireEvent.change(screen.getByLabelText(/trump/i), { target: { value: 'hearts' } });
    const calledCardSelect = screen.getByLabelText(/called card/i) as HTMLSelectElement;
    fireEvent.change(calledCardSelect, { target: { value: calledCardSelect.options[1].value } });

    expect(screen.getByText(/trump: hearts/i)).toBeInTheDocument();
    expect(screen.getByText(/called card: /i)).not.toHaveTextContent(/not chosen/i);
  });

  it('does not show trump selection for zwabber', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^zwabber$/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));

    expect(screen.queryByLabelText(/trump/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/called card/i)).toBeInTheDocument();
  });

  it('does not ask misere players to choose trump or called card', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^misere$/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass/i }));

    expect(screen.queryByLabelText(/trump/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/called card/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start play/i })).toBeEnabled();
  });
});
