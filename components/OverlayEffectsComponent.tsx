
import React, { useState, useEffect } from 'react';
import CardComponent from './CardComponent';
import { CardContext, CardData, ActiveGameBannerState } from '../types';


interface OverlayEffectsProps {
    activeLaudanum?: boolean;
    showLightningStrikeFlash?: boolean;
    endGameStatus?: 'victory' | 'defeat'; 
    winReason?: string; 
    scoutedCard?: CardData;
    clearScoutedCardPreview: () => void;
    showEndTurnFade?: boolean; 
    activeGameBanner: ActiveGameBannerState | null;
    isStoryModalOpen?: boolean; // New prop
}

const OverlayEffectsComponent: React.FC<OverlayEffectsProps> = ({ 
    activeLaudanum, 
    showLightningStrikeFlash,
    endGameStatus: endGameStatusProp, 
    winReason: winReasonProp, 
    scoutedCard,
    clearScoutedCardPreview,
    showEndTurnFade,
    activeGameBanner,
    isStoryModalOpen = false // Default to false
}) => {
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  const [showEndGameBannerText, setShowEndGameBannerText] = useState(false); // Renamed for clarity
  const [showEndGameOverlay, setShowEndGameOverlay] = useState(false);
  const [showScoutedCardPreview, setShowScoutedCardPreview] = useState(false);

  const [finalOutcome, setFinalOutcome] = useState<{ status: 'victory' | 'defeat', reason: string } | null>(null);

  useEffect(() => {
    // Example: Trigger damage flash (this would be connected to game events)
    // setShowDamageFlash(true);
    // setTimeout(() => setShowDamageFlash(false), 200);
  }, []);

  useEffect(() => {
    if (endGameStatusProp && !finalOutcome) {
      setFinalOutcome({ 
        status: endGameStatusProp, 
        reason: winReasonProp || (endGameStatusProp === 'defeat' ? "You Died" : "Victory!") 
      });
    } else if (!endGameStatusProp && finalOutcome) { 
      // This ensures that if the game resets (endGameStatusProp becomes undefined), 
      // the banner elements are also cleared.
      setFinalOutcome(null);
    }
  }, [endGameStatusProp, winReasonProp, finalOutcome]);

  useEffect(() => {
    if (finalOutcome) {
      setShowEndGameOverlay(true);
      const delay = finalOutcome.status === 'victory' ? 500 : 1500;
      const timer = setTimeout(() => setShowEndGameBannerText(true), delay); // Use renamed state setter
      return () => clearTimeout(timer);
    } else {
      setShowEndGameBannerText(false); // Use renamed state setter
      setShowEndGameOverlay(false);
    }
  }, [finalOutcome]); 


  useEffect(() => {
    if (scoutedCard) {
        setShowScoutedCardPreview(true);
        const timer = setTimeout(() => {
            if (showScoutedCardPreview) clearScoutedCardPreview();
        }, 5000); 
        return () => clearTimeout(timer);
    } else {
        setShowScoutedCardPreview(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoutedCard]);


  return (
    <>
      <div 
        id="damageFlashOverlay" 
        className={`fixed inset-0 bg-red-700 pointer-events-none z-[1001] transition-opacity duration-150 ${showDamageFlash ? 'opacity-70' : 'opacity-0'}`}
      />
      <div 
        id="laudanumEffectOverlay" 
        className={`fixed inset-0 z-[2000] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(106,27,154,0.5)_0%,rgba(49,27,146,0.9)_100%)] 
                    ${activeLaudanum ? 'opacity-100' : 'opacity-0'}`} 
      />
      <div 
        id="lightningStrikeFlashOverlay"
        className={`fixed inset-0 bg-white pointer-events-none z-[1005] transition-opacity duration-100 
                    ${showLightningStrikeFlash ? 'opacity-90' : 'opacity-0'}`}
      />
      
      {/* End Game Overlay (Black Screen) */}
      <div 
        id="endGameOverlay" 
        className={`fixed inset-0 bg-black pointer-events-none z-[1002] transition-opacity 
                    ${showEndGameOverlay ? (finalOutcome?.status === 'victory' ? 'opacity-80 duration-500' : 'opacity-100 duration-[1500ms]') : 'opacity-0 duration-500'}`}
      />
      
      {/* End Game Banner Text ("Victory!" / "You Died") */}
      {finalOutcome && (
        <div 
          id="endGameBannerContainer" 
          className={`fixed inset-0 flex items-center justify-center pointer-events-none z-[1003] transition-opacity
                      ${showEndGameBannerText && !isStoryModalOpen ? 'opacity-100 duration-1000' : 'opacity-0 duration-500'}`}
        >
          <h1 
              id="endGameText" 
              className={`font-western text-[clamp(5rem,15vw,12rem)] ${finalOutcome.status === 'victory' ? 'text-green-500' : 'text-red-500'}`}
              style={{ textShadow: '2px 2px 0px var(--paper-bg), 4px 4px 0px rgba(0,0,0,0.2)' }}
          >
            {finalOutcome.status === 'victory' ? (finalOutcome.reason || "Victory!") : "You Died"}
          </h1>
        </div>
      )}

      {showScoutedCardPreview && scoutedCard && (
        <div 
            className="fixed top-0 left-0 w-screen h-screen flex flex-col items-center justify-center bg-[rgba(0,0,0,0.75)] z-[2000] transition-opacity duration-500 ease-in-out opacity-100 pointer-events-all"
            onClick={clearScoutedCardPreview}
        >
            <div className="font-pulp-title text-2xl text-[var(--paper-bg)] mb-4 p-2 bg-[rgba(0,0,0,0.5)] rounded" style={{textShadow: '1px 1px 2px black'}}>
              Next Event Preview:
            </div>
            <div className="transform scale-150 shadow-[0_0_30px_10px_rgba(255,255,150,0.5)]">
                 <CardComponent card={scoutedCard} context={CardContext.SCOUTED_PREVIEW} isDisabled={true}/>
            </div>
        </div>
      )}
      <div 
        id="endTurnFadeOverlay"
        className={`fixed inset-0 bg-black pointer-events-none z-[1004] transition-opacity 
                    ${showEndTurnFade ? 'opacity-100 duration-[750ms]' : 'opacity-0 duration-[500ms]'}`}
      />
      {activeGameBanner && activeGameBanner.show && (
        <div
          id="activeGameBanner"
          className="fixed inset-x-0 top-1/3 flex items-center justify-center pointer-events-none z-[1001] transition-opacity duration-500 ease-in-out opacity-100"
        >
          <div
            className="font-pulp-title text-red-600 text-[clamp(2.5rem,6vw,4rem)] bg-[rgba(244,241,234,0.85)] px-6 py-4 rounded-md shadow-lg border-2 border-[var(--ink-main)] text-center"
            style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.3)'}}
          >
            {activeGameBanner.message}
          </div>
        </div>
      )}
    </>
  );
};

export default OverlayEffectsComponent;
