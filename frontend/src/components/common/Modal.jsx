import { X } from 'lucide-react';
import { useEffect } from 'react';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  icon: Icon,
  children,
  size = 'md' // sm, md, lg, xl
}) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl z-50 w-full ${sizeClasses[size]} max-h-[90vh] overflow-auto slide-in-up`}>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-dark-700">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                  <Icon className="text-primary-400" size={20} />
                </div>
              )}
              <h2 className="text-xl font-semibold text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-dark-800"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={title ? '' : 'pt-6'}>
          {children}
        </div>
      </div>
    </>
  );
};

export default Modal;
