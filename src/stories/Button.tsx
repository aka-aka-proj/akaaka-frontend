import './button.css';

export interface ButtonProps {
  /** Is this the principal call to action on the page? */
  primary?: boolean;
  /** Semantic action variant. */
  variant?: 'primary' | 'secondary' | 'danger';
  /** How large should the button be? */
  size?: 'small' | 'medium' | 'large';
  /** Button contents */
  label: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Keep the action unavailable while work is in progress. */
  loading?: boolean;
  /** Disable the action for unavailable or permission-denied states. */
  disabled?: boolean;
}

/** Primary UI component for user interaction */
export const Button = ({
  primary = false,
  variant,
  size = 'medium',
  label,
  loading = false,
  disabled = false,
  ...props
}: ButtonProps) => {
  const mode = `storybook-button--${variant ?? (primary ? 'primary' : 'secondary')}`;
  return (
    <button
      type="button"
      className={['storybook-button', `storybook-button--${size}`, mode].join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? `${label}…` : label}
    </button>
  );
};
