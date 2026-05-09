import { InputHTMLAttributes, forwardRef } from 'react'
import './Input.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="input-wrapper">
        {label && (
          <label className="input-label" htmlFor={props.id}>
            {label}
            {props.required && <span className="input-required">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`input ${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
        {error && <span className="input-error-text">{error}</span>}
        {helperText && !error && (
          <span className="input-helper-text">{helperText}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
