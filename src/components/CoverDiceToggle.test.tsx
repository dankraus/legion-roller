import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoverDiceToggle } from './CoverDiceToggle';

describe('CoverDiceToggle', () => {
  it('renders White and Red radios with White selected by default', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <CoverDiceToggle value="white" onChange={onChange} />
    );
    const white = getByRole('radio', { name: 'White' });
    const red = getByRole('radio', { name: 'Red' });
    expect(white).toBeChecked();
    expect(red).not.toBeChecked();
    expect(white).toBeEnabled();
    expect(red).toBeEnabled();
    expect(getByRole('group', { name: 'Cover dice' })).toHaveAttribute(
      'title',
      'Dice color for the cover roll. Independent of the main defense pool.'
    );
  });

  it('calls onChange with red when Red is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { getByRole } = render(
      <CoverDiceToggle value="white" onChange={onChange} />
    );
    await user.click(getByRole('radio', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith('red');
  });
});
