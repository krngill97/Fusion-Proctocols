import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  className = '',
  icon: Icon,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-dark-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" 
            size={18} 
          />
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-2 bg-dark-800 border rounded-lg text-white 
            placeholder-dark-400 focus:outline-none focus:ring-2 
            transition-all duration-200
            ${Icon ? 'pl-10' : ''}
            ${error 
              ? 'border-error focus:ring-error' 
              : 'border-dark-600 focus:ring-primary-500 focus:border-transparent'
            }
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
