const Badge = ({ children, variant = 'default', size = 'sm', dot = false, className = '' }) => {
  const variants = {
    default: 'bg-dark-700 text-dark-300',
    primary: 'bg-primary-500/20 text-primary-400',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-error/20 text-error',
    info: 'bg-info/20 text-info',
    purple: 'bg-accent-purple/20 text-accent-purple',
    cyan: 'bg-accent-cyan/20 text-accent-cyan',
    orange: 'bg-accent-orange/20 text-accent-orange',
  };

  const sizes = {
    xs: 'px-1 py-0.5 text-2xs',
    sm: 'px-1.5 py-0.5 text-2xs',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded ${variants[variant]} ${sizes[size]} ${className}`}>
      {dot && (
        <span className={`w-1 h-1 rounded-full ${
          variant === 'success' ? 'bg-success' :
          variant === 'error' ? 'bg-error' :
          variant === 'warning' ? 'bg-warning' :
          variant === 'info' ? 'bg-info' :
          variant === 'primary' ? 'bg-primary-400' :
          variant === 'purple' ? 'bg-accent-purple' :
          'bg-dark-400'
        }`}></span>
      )}
      {children}
    </span>
  );
};

export { Badge };
export default Badge;
