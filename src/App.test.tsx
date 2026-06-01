import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    fireEvent.change(screen.getByLabelText(/called card/i), { target: { value: 'clubs-7' } });

    expect(screen.getByText(/trump: hearts/i)).toBeInTheDocument();
    expect(screen.getByText(/called card: 7♣/i)).toBeInTheDocument();
  });
});
