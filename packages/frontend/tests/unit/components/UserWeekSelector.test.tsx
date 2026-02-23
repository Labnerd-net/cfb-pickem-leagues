import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserWeekSelector from '../../../src/components/user/UserWeekSelector.js';
import { getCurrentSeason } from '../../../src/utils/weekCalculation.js';

const currentSeason = getCurrentSeason();

const defaultProps = {
  selectedYear: currentSeason,
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

  it('renders exactly three season options', async () => {
    const user = userEvent.setup();
    render(<UserWeekSelector {...defaultProps} />);

    // Season select is the first combobox in the DOM
    const yearCombobox = screen.getAllByRole('combobox')[0];
    await user.click(yearCombobox);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options.map(o => Number(o.getAttribute('data-value')))).toEqual([
      currentSeason,
      currentSeason - 1,
      currentSeason - 2,
    ]);
  });

  it('calls onYearChange with the correct numeric year when an option is selected', async () => {
    const onYearChange = vi.fn();
    const user = userEvent.setup();
    render(<UserWeekSelector {...defaultProps} onYearChange={onYearChange} />);

    const yearCombobox = screen.getAllByRole('combobox')[0];
    await user.click(yearCombobox);
    await user.click(screen.getByRole('option', { name: `${currentSeason - 2} Season` }));

    expect(onYearChange).toHaveBeenCalledWith(currentSeason - 2);
  });
});
