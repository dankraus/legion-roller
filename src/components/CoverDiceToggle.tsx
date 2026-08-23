import type { DefenseDieColor } from '../types';
import './SurgeToggle.css';
import './CoverDiceToggle.css';

interface CoverDiceToggleProps {
  value: DefenseDieColor;
  onChange: (value: DefenseDieColor) => void;
}

const OPTIONS: { value: DefenseDieColor; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'red', label: 'Red' },
];

export function CoverDiceToggle({ value, onChange }: CoverDiceToggleProps) {
  return (
    <fieldset
      className="surge-toggle cover-dice-toggle"
      title="Dice color for the cover roll. Independent of the main defense pool."
    >
      <legend className="surge-toggle__legend">Cover dice</legend>
      <div className="surge-toggle__options">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`surge-toggle__option ${
              value === option.value ? 'surge-toggle__option--active' : ''
            }`}
          >
            <input
              type="radio"
              name="cover-dice"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="surge-toggle__radio"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
