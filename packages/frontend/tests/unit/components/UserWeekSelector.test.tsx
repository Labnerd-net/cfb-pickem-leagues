import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserWeekSelector from '../../../src/components/user/UserWeekSelector.js';

const currentYear = new Date().getFullYear();

const defaultProps = {
  selectedYear: currentYear,
  selectedWeek: 1,
  weeks: [],
  onYearChange: vi.fn(),
  onWeekChange: vi.fn(),
  loading: false,
};

describe('UserWeekSelector', () => {
  it('renders a Select (not a text input) for the year field', () => {
    render(<UserWeekSelector {...defaultProps} />);
    // Should have combobox roles (MUI Select), not a spinbutton (number input)
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders exactly three year options', async () => {
    const user = userEvent.setup();
    render(<UserWeekSelector {...defaultProps} />);

    // Year select is the first combobox in the DOM
    const yearCombobox = screen.getAllByRole('combobox')[0];
    await user.click(yearCombobox);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options.map(o => Number(o.textContent))).toEqual([
      currentYear,
      currentYear - 1,
      currentYear - 2,
    ]);
  });

  it('calls onYearChange with the correct numeric year when an option is selected', async () => {
    const onYearChange = vi.fn();
    const user = userEvent.setup();
    render(<UserWeekSelector {...defaultProps} onYearChange={onYearChange} />);

    const yearCombobox = screen.getAllByRole('combobox')[0];
    await user.click(yearCombobox);
    await user.click(screen.getByRole('option', { name: String(currentYear - 2) }));

    expect(onYearChange).toHaveBeenCalledWith(currentYear - 2);
  });
});
