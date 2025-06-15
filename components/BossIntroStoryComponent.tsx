
import React, { useState, useEffect } from 'react';

interface BossIntroStoryProps {
  isLoading: boolean;
  title?: string;
  paragraph?: string;
  onContinue: () => void;
}

const BossIntroStoryComponent: React.FC<BossIntroStoryProps> = ({
  isLoading,
  title,
  paragraph,
  onContinue,
}) => {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!isLoading && title && paragraph) {
      // Delay showing text to allow black screen to establish
      const timer = setTimeout(() => {
        setShowText(true);
      }, 500); // 0.5s delay before fade-in
      return () => clearTimeout(timer);
    } else {
      setShowText(false);
    }
  }, [isLoading, title, paragraph]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-[1000]">
      {isLoading && (
        <div className="font-western text-2xl text-white animate-pulse text-center px-4">
          Loading...
        </div>
      )}
      {!isLoading && title && paragraph && (
        <div 
          className={`transition-opacity duration-1000 ease-in-out ${showText ? 'opacity-100' : 'opacity-0'} 
                      bg-[var(--paper-bg)] p-6 sm:p-8 rounded-sm shadow-[0_10px_25px_rgba(255,255,255,0.1)] 
                      w-[90vw] max-w-2xl text-left border-2 border-[var(--ink-main)] text-[var(--ink-main)] 
                      flex flex-col gap-4 max-h-[85vh] sm:max-h-[80vh]`}
        >
          <h3 className="font-['Rye'] text-3xl text-[var(--ink-main)] text-center">
            {title}
          </h3>
          <div className="overflow-y-auto modal-body pr-2 max-h-[65vh] sm:max-h-[60vh]">
            <p className="whitespace-pre-wrap font-['Merriweather'] text-base leading-normal">
              {paragraph}
            </p>
          </div>
          <div className="flex justify-center mt-4">
            <button
              onClick={onContinue}
              className="button text-lg px-6 py-3"
              disabled={isLoading} // Disable button while loading
            >
              Ride Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BossIntroStoryComponent;