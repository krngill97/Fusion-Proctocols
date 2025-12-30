const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const Spinner = ({ size = 'md', className = '' }) => {
  return (
    <div 
      className={`
        border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin
        ${sizes[size]} ${className}
      `}
    />
  );
};

export default Spinner;
