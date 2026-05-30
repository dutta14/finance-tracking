import { FC, useState, useRef, useCallback, useEffect } from 'react'

export interface PassphraseInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  /** When true, apply shake animation and error border */
  shake?: boolean
  /** Called when shake animation ends */
  onShakeEnd?: () => void
  /** aria-describedby for linking to external descriptions */
  ariaDescribedBy?: string
}

const EyeIcon: FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon: FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const PassphraseInput: FC<PassphraseInputProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
  placeholder = 'Enter your passphrase',
  shake = false,
  onShakeEnd,
  ariaDescribedBy,
}) => {
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleToggleVisibility = useCallback(() => {
    setVisible(v => !v)
    // Return focus to the input after toggling
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleAnimationEnd = useCallback(() => {
    onShakeEnd?.()
  }, [onShakeEnd])

  // Auto-focus support
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  const errorId = `${id}-error`
  const hasError = !!error

  return (
    <div className="unlock-field">
      <label className="unlock-label" htmlFor={id}>
        {label}
      </label>
      <div
        className={`unlock-input-wrapper${shake ? ' unlock-input-wrapper--shake' : ''}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          className={`unlock-input${hasError ? ' unlock-input--error' : ''}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={hasError || undefined}
          aria-describedby={[hasError ? errorId : null, ariaDescribedBy].filter(Boolean).join(' ') || undefined}
        />
        <button
          type="button"
          className="unlock-toggle-visibility"
          onClick={handleToggleVisibility}
          disabled={disabled}
          aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <p
        id={errorId}
        className="unlock-error"
        role={hasError ? 'alert' : undefined}
        aria-live={hasError ? 'assertive' : undefined}
      >
        {error || ''}
      </p>
    </div>
  )
}

export default PassphraseInput
