
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmCallback?: () => void;
  confirmText?: string;
  singleActionText?: string; // New prop
}

const ModalComponent: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  confirmCallback, 
  confirmText = "Confirm",
  singleActionText = "Alright" // Initialize with default
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (confirmCallback) {
      confirmCallback();
    }
    onClose(); // Close modal after confirm action by default
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.75)] z-[1010]" onClick={onClose}>
      <div 
        className="bg-[var(--paper-bg)] p-8 rounded-sm shadow-[0_10px_25px_rgba(0,0,0,0.2)] w-[90vw] max-w-2xl text-left border-2 border-[var(--ink-main)] text-[var(--ink-main)] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <h3 className="font-['Rye'] text-3xl text-[var(--ink-main)] text-center">{title}</h3>
        <div className="max-h-[60vh] overflow-y-auto modal-body pr-2">
            {children}
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-2">
            {confirmCallback && (
                 <button 
                    onClick={handleConfirm}
                    className="button modal-action-button" // Uses base .button styles
                 >
                    {confirmText}
                 </button>
            )}
            {!confirmCallback && (
                 <button 
                    onClick={onClose}
                    className="button modal-close-button"
                 >
                    {singleActionText} {/* Use new prop here */}
                 </button>
            )}
            {confirmCallback && (
                <button 
                    onClick={onClose}
                    className={`button modal-close-button bg-[var(--ink-secondary)] text-[var(--paper-bg)] hover:bg-[var(--ink-main)] hover:text-[var(--paper-bg)]`}
                >
                    Cancel
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ModalComponent;
