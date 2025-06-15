

import React, { useEffect } from 'react';
import { GameState, PlayerDetails, CardData, CardContext } from '../types';
import CardComponent from '../components/CardComponent';
import GameLogComponent from '../components/GameLogComponent';
import { getFormattedEffectText, getCardCategory } from '../utils/cardUtils';

interface GameScreenProps {
  gameState: GameState;
  playerDetails: PlayerDetails;
  onCardAction: (actionType: string, payload?: any) => void;
  onEndTurn: () => void;
  onRestartGame: () => void;
  onRestockStore: () => void;
  selectedCardDetails: { card: CardData; source: string; index: number } | null;
  setSelectedCard: (details: { card: CardData; source: string; index: number } | null) => void;
  deselectAllCards: () => void;
}

const smoothScrollTo = (to: number, duration: number) => {
  const element = document.documentElement.scrollTop ? document.documentElement : document.body;
  const start = element.scrollTop;
  const change = to - start;
  let startTime = 0;
  let animationFrameId: number;

  const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  const cancelAnimation = () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('mousedown', cancelAnimation);
    window.removeEventListener('wheel', cancelAnimation);
    window.removeEventListener('touchstart', cancelAnimation);
  };

  const animateScroll = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    const timeElapsed = timestamp - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const easedProgress = easeInOutQuad(progress);

    element.scrollTop = start + change * easedProgress;

    if (timeElapsed < duration) {
      animationFrameId = requestAnimationFrame(animateScroll);
    } else {
      cancelAnimation(); 
    }
  };

  window.addEventListener('mousedown', cancelAnimation, { once: true });
  window.addEventListener('wheel', cancelAnimation, { once: true, passive: true });
  window.addEventListener('touchstart', cancelAnimation, { once: true, passive: true });

  animationFrameId = requestAnimationFrame(animateScroll);
};


