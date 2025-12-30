const Card = ({
  children,
  className = '',
  hover = false,
  padding = true,
  ...props
}) => {
  const baseClasses = 'bg-dark-900 border border-dark-700 rounded-xl';
  const hoverClasses = hover ? 'hover:border-dark-600 hover:shadow-lg transition-all duration-200 cursor-pointer' : '';
  const paddingClasses = padding ? 'p-6' : '';

  return (
    <div 
      className={`${baseClasses} ${hoverClasses} ${paddingClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = '' }) => (
  <div className={`flex items-center justify-between mb-4 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ children, icon: Icon, className = '' }) => (
  <h3 className={`font-semibold text-white flex items-center gap-2 ${className}`}>
    {Icon && <Icon className="text-primary-400" size={18} />}
    {children}
  </h3>
);

const CardContent = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;

export default Card;
