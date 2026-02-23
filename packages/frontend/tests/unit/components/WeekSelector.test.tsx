import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeekSelector from '../../../src/components/admin/WeekSelector.js';
import { getCurrentSeason } from '../../../src/utils/weekCalculation.js';

const currentSeason = getCurrentSeason();

const defaultProps = {
  selectedYear: currentSeason,
  onYearChange: vi.fn(),
  weeks: [],
  selectedWeek: 1,
  onWeekChange: vi.fn(),
  loading: false,
};

describe('WeekSelector', () => {
  it('renders a Select (not a text input) for the year field', () => {
    render(<WeekSelector {...defaultProps} />);
    // Should have combobox roles (MUI Select), not a spinbutton (number input)
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders exactly three season options', async () => {
    const user = userEvent.setup();
    render(<WeekSelector {...defaultProps} />);

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
    render(<WeekSelector {...defaultProps} onYearChange={onYearChange} />);

    const yearCombobox = screen.getAllByRole('combobox')[0];
    await user.click(yearCombobox);
    await user.click(screen.getByRole('option', { name: `${currentSeason - 1} Season` }));

    expect(onYearChange).toHaveBeenCalledWith(currentSeason - 1);
  });
});