const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  playerDetails,
  onCardAction,
  onEndTurn,
  onRestartGame,
  onRestockStore,
  selectedCardDetails,
  setSelectedCard,
}) => {

  const { activeEvent, storeDisplayItems, turn, log, scrollAnimationPhase, pendingSkunkSprayAnimation } = gameState;

  useEffect(() => {
    if (scrollAnimationPhase === 'fadingOutAndScrollingDown') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    } else if (scrollAnimationPhase === 'fadingInAndScrollingUp') {
      // Ensure the scroll starts from the current bottom after content might have loaded
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }); 
      smoothScrollTo(0, 5000); // Scroll to top of page
    }
  }, [scrollAnimationPhase]);

  useEffect(() => {
    if (pendingSkunkSprayAnimation) {
      const playerAreaElement = document.getElementById('player1Area');
      if (playerAreaElement) {
        playerAreaElement.classList.add('player-skunk-spray-effect');
        onCardAction('CLEAR_PENDING_SKUNK_ANIMATION_FLAG'); // Clear the flag in game state
        
        // Timeout to remove the class after the animation duration
        const skunkAnimationTimer = setTimeout(() => {
          playerAreaElement.classList.remove('player-skunk-spray-effect');
        }, 10000); // Duration matches CSS

        return () => clearTimeout(skunkAnimationTimer);
      } else {
        // If element not found, still clear the flag to prevent loop
        onCardAction('CLEAR_PENDING_SKUNK_ANIMATION_FLAG');
      }
    }
  }, [pendingSkunkSprayAnimation, onCardAction]);


  const handleCardClick = (card: CardData, source: CardContext, index: number) => {
    if (selectedCardDetails && 
        selectedCardDetails.card.id === card.id &&
        selectedCardDetails.index === index &&
        selectedCardDetails.source === source) {
        setSelectedCard(null); 
    } else {
        setSelectedCard({ card, source, index }); 
    }
  };
  
  const getCardDescriptionHtml = (card: CardData | null, source: string) => {
    if (!card || !card.id || !card.name || !card.type) { // Added checks for essential card properties
        console.error("Card data is incomplete for description:", card);
        return 'Card details are currently unavailable.';
    }
    
    let desc = `<p class="font-bold text-lg text-[var(--ink-main)]">${card.name}</p>`;
    desc += `<p class="text-sm italic text-[var(--ink-secondary)] mb-2">${card.type} ${card.subType ? `- ${card.subType}` : ''}</p>`;
    desc += `<p>${card.description || 'No description available.'}</p>`;

    if (source === CardContext.STORE && card.buyCost) {
        const actualBuyCost = card.buyCost * (gameState.ngPlusLevel > 0 ? 1 : 2); // NG+ cost is already scaled in card data
        desc += `<p class="mt-2 font-semibold">Cost: ${actualBuyCost} Gold</p>`; 
    } else if ((source === CardContext.HAND || source === CardContext.EQUIPPED) && card.sellValue && (card.type === 'Trophy' || card.type === 'Bounty Proof' || card.id.startsWith('item_gold_nugget') || card.id.startsWith('item_jewelry'))) {
         desc += `<p class="mt-2 font-semibold">Sell Value: ${card.sellValue} Gold</p>`;
    } else if (source === CardContext.HAND && card.sellValue && card.type !== 'Trophy' && card.type !== 'Bounty Proof' && !card.id.startsWith('item_gold_nugget') && !card.id.startsWith('item_jewelry')) {
         desc += `<p class="mt-1 text-xs">Sell for: ${card.sellValue}G</p>`;
    }


    const effectText = getFormattedEffectText(card, source as CardContext, playerDetails);
    if (effectText) {
        desc += `<p class="mt-2 font-semibold">Effect: ${effectText}</p>`;
    }
    return desc;
  };
  
  const handCardsCount = playerDetails.hand.filter(card => card !== null).length;
  const totalPlayerCards = (playerDetails.playerDeck?.length || 0) + (playerDetails.playerDiscard?.length || 0) + handCardsCount;


  const isPlayerCardSelected = selectedCardDetails && 
                              (selectedCardDetails.source === CardContext.HAND || selectedCardDetails.source === CardContext.EQUIPPED);
  const isStoreCardSelected = selectedCardDetails && selectedCardDetails.source === CardContext.STORE;


  return (
    <div id="gameArea">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Player Area Column */}
        <div className="flex flex-col"> 
            <div id="player1Area" className="player-area bg-[rgba(244,241,234,0.9)] text-[var(--ink-main)] p-3 sm:p-4 md:p-5 rounded-sm border border-[var(--border-color)] mb-2.5" aria-live="polite" aria-atomic="true">
            <div className="flex justify-between">
                <div className="mb-4">
                <h3 className="text-xl font-western text-stone-800 mb-2">You (<span id="player1Name" className="font-mono text-sm">{playerDetails.name}</span>)</h3>
                <p>Character: <span id="player1Character" className="font-semibold">{playerDetails.character?.name}</span></p>
                <p>Health: <span id="player1Health" className="font-bold text-red-700 text-lg">{playerDetails.health} / {playerDetails.maxHealth}</span></p>
                <p>Gold: <span id="player1Gold" className={`font-bold text-yellow-500 text-lg ${gameState.goldFlashPlayer ? 'gold-gained' : ''}`}>{playerDetails.gold}</span></p>
                </div>
                <div>
                <h4 className="font-semibold mb-1 text-right">Deck Info</h4>
                <p className="text-right">Total Cards: <span id="playerDeckTotalCount" className="font-bold text-blue-600">{totalPlayerCards}</span></p>
                <p className="text-right">Deck: <span id="playerDeckCount" className="font-bold text-blue-600">{playerDetails.playerDeck?.length || 0}</span></p>
                <p className="text-right">Discard: <span id="playerDiscardCount" className="font-bold text-blue-400">{playerDetails.playerDiscard?.length || 0}</span></p>
                </div>
            </div>

            <h4 className="font-semibold mt-3 mb-1">Equipped ({playerDetails.equippedItems?.length || 0}/{playerDetails.equipSlots}):</h4>
            <div className="flex flex-col sm:flex-row sm:items-center mt-1 mb-3 sm:mb-4 md:mb-5 lg:mb-6">
                <div 
                id="player1EquippedDisplay" 
                className="grid grid-cols-3 bg-[rgba(0,0,0,0.03)] rounded-sm border border-dashed border-[var(--border-color)] justify-center
                            p-1 gap-1.5 w-full h-auto 
                            sm:w-auto sm:h-[10.1rem] 
                            md:p-2 md:gap-2 md:w-auto md:h-[10.1rem]
                            lg:p-1.5 lg:gap-1.5 lg:w-auto lg:h-[10.8rem] 
                            xl:p-2 xl:gap-2 xl:w-auto xl:h-[11.5rem]"
                >
                {Array.from({ length: playerDetails.equipSlots }).map((_, i) => {
                    const equippedCard = playerDetails.equippedItems[i];
                    let isEquippedPlayable = !!equippedCard;
                    if (equippedCard && (equippedCard.effect?.type === 'weapon' || equippedCard.effect?.type === 'conditional_weapon' || equippedCard.effect?.type === 'fire_arrow')) {
                        isEquippedPlayable = isEquippedPlayable && !!activeEvent && activeEvent.type === 'Event' && (activeEvent.health || 0) > 0;
                    }

                    return (
                        <CardComponent
                        key={`equipped-${equippedCard?.id || 'empty'}-${i}`}
                        card={equippedCard}
                        context={CardContext.EQUIPPED}
                        onClick={() => equippedCard && handleCardClick(equippedCard, CardContext.EQUIPPED, i)}
                        isSelected={
                            selectedCardDetails != null &&
                            selectedCardDetails.card?.id === equippedCard?.id &&
                            selectedCardDetails.index === i &&
                            selectedCardDetails.source === CardContext.EQUIPPED
                        }
                        indexInSource={i}
                        playerDetails={{...playerDetails, activeEventForAttack: activeEvent}}
                        onAction={onCardAction}
                        isPlayable={isEquippedPlayable} 
                        isDisabled={playerDetails.turnEnded || !equippedCard}
                        />
                    );
                })}
                </div>
                <div className="w-full mt-1 sm:mt-0 sm:ml-2 sm:flex-1 text-xs sm:text-sm italic text-stone-600 text-center sm:text-left"> 
                <p>An equipped weapon gets a +1 damage bonus. Some upgrades enhance this further.</p>
                </div>
            </div>

            <h4 className="font-semibold mt-4 sm:mt-5 md:mt-6 lg:mt-8 mb-1">Hand ({handCardsCount}/{playerDetails.handSize}):</h4>
            <div 
                id="player1HandDisplay" 
                className="grid grid-cols-3 mt-1 rounded border border-dashed border-gray-400 bg-black/5 
                        p-1 gap-1.5 min-h-[20.8rem] 
                        sm:p-1.5 sm:gap-1.5 sm:min-h-[20.8rem] 
                        md:p-2 md:gap-2 md:min-h-[20.8rem]
                        lg:p-1.5 lg:gap-1.5 lg:min-h-[21.8rem] 
                        xl:p-2 xl:gap-2 xl:min-h-[23.6rem]"
            >
                {Array.from({ length: playerDetails.handSize }).map((_, i) => {
                    const cardInSlot = playerDetails.hand[i];
                    let isHandPlayable = !!cardInSlot;
                     if (cardInSlot && (cardInSlot.effect?.type === 'weapon' || cardInSlot.effect?.type === 'conditional_weapon' || cardInSlot.effect?.type === 'fire_arrow')) {
                        isHandPlayable = isHandPlayable && !!activeEvent && activeEvent.type === 'Event' && (activeEvent.health || 0) > 0;
                    }
                    if (cardInSlot && cardInSlot.effect?.type === 'trap') {
                         isHandPlayable = true; // Traps are always playable from hand if player has the card
                    }


                    return (
                        <CardComponent
                            key={`hand-${cardInSlot?.id || 'empty'}-${i}`}
                            card={cardInSlot}
                            context={CardContext.HAND}
                            onClick={() => cardInSlot && handleCardClick(cardInSlot, CardContext.HAND, i)}
                            isSelected={selectedCardDetails?.card?.id === cardInSlot?.id && selectedCardDetails?.index === i && selectedCardDetails?.source === CardContext.HAND}
                            indexInSource={i}
                            playerDetails={{...playerDetails, activeEventForAttack: activeEvent}}
                            onAction={onCardAction}
                            isPlayable={isHandPlayable} 
                            isEquipable={!!cardInSlot && !playerDetails.hasEquippedThisTurn && (playerDetails.equippedItems?.length || 0) < playerDetails.equipSlots && !playerDetails.turnEnded && cardInSlot.type !== 'Player Upgrade'}
                            isEquipablePlayerUpgrade={!!cardInSlot && (playerDetails.equippedItems?.length || 0) < playerDetails.equipSlots && !playerDetails.turnEnded && cardInSlot.type === 'Player Upgrade'}
                            isStorable={!!cardInSlot && (playerDetails.satchel?.length || 0) < (playerDetails.equippedItems.find(item => item.effect?.subtype === 'storage')?.effect?.capacity || 0) && !playerDetails.turnEnded && cardInSlot.type === 'Provision'}
                            isSellable={!!cardInSlot && typeof cardInSlot.sellValue === 'number' && cardInSlot.sellValue > 0 && !playerDetails.turnEnded}
                            blockTradeDueToHostileEvent={gameState.blockTradeDueToHostileEvent}
                            isDisabled={playerDetails.turnEnded || !cardInSlot}
                        />
                    );
                })}
            </div>
            {isPlayerCardSelected && selectedCardDetails && selectedCardDetails.card && (
                <div 
                  id="cardDescriptionPlayerArea" 
                  className="my-2 p-3 bg-[rgba(244,241,234,0.8)] rounded shadow-inner min-h-[6rem] text-sm max-h-40 overflow-y-auto" 
                  aria-live="polite"
                  dangerouslySetInnerHTML={{ __html: getCardDescriptionHtml(selectedCardDetails.card, selectedCardDetails.source) }}
                />
            )}
            </div>
        </div>

        {/* Store/Event/Log Column */}
        <div className="player-area relative flex flex-col bg-[rgba(244,241,234,0.9)] text-[var(--ink-main)] p-3 sm:p-4 md:p-5 rounded-sm border border-[var(--border-color)]">
          <div className="flex-grow">
            <div className="mt-0">
              <div className="flex flex-col items-start mb-2">
                <h4 className="font-western text-lg text-blue-700">General Store:</h4>
                <div className="text-xs text-[var(--ink-main)] mt-0.5">Store Deck: <span className="font-bold">{gameState.storeItemDeck?.length || 0}</span> cards</div>
                <button 
                    id="restockButton" 
                    className="button !mt-1 !py-1 !px-2 text-sm w-full max-w-xs"
                    onClick={onRestockStore}
                    disabled={playerDetails.hasRestockedThisTurn || playerDetails.gold < 1 || playerDetails.turnEnded || gameState.blockTradeDueToHostileEvent}
                >
                    Restock (1G)
                </button>
              </div>
              <div id="storeDisplay" className="flex flex-wrap justify-start mt-1 
                                                gap-1.5 
                                                sm:gap-1.5 
                                                md:gap-2 
                                                lg:gap-1.5 
                                                xl:gap-2">
                {storeDisplayItems.map((card, i) => (
                  <CardComponent
                    key={`store-${card?.id || 'empty'}-${i}`}
                    card={card} 
                    context={CardContext.STORE}
                    onClick={() => card && handleCardClick(card, CardContext.STORE, i)}
                    isSelected={
                        selectedCardDetails != null &&
                        selectedCardDetails.card?.id === card?.id &&
                        selectedCardDetails.index === i &&
                        selectedCardDetails.source === CardContext.STORE
                    }
                    indexInSource={i}
                    playerDetails={playerDetails}
                    onAction={onCardAction}
                    canAfford={playerDetails.gold >= ((card?.buyCost || 0) * (gameState.ngPlusLevel > 0 ? 1: 2))} 
                    blockTradeDueToHostileEvent={gameState.blockTradeDueToHostileEvent}
                    isDisabled={playerDetails.turnEnded || !card}
                    showBack={!card && gameState.storeDisplayItems[i] === undefined} // Show back if slot is temporarily empty due to purchase delay
                  />
                ))}
              </div>
            </div>
            
            {isStoreCardSelected && !isPlayerCardSelected && selectedCardDetails && selectedCardDetails.card &&(
                <div 
                  id="cardDescriptionRightColumn" 
                  className="my-4 p-3 bg-[rgba(244,241,234,0.8)] rounded shadow-inner min-h-[6rem] text-sm max-h-48 overflow-y-auto" 
                  aria-live="polite"
                  dangerouslySetInnerHTML={{ __html: getCardDescriptionHtml(selectedCardDetails.card, selectedCardDetails.source) }}
                />
            )}
            
            <hr className="my-2 border-gray-400" />
            <h3 className="text-xl font-western text-[var(--ink-main)] mb-2">The Frontier</h3>
            <div className="flex justify-between mb-2">
              <div className="text-xs text-[var(--ink-main)]">Event Deck: <span className="font-bold text-red-600">{gameState.eventDeck?.length || 0}</span></div>
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-1.5 sm:gap-2 md:gap-2 lg:gap-1.5 xl:gap-2">
              <div id="activeEventCardDisplay" className="event-display-card sm:w-auto">
                {activeEvent ? (
                  <CardComponent
                    key={`event-${activeEvent.id}-${gameState.turn}`} // Added turn to key to help rerender if same event ID appears again
                    card={activeEvent}
                    context={CardContext.EVENT}
                    onClick={() => handleCardClick(activeEvent, CardContext.EVENT, 0)}
                    isSelected={selectedCardDetails?.card?.id === activeEvent.id && selectedCardDetails?.source === CardContext.EVENT}
                    indexInSource={0}
                    playerDetails={playerDetails}
                    onAction={onCardAction}
                    isDisabled={playerDetails.turnEnded}
                  />
                ) : (
                  <div className={`card flex items-center justify-center border-2 border-[var(--ink-main)] bg-[var(--paper-bg)] 
                                  text-[var(--ink-main)] rounded p-2 m-1 text-center shadow-md
                                  w-[7rem] h-[9.8rem] 
                                  sm:w-[7rem] sm:h-[9.8rem]
                                  md:w-[7rem] md:h-[9.8rem]
                                  lg:w-[7.5rem] lg:h-[10.5rem] 
                                  xl:w-[8rem] xl:h-[11.2rem]`}>
                    <div className="font-['Special_Elite']">All Clear</div>
                  </div>
                )}
              </div>
              <div 
                id="eventDescription" 
                className="w-full mt-1 sm:mt-0 sm:flex-1 p-3 bg-[rgba(244,241,234,0.8)] rounded shadow-inner text-sm overflow-y-auto 
                           h-[9.8rem] 
                           sm:h-[9.8rem] 
                           md:h-[9.8rem]
                           lg:h-[10.5rem] 
                           xl:h-[11.2rem]" 
                aria-live="polite"
                dangerouslySetInnerHTML={{__html: activeEvent ? getCardDescriptionHtml(activeEvent, CardContext.EVENT) : `<p class="text-stone-600 italic text-center p-4">The trail is quiet... for now.</p>`}}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-stretch gap-2 mt-3 sm:mt-2">
                <div id="activeTrapDisplay" className="w-full sm:w-auto sm:flex-1 flex items-center justify-center p-2 bg-white rounded shadow text-center font-semibold text-sm sm:text-base">
                    Trap: {playerDetails.activeTrap ? playerDetails.activeTrap.name : 'None'}
                </div>
                <div id="turnIndicator" className="w-full sm:w-auto sm:flex-1 flex items-center justify-center p-2 bg-white rounded shadow text-center font-semibold text-sm sm:text-base">
                    Day: <span id="turnNumberDisplay">{turn}</span>
                </div>
                <button 
                    id="endTurnButton" 
                    className="button w-full sm:w-auto sm:flex-1 !mt-0"
                    onClick={onEndTurn}
                    disabled={playerDetails.turnEnded || gameState.status === 'finished'}
                >
                    End Day
                </button>
            </div>
          </div>
          <div id="playerActions" className="mt-auto">
            <GameLogComponent logEntries={log} />
            <button 
                id="restartButton" 
                className="button w-full bg-red-800 hover:bg-red-900 border-red-900 text-[var(--paper-bg)]" 
                onClick={onRestartGame}
            >
                Restart Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
