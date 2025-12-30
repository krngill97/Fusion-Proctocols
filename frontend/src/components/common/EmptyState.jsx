const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  className = ''
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && (
        <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon className="text-dark-500" size={28} />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      )}
      {description && (
        <p className="text-dark-400 text-sm mb-4">{description}</p>
      )}
      {action && actionLabel && (
        <button onClick={action} className="btn btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
