import { SelectHTMLAttributes, forwardRef } from 'react'
import './Select.css'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = '', ...props }, ref) => {
    return (
      <div className="select-wrapper">
        {label && (
          <label className="select-label" htmlFor={props.id}>
            {label}
            {props.required && <span className="select-required">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`select ${error ? 'select-error' : ''} ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <span className="select-error-text">{error}</span>}
        {helperText && !error && (
          <span className="select-helper-text">{helperText}</span>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
