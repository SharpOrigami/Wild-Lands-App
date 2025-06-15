
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { MAX_LOG_ENTRIES } from '../constants'; // Import the constant

interface GameLogProps {
  logEntries: LogEntry[];
}

const GameLogComponent: React.FC<GameLogProps> = ({ logEntries }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0; // Scroll to top for new messages
    }
  }, [logEntries]);

  // Filtering logic for the Town Crier
  const filteredForDisplay = logEntries.filter(entry => {
    if (entry.type === 'debug') return false;
    if (entry.type === 'system' || entry.type === 'info') {
      const lowerMessage = entry.message.toLowerCase();
      if (
        lowerMessage.includes('ng+ scaling') ||
        lowerMessage.includes('ai-remixed cards') ||
        lowerMessage.includes('ai card remixing') ||
        lowerMessage.includes('ai boss generation') ||
        lowerMessage.includes('prepared cards for ng+ carry-over') ||
        lowerMessage.includes('character name set to') ||
        lowerMessage.includes('selected.') // For "Character X selected."
      ) {
        return false;
      }
    }
    return true;
  });

  // Display only the most recent MAX_LOG_ENTRIES of the *filtered* entries
  const displayedEntries = filteredForDisplay.slice(0, MAX_LOG_ENTRIES);

  return (
    <div className="my-4">
      <h3 className="text-xl font-western text-center text-[var(--ink-main)] mb-2">Town Crier</h3>
      <div 
        ref={logContainerRef}
        className="log-area max-h-[150px] overflow-y-auto border border-[var(--border-color)] p-3 rounded-sm bg-[#faf8f2] font-['Special_Elite'] text-sm leading-normal text-[#4a4a4a] shadow"
        aria-live="polite" 
        aria-atomic="false"
      >
        {displayedEntries.map((entry, index) => {
          const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          let textColor = '';
          if (entry.type === 'error') textColor = 'text-red-600 font-semibold';
          else if (entry.type === 'action') textColor = 'text-blue-600';
          else if (entry.type === 'system') textColor = 'text-green-700 font-semibold';
          else if (entry.type === 'turn') textColor = 'text-purple-700 font-bold underline';
          else if (entry.type === 'event') textColor = 'text-red-700 font-semibold';
          else if (entry.type === 'gold') textColor = 'text-yellow-600 font-semibold';
          // 'debug' type is already filtered out for display

          return (
            <p key={index} className={textColor}>
              {`[${time}] ${entry.message}`}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default GameLogComponent;