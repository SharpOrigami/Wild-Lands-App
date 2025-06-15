
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, PlayerDetails, Character, CardData, LogEntry, CardEffect, CardContext, ModalState, ActiveGameBannerState } from '../types';
import {
    PLAYER_ID, MAX_LOG_ENTRIES, HAND_LIMIT, EQUIP_LIMIT, STORE_DISPLAY_LIMIT, EVENT_DECK_SIZE, PLAYER_DECK_TARGET_SIZE, STORE_DECK_TARGET_SIZE,
    CHARACTERS_DATA_MAP, INITIAL_PLAYER_STATE_TEMPLATE,
    CURRENT_CARDS_DATA, resetCurrentCardsData, updateCurrentCardsData, ALL_CARDS_DATA_MAP,
    MAX_INTERNAL_LOG_ENTRIES
} from '../constants';
import { shuffleArray, calculateAttackPower, calculateHealAmount, isEventConsideredHostile, getCardCategory, pickRandomDistinctFromPool, createTrophyOrBountyCard } from '../utils/cardUtils';
import { generateStoryForGame, generateAIBossForGame, remixCardsForNGPlusGame, generateBossIntroStory } from '../services/geminiService';

const initialModalState: ModalState = { isOpen: false, title: '', text: '' };
const initialGameBannerState: ActiveGameBannerState | null = null;
const MAX_PERSISTED_LOG_ENTRIES = 200;
const NG_PLUS_PLAYER_HEALTH_BOOST_INTERVAL = 10; // Player gets health boost every 10 NG+ levels
const NG_PLUS_PLAYER_HEALTH_BOOST_AMOUNT = 10;
const NG_PLUS_THEME_MILESTONE_INTERVAL = 10; // AI Remix happens every 10 NG+ levels (10, 20, 30...)


const BANNER_DURATION = 3000; // 3 seconds for banners
const LAUDANUM_VISUAL_DURATION = 2000; // 2 seconds

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

const applyManualNGPlusScaling = (baseCards: { [id: string]: CardData }, ngPlusLevel: number): { [id: string]: CardData } => {
    const scaledCards = JSON.parse(JSON.stringify(baseCards));
    if (ngPlusLevel === 0) return scaledCards;

    for (const cardId in scaledCards) {
        const card = scaledCards[cardId] as CardData;
        if (card.type === 'Event' && (card.subType === 'animal' || card.subType === 'human')) {
            if (card.health) card.health = Math.max(1, card.health + ngPlusLevel);
            if (card.effect?.amount && (card.effect.type === 'damage' || card.effect.type === 'poison')) {
                 card.effect.amount += ngPlusLevel;
            } else if (card.effect?.damage && card.effect.type === 'poison') { // some poison use 'damage' field
                 card.effect.damage += ngPlusLevel;
            }
            if (card.goldValue) card.goldValue += ngPlusLevel;
        } else if (card.effect?.type === 'weapon' || card.effect?.type === 'conditional_weapon') {
            if (card.effect.attack) card.effect.attack += ngPlusLevel;
        }
        // Gold value for sellable items also increases
        if (card.sellValue) card.sellValue += ngPlusLevel;
        // Buy cost for store items also increases
        if (card.buyCost) card.buyCost += ngPlusLevel;
    }
    return scaledCards;
};

// New function for incremental scaling on a themed base
const applyIncrementalNGPlusScaling = (themedBaseCards: { [id: string]: CardData }, incrementAmount: number): { [id: string]: CardData } => {
    const scaledCards = JSON.parse(JSON.stringify(themedBaseCards));
    if (incrementAmount <= 0) return scaledCards;

    for (const cardId in scaledCards) {
        const card = scaledCards[cardId] as CardData;
        if (card.type === 'Event' && (card.subType === 'animal' || card.subType === 'human')) {
            if (card.health) card.health = Math.max(1, card.health + incrementAmount);
            if (card.effect?.amount && (card.effect.type === 'damage' || card.effect.type === 'poison')) {
                 card.effect.amount += incrementAmount;
            } else if (card.effect?.damage && card.effect.type === 'poison') {
                 card.effect.damage += incrementAmount;
            }
            if (card.goldValue) card.goldValue += incrementAmount;
        } else if (card.effect?.type === 'weapon' || card.effect?.type === 'conditional_weapon') {
            if (card.effect.attack) card.effect.attack += incrementAmount;
        }
        if (card.sellValue) card.sellValue += incrementAmount;
        if (card.buyCost) card.buyCost += incrementAmount;
    }
    return scaledCards;
};


export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<{ type: string, target?: string, amount?: number} | null>(null);
  const [showEndTurnFade, setShowEndTurnFade] = useState(false);
  const [preGeneratedAiBoss, setPreGeneratedAiBoss] = useState<CardData | null>(null);
  const [isPreGeneratingBoss, setIsPreGeneratingBoss] = useState(false);
  const [storeCardReplacementTimeoutId, setStoreCardReplacementTimeoutId] = useState<number | null>(null);
  const bannerTimeoutRef = useRef<number | null>(null);
  const autoEndTurnTimerRef = useRef<number | null>(null);


  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (storeCardReplacementTimeoutId) {
        clearTimeout(storeCardReplacementTimeoutId);
      }
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      if (autoEndTurnTimerRef.current) {
        clearTimeout(autoEndTurnTimerRef.current);
      }
    };
  }, [storeCardReplacementTimeoutId]);

  const _log = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setGameState(prev => {
      if (!prev) return null;
      const currentLog = prev.log || [];
      const newLogEntry: LogEntry = { message, type, timestamp: new Date().toISOString() };
      const newLog = [newLogEntry, ...currentLog].slice(0, MAX_INTERNAL_LOG_ENTRIES);
      return { ...prev, log: newLog };
    });
  }, []);

  const triggerBanner = useCallback((message: string, bannerType: ActiveGameBannerState['bannerType'], autoEndTurnAfter?: boolean) => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    if (autoEndTurnTimerRef.current) {
        clearTimeout(autoEndTurnTimerRef.current);
    }

    setGameState(prev => prev ? { ...prev, activeGameBanner: { show: true, message, bannerType } } : null);
    
    bannerTimeoutRef.current = setTimeout(() => {
      setGameState(prev => prev ? { ...prev, activeGameBanner: null } : null);
      bannerTimeoutRef.current = null;
      if (autoEndTurnAfter) {
        // "After 2 seconds when the banner goes away" - Banner duration is 3s. So end turn 3s after it appears.
        if (!isEndingTurn && gameStateRef.current && gameStateRef.current.status === 'playing') {
            _log(`Banner for "${message}" ended, auto-ending turn.`, "debug");
            endTurnLogic(); 
        }
      }
    }, BANNER_DURATION) as unknown as number;
  }, [_log, isEndingTurn]); // Added isEndingTurn and endTurnLogic dependency (will be defined later)


  useEffect(() => {
    if (gameState?.status === 'setup' && !preGeneratedAiBoss && !isPreGeneratingBoss) {
        setIsPreGeneratingBoss(true);
        _log("Pre-generating AI Boss during setup...", "debug");
        generateAIBossForGame(_log).then(boss => { // Called without player char details initially
            setPreGeneratedAiBoss(boss);
            setIsPreGeneratingBoss(false);
            if (boss && boss.id !== 'default_boss' && boss.id !== 'default_boss_fallback') {
                _log(`AI Boss "${boss.name}" pre-generated successfully.`, "debug");
            } else {
                _log("AI Boss pre-generation resulted in a default or fallback boss.", "debug");
            }
        }).catch(error => {
            console.error("Error pre-generating AI boss:", error);
            _log("Error during AI Boss pre-generation.", "error");
            setIsPreGeneratingBoss(false);
        });
    }
  }, [gameState?.status, preGeneratedAiBoss, isPreGeneratingBoss, _log]);


  const triggerGoldFlash = useCallback((playerId: string) => {
    if(playerId === PLAYER_ID) {
        setGameState(prev => prev ? { ...prev, goldFlashPlayer: true } : null);
        setTimeout(() => setGameState(prev => prev ? { ...prev, goldFlashPlayer: false } : null), 500);
    }
  }, []);

  const triggerAnimation = useCallback(async (type: string, target?: string, amount?: number) => {
    setActiveAnimation({ type, target, amount });

    let duration = 400;
    if (['player-border-pulse-red', 'player-border-pulse-green', 'threat-card-border-pulse-red'].includes(type)) {
        duration = 450;
    } else if (type === 'player-skunk-spray-effect') {
        duration = 10000; // Updated duration for skunk spray
    } else if (['player-damage-flash-bg', 'player-heal-flash-bg', 'threat-card-shake-damage-bg'].includes(type)) {
        duration = 300;
    } else if (['trap-display-activated', 'player-hat-saved-damage'].includes(type)) {
        duration = 600;
    } else if (type === 'event-trapped-small') {
        duration = 700;
    } else if (['player-is-ill', 'player-scarlet-fever-effect'].includes(type)) {
        duration = (type === 'player-scarlet-fever-effect') ? 1000 : 1600;
    } else if (type === 'event-item-taken') {
        duration = 500;
    } else if (type === 'threat-attacks-player') {
        duration = 800;
    } else if (type === 'player-area-shake-effect') {
        duration = 500;
    }
    else if (type === 'player-heal-flash-bg') {
        duration = 300;
    } else if (type === 'player-border-pulse-green') {
        duration = 450;
    }

    setTimeout(() => setActiveAnimation(null), duration);
  }, []);

  const applyDamageAndGetAnimation = useCallback((
    playerDetailsInput: PlayerDetails,
    damage: number,
    sourceName: string,
    eventId?: string
  ): {
    updatedPlayer: PlayerDetails;
    actualDamageDealt: number;
    animationDetails: { amount: number; sourceName: string; eventId?: string } | null;
    hatDiscarded?: CardData;
  } => {
    let actualDamage = damage;
    let modPlayer = { ...playerDetailsInput };
    let animationDetailsReturn: { amount: number; sourceName: string; eventId?: string } | null = null;
    let hatThatNegatedDamage: CardData | undefined = undefined;
    modPlayer.hatDamageNegationUsedThisTurn = false;

    const equippedHat = modPlayer.equippedItems.find(item => item.effect?.subtype === 'damage_negation');

    if (modPlayer.hatDamageNegationAvailable && equippedHat && equippedHat.effect?.max_health) {
        const hatHealth = equippedHat.effect.max_health;
        _log(`${modPlayer.name}'s ${equippedHat.name} (negates ${hatHealth}) deflects the blow from ${sourceName}!`, 'info');
        
        hatThatNegatedDamage = equippedHat; // Store for return
        // Hat is discarded
        modPlayer.equippedItems = modPlayer.equippedItems.filter(item => item.id !== equippedHat.id);
        // Max health reduces
        modPlayer.maxHealth = Math.max(1, modPlayer.maxHealth - hatHealth);
        modPlayer.health = Math.min(modPlayer.health, modPlayer.maxHealth); // Cap current health
        
        modPlayer.hatDamageNegationAvailable = false;
        modPlayer.hatDamageNegationUsedThisTurn = true;
        triggerAnimation('player-hat-saved-damage', 'player');
        actualDamage = 0; // Hat negates all damage up to its value, effectively setting damage to 0 here as per request.
    } else {
        const damageReductionUpgrades = modPlayer.equippedItems.filter(item => item.effect?.type === 'upgrade' && item.effect.subtype === 'damage_reduction' && item.effect.amount);
        let totalReduction = 0;
        damageReductionUpgrades.forEach(upgrade => totalReduction += (upgrade.effect?.amount || 0));

        actualDamage = Math.max(0, actualDamage - totalReduction);
        if (totalReduction > 0 && actualDamage < damage) {
            _log(`${modPlayer.name}'s gear reduces damage from ${sourceName} by ${damage - actualDamage}.`, 'info');
        }

        if (actualDamage > 0) {
            modPlayer.health = Math.max(0, modPlayer.health - actualDamage);
            _log(`${playerDetailsInput.name} takes ${actualDamage} damage from ${sourceName}. Health: ${modPlayer.health}/${modPlayer.maxHealth}`, 'event');
            animationDetailsReturn = { amount: actualDamage, sourceName: sourceName, eventId };
        } else if (damage > 0) {
             _log(`${playerDetailsInput.name} takes no damage from ${sourceName}.`, 'info');
        }
    }
    return { updatedPlayer: modPlayer, actualDamageDealt: actualDamage, animationDetails: animationDetailsReturn, hatDiscarded: hatThatNegatedDamage };
  }, [_log, triggerAnimation]);


  const applyImmediateEventAndCheckEndTurn = useCallback((
      event: CardData,
      player: PlayerDetails,
      addLogEntry: (message: string, type?: LogEntry['type']) => void, // _log passed here
      applyDamageFn: typeof applyDamageAndGetAnimation
  ): {
      updatedPlayer: PlayerDetails;
      turnEndedByEvent: boolean;
      gameShouldEnd: boolean;
      eventRemoved: boolean;
      winReason?: string;
      damageInfo?: { amount: number; sourceName: string; eventId?: string } | null;
      hatDiscarded?: CardData;
  } => {
      let modifiablePlayer = { ...player };
      let turnEndedByEvent = false;
      let gameShouldEnd = false;
      let eventRemoved = false;
      let winReason = '';
      let damageInfoForAnimation: { amount: number; sourceName: string; eventId?: string } | null = null;
      let hatDiscardedDuringEvent: CardData | undefined = undefined;

      const eventEffect = event.effect;
      const eventId = event.id;

      addLogEntry(`Event revealed: ${event.name}.`, 'event');
      if (!event.name || !event.type) {
        addLogEntry(`ERROR: Revealed event card is malformed: ${JSON.stringify(event)}`, 'error');
      }


      if (event.subType === 'illness' || event.subType === 'environmental' || eventId.startsWith('threat_thief_')) {
          triggerBanner(event.name, 'event_alert', eventEffect?.turn_end);
      }


      if (event.immediateEffect?.type === 'random_gold_steal' && event.immediateEffect.maxAmount) {
          const goldStolen = Math.floor(Math.random() * (event.immediateEffect.maxAmount + 1));
          if (goldStolen > 0 && modifiablePlayer.gold > 0) {
              const actualStolen = Math.min(goldStolen, modifiablePlayer.gold);
              modifiablePlayer.gold -= actualStolen;
              addLogEntry(`${event.name} snatches ${actualStolen} Gold from ${modifiablePlayer.name}!`, 'event');
              triggerGoldFlash(PLAYER_ID);
          } else if (goldStolen > 0) {
              addLogEntry(`${event.name} tries to steal gold, but ${modifiablePlayer.name} has none!`, 'event');
          }
      }

      // Human threats (except thief/vagabond) and large animals (health > 8) attack on reveal
      if (event.type === 'Event' &&
          ((event.subType === 'human' && !event.id.startsWith('threat_thief_') && !event.id.startsWith('threat_vagabond_')) ||
           (event.subType === 'animal' && (event.health || 0) > 8)) && // Only animals with >8 health attack on reveal
          eventEffect?.type === 'damage' && (eventEffect.amount || 0) > 0) {

          addLogEntry(`${event.name} attacks immediately!`, 'event');
          const { updatedPlayer, animationDetails, hatDiscarded: currentHatDiscard } = applyDamageFn(modifiablePlayer, eventEffect.amount || 0, event.name, eventId);
          modifiablePlayer = updatedPlayer;
          if (currentHatDiscard) hatDiscardedDuringEvent = currentHatDiscard;
          damageInfoForAnimation = animationDetails;
          triggerAnimation('player-area-shake-effect', 'player');
          if (modifiablePlayer.health <= 0) {
            gameShouldEnd = true;
            winReason = `${modifiablePlayer.character?.name || 'Player'} was defeated by ${event.name}.`;
            return { updatedPlayer: modifiablePlayer, turnEndedByEvent, gameShouldEnd, eventRemoved, winReason, damageInfo: damageInfoForAnimation, hatDiscarded: hatDiscardedDuringEvent };
          }
      }


      if (eventEffect?.turn_end) { // This applies to Illnesses and Natural Threats
          turnEndedByEvent = true; // Mark that the event itself causes the turn to end
          eventRemoved = true; // These events are typically one-off

          // Discard hand for illnesses and environmental threats as per rules
          if (event.subType === 'illness' || event.subType === 'environmental') {
            addLogEntry(`${event.name} causes ${modifiablePlayer.name} to discard their hand.`, 'event');
            modifiablePlayer.hand.forEach(cardInHand => {
                if (cardInHand) modifiablePlayer.playerDiscard.push(cardInHand);
            });
            modifiablePlayer.hand = new Array(modifiablePlayer.handSize).fill(null);
          }

          if (eventId === 'threat_scarlet_fever' && eventEffect) {
              const { updatedPlayer, animationDetails, hatDiscarded: currentHatDiscard } = applyDamageFn(modifiablePlayer, eventEffect.amount || 3, event.name, eventId);
              modifiablePlayer = updatedPlayer;
              if (currentHatDiscard) hatDiscardedDuringEvent = currentHatDiscard;
              damageInfoForAnimation = animationDetails;
              if (modifiablePlayer.health > 0) {
                  addLogEntry(`${modifiablePlayer.name} contracts Scarlet Fever! Hand already discarded.`, 'event');
              }
          } else if (eventId === 'threat_lightning_strike' && eventEffect?.type === 'damage_percent' && eventEffect.amount) {
              const damage = Math.ceil(modifiablePlayer.health * eventEffect.amount);
              const { updatedPlayer, animationDetails, hatDiscarded: currentHatDiscard } = applyDamageFn(modifiablePlayer, damage, event.name, eventId);
              modifiablePlayer = updatedPlayer;
              if (currentHatDiscard) hatDiscardedDuringEvent = currentHatDiscard;
              damageInfoForAnimation = animationDetails;
          } else if (eventId === 'threat_rockslide' && eventEffect) {
              const { updatedPlayer, animationDetails, hatDiscarded: rockslideHatDiscard } = applyDamageFn(modifiablePlayer, eventEffect.amount || 2, event.name, eventId);
              modifiablePlayer = updatedPlayer;
              if (rockslideHatDiscard) hatDiscardedDuringEvent = rockslideHatDiscard;
              damageInfoForAnimation = animationDetails;

              if (modifiablePlayer.health > 0 && eventEffect.discard_equipped && modifiablePlayer.equippedItems.length > 0) {
                  const itemsToDiscard: CardData[] = [];
                  const remainingEquippedItems: CardData[] = [];
                  const discardedItemNames: string[] = [];

                  modifiablePlayer.equippedItems.forEach(item => {
                      if (item.id === 'upgrade_iron_will' && !modifiablePlayer.hatDamageNegationUsedThisTurn) { 
                          remainingEquippedItems.push(item);
                      } else {
                          itemsToDiscard.push(item);
                          discardedItemNames.push(item.name);
                          // If a hat is discarded here, ensure its max_health effect is removed
                          if (item.effect?.subtype === 'damage_negation' && item.effect.max_health) {
                              modifiablePlayer.maxHealth = Math.max(1, modifiablePlayer.maxHealth - item.effect.max_health);
                              modifiablePlayer.health = Math.min(modifiablePlayer.health, modifiablePlayer.maxHealth);
                          } else if (item.effect?.subtype === 'max_health' && item.effect.amount) { // Other max_health items
                              modifiablePlayer.maxHealth = Math.max(1, modifiablePlayer.maxHealth - item.effect.amount);
                              modifiablePlayer.health = Math.min(modifiablePlayer.health, modifiablePlayer.maxHealth);
                          }
                      }
                  });

                  if (itemsToDiscard.length > 0) {
                      addLogEntry(`${event.name} forces ${modifiablePlayer.name} to discard equipped: ${discardedItemNames.join(', ')}! Hand already discarded.`, 'event');
                      itemsToDiscard.forEach(item => modifiablePlayer.playerDiscard.push(item));
                      modifiablePlayer.equippedItems = remainingEquippedItems;
                  } else if (modifiablePlayer.equippedItems.some(item => item.id === 'upgrade_iron_will')) {
                      addLogEntry(`${modifiablePlayer.name}'s Iron Will saves their gear from the ${event.name}! Hand already discarded.`, 'info');
                  }
              }
          } else if ((event.subType === 'illness' || eventId === 'threat_snake_bite') && eventEffect?.type && ['damage', 'poison'].includes(eventEffect.type)) {
                const damageAmount = eventEffect.damage || eventEffect.amount || 0;
                if (damageAmount > 0) {
                    const { updatedPlayer, animationDetails, hatDiscarded: currentHatDiscard } = applyDamageFn(modifiablePlayer, damageAmount, event.name, eventId);
                    modifiablePlayer = updatedPlayer;
                    if (currentHatDiscard) hatDiscardedDuringEvent = currentHatDiscard;
                    damageInfoForAnimation = animationDetails;
                }
          }
      }


      if (turnEndedByEvent && modifiablePlayer.health > 0) {
          addLogEntry(`The event '${event.name}' causes the day to end abruptly.`, 'event');
      }

      if (modifiablePlayer.health <= 0 && !gameShouldEnd) {
          gameShouldEnd = true;
          winReason = `${modifiablePlayer.character?.name || 'Player'} ${eventId.startsWith('threat_') ? 'succumbed to' : 'was overcome by'} ${event.name}.`;
      }

      return { updatedPlayer: modifiablePlayer, turnEndedByEvent, gameShouldEnd, eventRemoved, winReason, damageInfo: damageInfoForAnimation, hatDiscarded: hatDiscardedDuringEvent };
  }, [applyDamageAndGetAnimation, triggerGoldFlash, _log, triggerAnimation, triggerBanner]);


  useEffect(() => {
    const playerArea = document.getElementById('player1Area');
    const activeEventCardEl = document.getElementById('activeEventCardDisplay')?.firstElementChild;
    const trapDisplayEl = document.getElementById('activeTrapDisplay');

    if (!activeAnimation || (!playerArea && !activeEventCardEl && !trapDisplayEl)) return;

    const { type, target } = activeAnimation;

    let elementToAnimate: HTMLElement | null = null;
    let animationClass = type;

    if (target === 'player' && playerArea) {
        elementToAnimate = playerArea as HTMLElement;
    } else if (target === 'threat' && activeEventCardEl && activeEventCardEl instanceof HTMLElement) {
        elementToAnimate = activeEventCardEl;
    } else if (target === 'trapDisplay' && trapDisplayEl) {
        elementToAnimate = trapDisplayEl as HTMLElement;
    } else {
         if (!['player-damage-flash-bg', 'player-border-pulse-red'].includes(type)) {
            elementToAnimate = null;
        }
    }

    if (elementToAnimate && !['player-damage-flash-bg', 'player-border-pulse-red'].includes(type)) {
        elementToAnimate.classList.remove(animationClass);
        void elementToAnimate.offsetWidth;
        elementToAnimate.classList.add(animationClass);
    }
}, [activeAnimation]);


const applyHealToPlayer = useCallback((player: PlayerDetails, healAmount: number, sourceName: string) => {
    let modPlayer = { ...player };
    const actualHeal = Math.min(healAmount, modPlayer.maxHealth - modPlayer.health);
    if (actualHeal > 0) {
        modPlayer.health += actualHeal;
        _log(`${modPlayer.name} heals ${actualHeal} HP from ${sourceName}. Health: ${modPlayer.health}/${modPlayer.maxHealth}`, 'info');
        triggerAnimation('player-heal-flash-bg', 'player');
        setTimeout(() => triggerAnimation('player-border-pulse-green', 'player'), 100);
    }
    return modPlayer;
}, [_log, triggerAnimation]);


const handleCardAction = useCallback(async (actionType: string, payload: any) => {
    const initialGameState = gameStateRef.current;
    if (!initialGameState || initialGameState.status === 'finished' || isEndingTurn) {
        if (isEndingTurn) _log("Cannot perform actions while the day is ending.", "error");
        return;
    }

    _log(`Attempting action: ${actionType} with payload: ${payload ? JSON.stringify(payload.card?.id || payload.title || payload) : 'N/A'}`, 'debug');

    let modifiablePlayer = { ...initialGameState.playerDetails[PLAYER_ID] };
    let modifiableGameStateUpdates: Partial<GameState> = {};

    const { card, source, index, modalType, title, text, confirmCallback: modalConfirmCallback } = payload || {};

    switch (actionType) {
        case 'SHOW_MODAL':
             if (modalType === 'message') {
                 modifiableGameStateUpdates.modals = { ...initialGameState.modals, message: { isOpen: true, title, text, confirmCallback: modalConfirmCallback, confirmText: payload.confirmText } };
             } else if (modalType === 'story') {
                 modifiableGameStateUpdates.modals = { ...initialGameState.modals, story: { isOpen: true, title, text, confirmCallback: modalConfirmCallback } };
             }
            break;
        case 'USE_ITEM':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (!card || (source === CardContext.HAND && modifiablePlayer.hand[index] === null) ) {
                _log("No card to use in selected slot.", "error"); break;
            }
             if (card.id.startsWith('provision_laudanum')) {
                modifiableGameStateUpdates.laudanumVisualActive = true;
            }

            let cardUsedAndDiscarded = true; // Most items are discarded after use

            if (card.effect) {
                if (card.effect.type === 'heal') {
                    const healAmount = calculateHealAmount(card, modifiablePlayer);
                    modifiablePlayer = applyHealToPlayer(modifiablePlayer, healAmount, card.name);
                    if (card.effect.cures) {
                        const activeIllness = initialGameState.activeEvent?.subType === 'illness' ? initialGameState.activeEvent : null;
                        if (activeIllness) {
                            _log(`${card.name} cures ${modifiablePlayer.name} of ${activeIllness.name}!`, 'info');
                            modifiableGameStateUpdates.eventDiscardPile = [...(initialGameState.eventDiscardPile || []), activeIllness];
                            modifiableGameStateUpdates.activeEvent = null;
                            triggerAnimation('player-border-pulse-green', 'player');
                        }
                    }
                } else if (card.effect.type === 'weapon' || card.effect.type === 'conditional_weapon') {
                    if (!initialGameState.activeEvent || initialGameState.activeEvent.type !== 'Event' || (initialGameState.activeEvent.health || 0) <= 0) {
                         _log("No active threat to attack.", "error"); cardUsedAndDiscarded = false; break;
                    }
                    const attackPower = calculateAttackPower(card, modifiablePlayer, source as CardContext, initialGameState.activeEvent);
                    _log(`${modifiablePlayer.name} attacks ${initialGameState.activeEvent.name} with ${card.name} for ${attackPower} damage.`, 'action');

                    triggerAnimation('threat-attacks-player', 'threat');
                    setTimeout(() => triggerAnimation('threat-card-shake-damage-bg', 'threat'), 150);
                    setTimeout(() => triggerAnimation('threat-card-border-pulse-red', 'threat'), 300);

                    const updatedActiveEvent = { ...initialGameState.activeEvent, health: Math.max(0, (initialGameState.activeEvent.health || 0) - attackPower) };
                    modifiableGameStateUpdates.activeEvent = updatedActiveEvent;
                    modifiableGameStateUpdates.activeEventJustAttacked = true;

                    if (updatedActiveEvent.health <= 0) {
                        const goldGained = updatedActiveEvent.goldValue || 0;
                        if (goldGained > 0) {
                           modifiablePlayer.gold += goldGained;
                           _log(`Gained ${goldGained} Gold.`, 'gold');
                           triggerGoldFlash(PLAYER_ID);
                        }
                        _log(`${updatedActiveEvent.name} defeated!`, 'event');
                        triggerBanner(`${updatedActiveEvent.name} Defeated!`, 'threat_defeated');


                        const trophyCard = createTrophyOrBountyCard(updatedActiveEvent);
                        modifiablePlayer.playerDiscard.push(trophyCard);
                        _log(`${trophyCard.name} added to discard.`, 'info');

                        modifiableGameStateUpdates.eventDiscardPile = [...(initialGameState.eventDiscardPile || []), updatedActiveEvent];

                        if (updatedActiveEvent.id === initialGameState.aiBoss?.id) {
                            _log("The ultimate evil is vanquished!", 'system');
                            localStorage.setItem('aiBossDefeated_WWS', 'true');
                        }
                        modifiableGameStateUpdates.activeEvent = null;
                        modifiableGameStateUpdates.blockTradeDueToHostileEvent = false;
                    }
                } else if (card.effect.type === 'fire_arrow') {
                    if (!initialGameState.activeEvent || initialGameState.activeEvent.type !== 'Event' || (initialGameState.activeEvent.health || 0) <= 0) {
                        _log("No active threat to attack with fire arrows.", "error"); cardUsedAndDiscarded = false; break;
                    }
                    const hasBow = modifiablePlayer.hand.some(c => c?.id.startsWith('item_bow')) || modifiablePlayer.equippedItems.some(c => c.id.startsWith('item_bow'));
                    if (!hasBow) { _log("Requires a Bow to use Fire Arrows.", "error"); cardUsedAndDiscarded = false; break; }

                    const fireDamage = 2; // Fixed damage for fire arrows
                    _log(`${modifiablePlayer.name} shoots a fire arrow at ${initialGameState.activeEvent.name} for ${fireDamage} damage.`, 'action');

                    triggerAnimation('threat-attacks-player', 'threat');
                    setTimeout(() => triggerAnimation('threat-card-shake-damage-bg', 'threat'), 150);
                    setTimeout(() => triggerAnimation('threat-card-border-pulse-red', 'threat'), 300);

                    const updatedActiveEventFire = { ...initialGameState.activeEvent, health: Math.max(0, (initialGameState.activeEvent.health || 0) - fireDamage) };
                    modifiableGameStateUpdates.activeEvent = updatedActiveEventFire;
                    modifiableGameStateUpdates.activeEventJustAttacked = true;

                    if (updatedActiveEventFire.health <= 0) {
                         const goldGained = updatedActiveEventFire.goldValue || 0;
                         if (goldGained > 0) {
                            modifiablePlayer.gold += goldGained;
                            _log(`Gained ${goldGained} Gold.`, 'gold');
                            triggerGoldFlash(PLAYER_ID);
                         }
                         _log(`${updatedActiveEventFire.name} defeated by fire!`, 'event');
                         triggerBanner(`${updatedActiveEventFire.name} Defeated!`, 'threat_defeated');

                         const trophyCard = createTrophyOrBountyCard(updatedActiveEventFire);
                         modifiablePlayer.playerDiscard.push(trophyCard);
                         _log(`${trophyCard.name} added to discard.`, 'info');

                         modifiableGameStateUpdates.eventDiscardPile = [...(initialGameState.eventDiscardPile || []), updatedActiveEventFire];
                         if (updatedActiveEventFire.id === initialGameState.aiBoss?.id) {
                            _log("The ultimate evil is vanquished by fire!", 'system');
                            localStorage.setItem('aiBossDefeated_WWS', 'true');
                         }
                         modifiableGameStateUpdates.activeEvent = null;
                         modifiableGameStateUpdates.blockTradeDueToHostileEvent = false;
                    }
                } else if (card.effect.type === 'campfire') {
                    modifiablePlayer.isCampfireActive = true;
                    _log(`${modifiablePlayer.name} sets up a campfire. It will provide safety for one night.`, 'action');
                } else if (card.effect.type === 'gold' && card.id === 'item_gold_pan') {
                    const goldFound = Math.floor(Math.random() * 3) + 1;
                    modifiablePlayer.gold += goldFound;
                    _log(`${modifiablePlayer.name} pans for gold and finds ${goldFound} Gold!`, 'action');
                    triggerGoldFlash(PLAYER_ID);
                } else if (card.effect.type === 'draw') {
                    const cardsToDrawCount = card.effect.amount || 2;
                    let actuallyDrawnCount = 0;
                    let tempDeck = [...modifiablePlayer.playerDeck];
                    let tempDiscard = [...modifiablePlayer.playerDiscard];
                    let tempHand = [...modifiablePlayer.hand];

                    for (let i = 0; i < cardsToDrawCount; i++) {
                        if (tempDeck.length === 0) {
                            if (tempDiscard.length > 0) {
                                _log("Reshuffling discard into deck.", "debug");
                                tempDeck = shuffleArray(tempDiscard);
                                tempDiscard = [];
                            } else {
                                _log("No cards left in deck or discard to draw.", "info");
                                break;
                            }
                        }

                        let cardPlacedInHand = false;
                        for (let j = 0; j < modifiablePlayer.handSize; j++) {
                            if (tempHand[j] === null) {
                                const drawnCard = tempDeck.shift();
                                if (drawnCard) {
                                    tempHand[j] = drawnCard;
                                    actuallyDrawnCount++;
                                    cardPlacedInHand = true;
                                }
                                break;
                            }
                        }
                        if (!cardPlacedInHand && tempDeck.length > 0) {
                             _log("Hand is full (no empty slots), cannot draw more cards.", "info");
                             break;
                        }
                        if(tempDeck.length === 0 && i < cardsToDrawCount -1 && actuallyDrawnCount < cardsToDrawCount) {
                             _log("Deck empty, cannot complete full draw.", "info");
                             break;
                        }
                    }
                    if (actuallyDrawnCount > 0) {
                        modifiablePlayer.playerDeck = tempDeck;
                        modifiablePlayer.playerDiscard = tempDiscard;
                        modifiablePlayer.hand = tempHand;
                        modifiablePlayer.isUnsortedDraw = true;
                        _log(`${modifiablePlayer.name} uses ${card.name} to draw ${actuallyDrawnCount} card(s).`, 'action');
                    } else if (cardsToDrawCount > 0) {
                         _log(`${card.name} was used, but no cards could be drawn (deck empty or hand full).`, "info");
                    }
                } else if (card.effect.type === 'trap') {
                    if (modifiablePlayer.activeTrap) {
                        modifiablePlayer.playerDiscard.push(modifiablePlayer.activeTrap); // Old trap goes to discard
                        _log(`${modifiablePlayer.name} replaces previous trap with ${card.name}.`, 'action');
                    } else {
                        _log(`${modifiablePlayer.name} sets a ${card.name}.`, 'action');
                    }
                    modifiablePlayer.activeTrap = card; // Set the new trap
                    cardUsedAndDiscarded = false; // Trap is now active, not discarded from hand yet
                    triggerAnimation('trap-display-activated', 'trapDisplay');
                } else if (card.effect.type === 'scout') {
                    if (initialGameState.eventDeck.length > 0) {
                        const nextEvent = initialGameState.eventDeck[0];
                        _log(`${modifiablePlayer.name} scouts ahead, revealing: ${nextEvent.name}.`, 'action');
                        // Use banner for scout ahead
                        triggerBanner(`Next Card: ${nextEvent.name}`, 'generic_info');
                        // Keep the selected card for potential overlay effects if desired, but banner is primary
                        modifiableGameStateUpdates.selectedCard = { card: nextEvent, source: 'scouted_preview', index: -1 };
                    } else {
                        _log("Nothing to scout, event deck is empty.", 'info');
                    }
                }
            }

            if (cardUsedAndDiscarded) {
                if (source === CardContext.HAND && index !== undefined && modifiablePlayer.hand[index]) {
                    modifiablePlayer.playerDiscard.push(modifiablePlayer.hand[index] as CardData);
                    modifiablePlayer.hand[index] = null;
                } else if (source === CardContext.EQUIPPED && index !== undefined) {
                    const equippedCard = modifiablePlayer.equippedItems[index];
                    // Persistent upgrades and satchels are not discarded by "playing" them
                    if (equippedCard.effect?.subtype !== 'storage' && equippedCard.type !== 'Player Upgrade' && !equippedCard.effect?.persistent) {
                        modifiablePlayer.equippedItems = modifiablePlayer.equippedItems.filter((_, i) => i !== index);
                        modifiablePlayer.playerDiscard.push(equippedCard);
                    } else if (equippedCard.type !== 'Player Upgrade' && !equippedCard.effect?.persistent) { // Non-upgrade, non-persistent items
                        modifiablePlayer.equippedItems = modifiablePlayer.equippedItems.filter((_, i) => i !== index);
                        modifiablePlayer.playerDiscard.push(equippedCard);
                    } else {
                         _log(`${equippedCard.name} is persistent or a storage item and is not discarded after use from equipped slot.`, 'debug');
                    }
                }
            } else if (card.effect?.type === 'trap' && source === CardContext.HAND && index !== undefined) {
                 // Trap was played from hand, remove from hand but don't discard (it's now activeTrap)
                 modifiablePlayer.hand[index] = null;
            }
            break;

        case 'EQUIP_ITEM':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (modifiablePlayer.hasEquippedThisTurn) { _log("Already equipped an item or upgrade this turn.", "error"); break; }
            if (modifiablePlayer.equippedItems.length >= modifiablePlayer.equipSlots) { _log("No empty equip slots.", "error"); break; }
            if (!card || (source === CardContext.HAND && modifiablePlayer.hand[index] === null)) {
                 _log("No card to equip in selected slot.", "error"); break;
            }

            modifiablePlayer.equippedItems.push(card);
            if (source === CardContext.HAND && index !== undefined) {
                modifiablePlayer.hand[index] = null;
            }
            _log(`${modifiablePlayer.name} equipped ${card.name}.`, 'action');
            modifiablePlayer.hasEquippedThisTurn = true;

            if (card.effect?.persistent && card.type === 'Player Upgrade') {
                const effect = card.effect;
                if (effect.subtype === 'max_health' && typeof effect.amount === 'number') {
                    modifiablePlayer.maxHealth += effect.amount;
                    modifiablePlayer.health += effect.amount;
                    _log(`${card.name} permanently increases Max HP by ${effect.amount}.`, 'info');
                }
                if (effect.subtype === 'storage' && typeof effect.capacity === 'number') {
                     _log(`${card.name} (Satchel) equipped, capacity: ${effect.capacity}.`, 'info');
                }
                if (effect.subtype === 'damage_negation') {
                    modifiablePlayer.hatDamageNegationAvailable = true;
                    if (typeof effect.max_health === 'number') {
                         modifiablePlayer.maxHealth += effect.max_health;
                         modifiablePlayer.health += effect.max_health;
                         _log(`${card.name} provides a one-time damage negation and +${effect.max_health} Max HP.`, 'info');
                    } else {
                        _log(`${card.name} provides a one-time damage negation.`, 'info');
                    }
                }
            }
            break;

        case 'STORE_PROVISION':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (!card || (source === CardContext.HAND && modifiablePlayer.hand[index] === null)) {
                 _log("No card to store in selected slot.", "error"); break;
            }
            const satchel = modifiablePlayer.equippedItems.find(item => item.effect?.subtype === 'storage');
            if (!satchel || !satchel.effect?.capacity) { _log("No satchel equipped or satchel has no capacity.", "error"); break; }
            if (modifiablePlayer.satchel.length >= satchel.effect.capacity) { _log("Satchel is full.", "error"); break; }

            modifiablePlayer.satchel.push(card);
            if (source === CardContext.HAND && index !== undefined) {
                 modifiablePlayer.hand[index] = null;
            }
            _log(`${modifiablePlayer.name} stored ${card.name} in satchel.`, 'action');
            break;

        case 'USE_FROM_SATCHEL':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (modifiablePlayer.satchel.length === 0) { _log("Satchel is empty.", "error"); break; }

            const itemToUseFromSatchel = payload.itemFromSatchel || modifiablePlayer.satchel[0];
            const itemIndexInSatchel = modifiablePlayer.satchel.findIndex(i => i.id === itemToUseFromSatchel.id);

            if (itemIndexInSatchel === -1) { _log("Selected item not found in satchel.", "error"); break; }

            if (itemToUseFromSatchel.id.startsWith('provision_laudanum')) {
                modifiableGameStateUpdates.laudanumVisualActive = true;
            }

            if (itemToUseFromSatchel.effect?.type === 'heal') {
                const healAmount = calculateHealAmount(itemToUseFromSatchel, modifiablePlayer);
                modifiablePlayer = applyHealToPlayer(modifiablePlayer, healAmount, itemToUseFromSatchel.name);
                 if (itemToUseFromSatchel.effect.cures) {
                    const activeIllness = initialGameState.activeEvent?.subType === 'illness' ? initialGameState.activeEvent : null;
                    if (activeIllness) {
                        _log(`${itemToUseFromSatchel.name} cures ${modifiablePlayer.name} of ${activeIllness.name}!`, 'info');
                        modifiableGameStateUpdates.eventDiscardPile = [...(initialGameState.eventDiscardPile || []), activeIllness];
                        modifiableGameStateUpdates.activeEvent = null;
                        triggerAnimation('player-border-pulse-green', 'player');
                    }
                }
            }
             else if (itemToUseFromSatchel.effect?.type === 'draw') {
                const cardsToDrawCountSatchel = itemToUseFromSatchel.effect.amount || 2;
                let actuallyDrawnCountSatchel = 0;
                let tempDeckSatchel = [...modifiablePlayer.playerDeck];
                let tempDiscardSatchel = [...modifiablePlayer.playerDiscard];
                let tempHandSatchel = [...modifiablePlayer.hand];

                for (let i = 0; i < cardsToDrawCountSatchel; i++) {
                    if (tempDeckSatchel.length === 0) {
                        if (tempDiscardSatchel.length > 0) {
                            tempDeckSatchel = shuffleArray(tempDiscardSatchel);
                            tempDiscardSatchel = [];
                        } else { break; }
                    }
                    let cardPlacedInHandSatchel = false;
                    for (let j = 0; j < modifiablePlayer.handSize; j++) {
                        if (tempHandSatchel[j] === null) {
                            const drawnCardSatchel = tempDeckSatchel.shift();
                            if (drawnCardSatchel) {
                                tempHandSatchel[j] = drawnCardSatchel;
                                actuallyDrawnCountSatchel++;
                                cardPlacedInHandSatchel = true;
                            }
                            break;
                        }
                    }
                    if (!cardPlacedInHandSatchel && tempDeckSatchel.length > 0) { break; }
                    if(tempDeckSatchel.length === 0 && i < cardsToDrawCountSatchel -1 && actuallyDrawnCountSatchel < cardsToDrawCountSatchel) { break; }
                }
                 if (actuallyDrawnCountSatchel > 0) {
                     modifiablePlayer.playerDeck = tempDeckSatchel;
                     modifiablePlayer.playerDiscard = tempDiscardSatchel;
                     modifiablePlayer.hand = tempHandSatchel;
                     modifiablePlayer.isUnsortedDraw = true;
                     _log(`${modifiablePlayer.name} uses ${itemToUseFromSatchel.name} from satchel to draw ${actuallyDrawnCountSatchel} card(s).`, 'action');
                 }
            }
            else {
                 _log(`Cannot use ${itemToUseFromSatchel.name} from satchel directly for its primary effect type: ${itemToUseFromSatchel.effect?.type}. Only Heal/Draw supported currently.`, 'error');
                 break;
            }
            modifiablePlayer.satchel.splice(itemIndexInSatchel, 1);
            modifiablePlayer.playerDiscard.push(itemToUseFromSatchel);
            break;

        case 'BUY_ITEM':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (initialGameState.blockTradeDueToHostileEvent) { _log("Cannot trade while hostile event is active!", "error"); break; }
            const buyCost = (card.buyCost || 0) * (initialGameState.ngPlusLevel > 0 ? 1 : 2);
            if (modifiablePlayer.gold < buyCost) { _log("Not enough gold.", "error"); break; }

            modifiablePlayer.gold -= buyCost;
            modifiablePlayer.playerDiscard.push(card);
            _log(`${modifiablePlayer.name} bought ${card.name} for ${buyCost} Gold. It's added to the discard pile.`, 'action');
            triggerGoldFlash(PLAYER_ID);

            const newStoreDisplay = [...initialGameState.storeDisplayItems];
            newStoreDisplay[index] = null;
            modifiableGameStateUpdates.storeDisplayItems = newStoreDisplay;

            if (storeCardReplacementTimeoutId) clearTimeout(storeCardReplacementTimeoutId);
            const timeoutId = setTimeout(() => {
                setGameState(prevGS => {
                    if (!prevGS) return null;
                    const refreshedStoreDisplay = [...prevGS.storeDisplayItems];
                    const refreshedStoreDeck = [...prevGS.storeItemDeck];
                    if (refreshedStoreDeck.length > 0 && refreshedStoreDisplay[index] === null) {
                        refreshedStoreDisplay[index] = refreshedStoreDeck.shift()!;
                        return { ...prevGS, storeDisplayItems: refreshedStoreDisplay, storeItemDeck: refreshedStoreDeck };
                    }
                    return prevGS;
                });
                setStoreCardReplacementTimeoutId(null);
            }, 1000) as unknown as number;
            setStoreCardReplacementTimeoutId(timeoutId);
            break;

        case 'SELL_FROM_HAND':
        case 'SELL_EQUIPPED':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (initialGameState.blockTradeDueToHostileEvent) { _log("Cannot trade while hostile event is active!", "error"); break; }
            if (!card || !card.sellValue || card.sellValue <= 0) { _log("This item cannot be sold or has no value.", "error"); break; }
             if (source === CardContext.HAND && (!card || modifiablePlayer.hand[index] === null)) {
                 _log("No card to sell in selected hand slot.", "error"); break;
             }

            let sellValue = card.sellValue;
            const treasureMap = modifiablePlayer.equippedItems.find(item => item.id === 'upgrade_treasure_map' && item.effect?.subtype === 'sell_boost');
            if (treasureMap && treasureMap.effect?.amount) {
                sellValue += treasureMap.effect.amount;
            }

            modifiablePlayer.gold += sellValue;
            _log(`${modifiablePlayer.name} sold ${card.name} for ${sellValue} Gold. Card removed from game.`, 'action');
            triggerGoldFlash(PLAYER_ID);

            // Card is removed from game, not added to discard
            if (source === CardContext.HAND && index !== undefined) {
                modifiablePlayer.hand[index] = null;
            } else if (source === CardContext.EQUIPPED && index !== undefined) {
                const soldEquippedItem = modifiablePlayer.equippedItems[index];
                modifiablePlayer.equippedItems = modifiablePlayer.equippedItems.filter((_, i) => i !== index);
                 if (soldEquippedItem.type === 'Player Upgrade' && soldEquippedItem.effect?.persistent) {
                    const effect = soldEquippedItem.effect;
                    if (effect.subtype === 'max_health' && typeof effect.amount === 'number') {
                        modifiablePlayer.maxHealth = Math.max(1, modifiablePlayer.maxHealth - effect.amount);
                        modifiablePlayer.health = Math.min(modifiablePlayer.health, modifiablePlayer.maxHealth);
                    }
                     if (effect.subtype === 'damage_negation') {
                        modifiablePlayer.hatDamageNegationAvailable = false;
                        if(typeof effect.max_health === 'number'){
                            modifiablePlayer.maxHealth = Math.max(1, modifiablePlayer.maxHealth - effect.max_health);
                            modifiablePlayer.health = Math.min(modifiablePlayer.health, modifiablePlayer.maxHealth);
                        }
                    }
                }
            }
            break;

        case 'TAKE_EVENT_ITEM':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (modifiablePlayer.hasTakenActionThisTurn) { _log("Already taken an action this turn.", "error"); break;}
            if (!initialGameState.activeEvent || initialGameState.activeEvent.type === 'Event') { _log("No item to take or it's a threat.", "error"); break; }

            modifiablePlayer.playerDiscard.push(initialGameState.activeEvent); // Directly to discard
            _log(`${modifiablePlayer.name} takes ${initialGameState.activeEvent.name}, adding it to their discard pile.`, 'action');

            triggerAnimation('event-item-taken', 'event');

            // Do not add to eventDiscardPile, it's now a player card
            // modifiableGameStateUpdates.eventDiscardPile = [...(initialGameState.eventDiscardPile || []), initialGameState.activeEvent];
            modifiableGameStateUpdates.activeEvent = null;
            modifiablePlayer.hasTakenActionThisTurn = true;
            modifiableGameStateUpdates.blockTradeDueToHostileEvent = false;
            break;

        case 'DISCARD_UPGRADE':
        case 'DISCARD_EQUIPPED_ITEM':
            if (modifiablePlayer.turnEnded) { _log("Turn already ended.", "error"); break; }
            if (index === undefined || !modifiablePlayer.equippedItems[index]) { _log("No item selected or invalid index.", "error"); break; }

            const itemToDiscard = modifiablePlayer.equippedItems[index];
            _log(`${modifiablePlayer.name} discards equipped ${itemToDiscard.name}.`, 'action');
            modifiablePlayer.equippedItems = modifiablePlayer.equippedItems.filter((_, i) => i !== index);
            modifiablePlayer.playerDiscard.push(itemToDiscard);

            if (itemToDiscard.type === 'Player Upgrade' && itemToDiscard.effect?.persistent) {
                 const effect = itemToDiscard.effect;
                 if (effect.subtype === 'max_health' && typeof effect.amount === 'number') {
                    modifiablePlayer.maxHealth = Math.max(1, modifiablePlayer.maxHealth - effect.amount);
                    modifiablePlayer.health = Math.min(modifiablePlayer.health, modifiablePlayer.maxHealth);
                    _log(`${itemToDiscard.name}'s persistent Max HP bonus removed.`, 'info');
                }
                 if (effect.subtype === 'storage') {
                     _log(`${itemToDiscard.name} (Satchel) discarded. Contents moved to discard pile.`, 'info');
                     modifiablePlayer.playerDiscard.push(...modifiablePlayer.satchel);
                     modifiablePlayer.satchel = [];
                 }
                 if (effect.subtype === 'damage_negation') {
                    modifiablePlayer.hatDamageNegationAvailable = false;
                    _log(`${itemToDiscard.name}'s damage negation effect removed.`, 'info');
                    if(typeof effect.max_health === 'number'){
                        modifiablePlayer.maxHealth = Math.max(1, modifiablePlayer.maxHealth - effect.max_health);
                        modifiablePlayer.health = Math.min(modifiablePlayer.health, modifiablePlayer.maxHealth);
                        _log(`${itemToDiscard.name}'s Max HP bonus removed.`, 'info');
                    }
                }
            }
            break;
        case 'CLEAR_PENDING_SKUNK_ANIMATION_FLAG':
             modifiableGameStateUpdates.pendingSkunkSprayAnimation = false;
             break;
        default:
            _log(`Unknown action type: ${actionType}`, 'error');
            return;
    }

    if (modifiablePlayer.isUnsortedDraw) {
        const actualCards = modifiablePlayer.hand.filter(c => c !== null) as CardData[];
        actualCards.sort((a, b) => getCardCategory(a) - getCardCategory(b) || a.name.localeCompare(b.name));

        const newHandConfiguration: (CardData | null)[] = new Array(modifiablePlayer.handSize).fill(null);
        for (let i = 0; i < actualCards.length; i++) {
            newHandConfiguration[i] = actualCards[i];
        }
        modifiablePlayer.hand = newHandConfiguration;
        modifiablePlayer.isUnsortedDraw = false;
    }

    const finalSelectedCardState = (actionType !== 'SHOW_MODAL' && !(actionType === 'USE_ITEM' && payload?.card?.effect?.type === 'scout')) ? null : initialGameState.selectedCard;

    setGameState(prevState => {
        if (!prevState) return null;
        const newState = {
            ...prevState,
            ...modifiableGameStateUpdates,
            playerDetails: {
                ...prevState.playerDetails,
                [PLAYER_ID]: modifiablePlayer
            },
            selectedCard: finalSelectedCardState !== undefined ? finalSelectedCardState : prevState.selectedCard,
        };
        if (newState.laudanumVisualActive && actionType.includes('USE')) {
            setTimeout(() => {
                setGameState(p => p ? { ...p, laudanumVisualActive: false } : null);
            }, LAUDANUM_VISUAL_DURATION);
        }
        return newState;
    });

  }, [_log, triggerGoldFlash, triggerAnimation, isEndingTurn, applyHealToPlayer, applyDamageAndGetAnimation, calculateHealAmount, calculateAttackPower, storeCardReplacementTimeoutId, triggerBanner]);


  const endTurnLogic = useCallback(async () => {
    if (!gameStateRef.current || isEndingTurn) return;
    setIsEndingTurn(true);
    setShowEndTurnFade(true);
    setGameState(prev => prev ? { ...prev, scrollAnimationPhase: 'fadingOutAndScrollingDown' } : null);


    await new Promise(resolve => setTimeout(resolve, 750));

    const initialTurnState = gameStateRef.current;
    if (!initialTurnState) {
        setIsEndingTurn(false);
        setShowEndTurnFade(false);
        setGameState(prev => prev ? { ...prev, scrollAnimationPhase: 'none' } : null);
        return;
    }

    let modifiablePlayer = { ...initialTurnState.playerDetails[PLAYER_ID] };
    modifiablePlayer.hatDamageNegationUsedThisTurn = false; // Reset for the new day/event processing
    let modifiableGameStateUpdates: Partial<GameState> = {};

    _log(`--- End of Day ${initialTurnState.turn} ---`, 'turn');

    let gameShouldEnd = false;
    let winReason = '';

    // Skunk, Thief, Vagabond end-of-turn attacks
    const endTurnAttackers = ['threat_skunk_', 'threat_thief_', 'threat_vagabond_'];
    if (initialTurnState.activeEvent && endTurnAttackers.some(prefix => initialTurnState.activeEvent!.id.startsWith(prefix)) && !initialTurnState.activeEventJustAttacked && (initialTurnState.activeEvent.health || 0) > 0) {
        const currentAttacker = initialTurnState.activeEvent;
        const isCampfireProtectiveForAttacker = modifiablePlayer.isCampfireActive && currentAttacker.subType === 'animal'; // Only skunk is animal here

        if (!isCampfireProtectiveForAttacker || currentAttacker.subType === 'human') { // Humans attack regardless of campfire
            _log(`${currentAttacker.name} ${currentAttacker.id.startsWith('threat_skunk_') ? 'sprays' : 'attacks'} as night falls!`, 'event');
            
            if (currentAttacker.id.startsWith('threat_skunk_')) {
                 modifiableGameStateUpdates.pendingSkunkSprayAnimation = true;
            } else {
                 triggerAnimation('player-area-shake-effect', 'player'); // Shake for human attacks
            }

            const attackerEffect = currentAttacker.effect;
            if (attackerEffect && attackerEffect.type === 'damage' && attackerEffect.amount) {
                const { updatedPlayer, animationDetails, hatDiscarded } = applyDamageAndGetAnimation(modifiablePlayer, attackerEffect.amount, currentAttacker.name, currentAttacker.id);
                modifiablePlayer = updatedPlayer;
                if (hatDiscarded) modifiablePlayer.playerDiscard.push(hatDiscarded);
                if (animationDetails) modifiableGameStateUpdates.pendingPlayerDamageAnimation = animationDetails;
                if (modifiablePlayer.health <= 0) {
                    gameShouldEnd = true;
                    winReason = `${modifiablePlayer.character?.name || 'Player'} succumbed to ${currentAttacker.name}.`;
                }
            }
            // These threats are removed after their end-of-turn attack
            modifiableGameStateUpdates.eventDiscardPile = [...(initialTurnState.eventDiscardPile || []), currentAttacker];
            modifiableGameStateUpdates.activeEvent = null;

        } else if (isCampfireProtectiveForAttacker) { // Skunk case with campfire
            _log(`The campfire keeps the ${currentAttacker.name} at bay.`, 'info');
            modifiableGameStateUpdates.eventDiscardPile = [...(initialTurnState.eventDiscardPile || []), currentAttacker];
            modifiableGameStateUpdates.activeEvent = null;
            _log(`${currentAttacker.name} is deterred by the campfire and wanders off.`, 'info');
        }
    }

    if (!gameShouldEnd) {
        const handCardCount = modifiablePlayer.hand.filter(c => c !== null).length;
        if (handCardCount > 0) {
            _log(`${modifiablePlayer.name} discards their hand at the end of the day.`, 'info');
            modifiablePlayer.hand.forEach(card => {
                if (card) modifiablePlayer.playerDiscard.push(card);
            });
            modifiablePlayer.hand = new Array(modifiablePlayer.handSize).fill(null);
        }
    }
    
    // Process fate of current day's activeEvent (specifically small animals running away)
    // This happens BEFORE new event card is drawn for next day.
    const eventBeingProcessedAtEndOfTurn = modifiableGameStateUpdates.activeEvent === undefined ? initialTurnState.activeEvent : modifiableGameStateUpdates.activeEvent;

    if (!gameShouldEnd && eventBeingProcessedAtEndOfTurn && eventBeingProcessedAtEndOfTurn.type === 'Event' && eventBeingProcessedAtEndOfTurn.subType === 'animal' && (eventBeingProcessedAtEndOfTurn.health || 0) > 0) {
        const animal = eventBeingProcessedAtEndOfTurn;
        if ((animal.health || 0) <= 4) { // Small animals (health <= 4)
            if (!initialTurnState.activeEventJustAttacked) { // Player did NOT attack it
                _log(`${animal.name} (Health <= 4) was not attacked and runs away at the end of the day.`, 'event');
                modifiableGameStateUpdates.eventDiscardPile = [...(initialTurnState.eventDiscardPile || []), animal];
                modifiableGameStateUpdates.activeEvent = null; // Clear the event
            } else {
                // Player DID attack it, and it survived. It stays active to potentially attack next turn.
                _log(`${animal.name} (Health <= 4) was attacked and survived. It remains hostile.`, 'event');
            }
        }
        // Medium (5-8 health) and Large (>8 health) animals remain active by default if not defeated.
        // Their attack logic is handled at the start of the new day.
    }


    if (!gameShouldEnd && (modifiableGameStateUpdates.activeEvent === undefined ? initialTurnState.activeEvent : modifiableGameStateUpdates.activeEvent) && (modifiableGameStateUpdates.activeEvent === undefined ? initialTurnState.activeEvent?.type !== 'Event' : modifiableGameStateUpdates.activeEvent?.type !== 'Event')) { // Item/Valuable in event slot not taken
        const nonEventCardLeft = modifiableGameStateUpdates.activeEvent === undefined ? initialTurnState.activeEvent : modifiableGameStateUpdates.activeEvent;
        _log(`${modifiablePlayer.name} did not take ${nonEventCardLeft!.name}. Moving it to the store deck.`, 'info');
        modifiableGameStateUpdates.storeItemDeck = [...(initialTurnState.storeItemDeck || []), nonEventCardLeft!];
        modifiableGameStateUpdates.activeEvent = null; // Clear from active event
    }


    modifiableGameStateUpdates.activeEventJustAttacked = false;
    let turnActuallyEndedByImmediateEvent = false;

    // --- New Event Card Drawing Logic (respecting campfire) ---
    if (!gameShouldEnd) {
        let currentActiveEventForNewDay = modifiableGameStateUpdates.activeEvent === undefined ? initialTurnState.activeEvent : modifiableGameStateUpdates.activeEvent;
        let currentEventDeck = [...(initialTurnState.eventDeck || [])];
        let currentEventDiscard = [...(initialTurnState.eventDiscardPile || [])];

        _log(`[Event Draw Debug] Before trap check. Active Event: ${currentActiveEventForNewDay?.id || 'None'}. Player Trap: ${modifiablePlayer.activeTrap?.id || 'None'}. Deck size: ${currentEventDeck.length}`, 'debug');

        if (!currentActiveEventForNewDay) { 
             modifiableGameStateUpdates.activeEventTurnCounter = 0;
            if (modifiablePlayer.activeTrap && currentEventDeck.length > 0) {
                const trap = modifiablePlayer.activeTrap;
                const potentialEvent = currentEventDeck[0];
                _log(`[Event Draw Debug] Trap is active: ${trap.id}. Potential next event: ${potentialEvent.id}`, 'debug');

                if (potentialEvent.type === 'Event' && (potentialEvent.subType === 'animal' || potentialEvent.subType === 'human')) {
                    let caught = false;
                    const targetHealth = potentialEvent.health || 0;
                    const trapSize = trap.effect?.size;
                    let trapThreshold = 0;
                    if (trapSize === 'small') trapThreshold = 4;
                    else if (trapSize === 'medium') trapThreshold = 6;
                    else if (trapSize === 'large') trapThreshold = 8;

                    if (potentialEvent.subType === 'animal' && targetHealth <= trapThreshold) {
                        caught = true;
                    }

                    if (caught) {
                        _log(`${modifiablePlayer.name}'s ${trap.name} caught the ${potentialEvent.name}!`, 'event');
                        triggerBanner(`${potentialEvent.name} Defeated!`, 'threat_defeated');
                        const trophyCard = createTrophyOrBountyCard(potentialEvent);
                        modifiablePlayer.playerDiscard.push(trophyCard);
                         if (trophyCard.sellValue && trophyCard.sellValue > 0) {
                             _log(`${trophyCard.name} (Value: ${trophyCard.sellValue}G) added to discard.`, 'gold');
                         } else {
                            _log(`${trophyCard.name} added to discard.`, 'info');
                         }
                        triggerAnimation('event-trapped-small', 'threat');
                        currentEventDiscard.push(currentEventDeck.shift()!);
                        modifiableGameStateUpdates.eventDeck = currentEventDeck;
                        modifiableGameStateUpdates.eventDiscardPile = currentEventDiscard;
                        currentActiveEventForNewDay = null; 
                    } else if (trap.effect?.breakDamage && trap.effect.breakDamage > 0) {
                        _log(`${potentialEvent.name} is too strong or unsuitable for the ${trap.name}! The trap breaks, dealing ${trap.effect.breakDamage} damage.`, 'event');
                        
                        let updatedTargetEvent = {...potentialEvent};
                        updatedTargetEvent.health = Math.max(0, targetHealth - trap.effect.breakDamage);
                        
                        triggerAnimation('threat-card-shake-damage-bg', 'threat');
                        
                        if (updatedTargetEvent.health <= 0) {
                            _log(`${potentialEvent.name} was defeated by the breaking trap!`, 'event');
                            triggerBanner(`${potentialEvent.name} Defeated!`, 'threat_defeated');
                            const trophyCard = createTrophyOrBountyCard(potentialEvent); // original for bounty
                            modifiablePlayer.playerDiscard.push(trophyCard);
                            currentEventDiscard.push(currentEventDeck.shift()!); // Remove original from deck
                            currentActiveEventForNewDay = null; // No active event
                        } else {
                             // Event survives, stays at top of deck
                             currentEventDeck[0] = updatedTargetEvent; 
                             _log(`${potentialEvent.name} now has ${updatedTargetEvent.health} health.`, 'event');
                        }
                        modifiableGameStateUpdates.eventDeck = currentEventDeck;
                        modifiableGameStateUpdates.eventDiscardPile = currentEventDiscard;

                    } else {
                         _log(`${potentialEvent.name} is too strong or unsuitable and breaks/avoids the ${trap.name} without dealing damage.`, 'event');
                    }
                } else if (potentialEvent.type !== 'Event' || (potentialEvent.subType !== 'animal' && potentialEvent.subType !== 'human')) {
                     _log(`The ${trap.name} is not triggered by ${potentialEvent.name} (not an animal or human threat).`, 'info');
                }
                modifiablePlayer.playerDiscard.push(trap); 
                modifiablePlayer.activeTrap = null;
            }
            _log(`[Event Draw Debug] After trap. Active Event: ${currentActiveEventForNewDay?.id || 'None'}. Campfire: ${modifiablePlayer.isCampfireActive}. Deck: ${currentEventDeck.length}`, 'debug');

            // Check again if slot is empty AND if campfire is NOT active
            if (currentActiveEventForNewDay === null && !modifiablePlayer.isCampfireActive) {
                currentEventDeck = modifiableGameStateUpdates.eventDeck || currentEventDeck;
                currentEventDiscard = modifiableGameStateUpdates.eventDiscardPile || currentEventDiscard;

                if (currentEventDeck.length === 0 && currentEventDiscard.length > 0) {
                    _log("Reshuffling event discard into event deck.", "debug");
                    currentEventDeck = shuffleArray(currentEventDiscard.filter(c => c.id !== initialTurnState.aiBoss?.id)); // Ensure AI boss isn't reshuffled
                    currentEventDiscard = [];
                }

                if (currentEventDeck.length > 0) {
                    const newEvent = currentEventDeck.shift()!;
                    _log(`[Event Draw Debug] Drawing new event: ${newEvent.id}`, 'debug');
                    modifiableGameStateUpdates.activeEvent = newEvent; 
                    currentActiveEventForNewDay = newEvent; 

                    const { updatedPlayer: playerAfterImmediateEvent, turnEndedByEvent, gameShouldEnd: endAfterImmediate, eventRemoved, winReason: reasonAfterImmediate, damageInfo: immediateDamageInfo, hatDiscarded: hatFromImmediateEvent } = applyImmediateEventAndCheckEndTurn(newEvent, modifiablePlayer, _log, applyDamageAndGetAnimation);
                    modifiablePlayer = playerAfterImmediateEvent;
                    if (hatFromImmediateEvent) modifiablePlayer.playerDiscard.push(hatFromImmediateEvent); // Handle hat discard from immediate event
                    if (immediateDamageInfo) modifiableGameStateUpdates.pendingPlayerDamageAnimation = immediateDamageInfo;

                    turnActuallyEndedByImmediateEvent = turnEndedByEvent;

                    if (endAfterImmediate) {
                        gameShouldEnd = true;
                        winReason = reasonAfterImmediate || winReason;
                    }
                    if (eventRemoved) {
                        currentEventDiscard.push(newEvent);
                        modifiableGameStateUpdates.activeEvent = null;
                        currentActiveEventForNewDay = null; 
                        modifiableGameStateUpdates.activeEventTurnCounter = 0;
                    } else {
                        modifiableGameStateUpdates.activeEventTurnCounter = 1; 
                    }
                     if (newEvent.id === 'threat_lightning_strike') modifiableGameStateUpdates.showLightningStrikeFlash = true;
                } else if (initialTurnState.aiBoss && localStorage.getItem('aiBossDefeated_WWS') !== 'true') { // Deck empty, time for boss
                    _log("The air grows cold... the final confrontation is at hand!", "event");
                    modifiableGameStateUpdates.activeEvent = initialTurnState.aiBoss;
                    currentActiveEventForNewDay = initialTurnState.aiBoss;
                    modifiableGameStateUpdates.activeEventTurnCounter = 1;
                } else if (modifiablePlayer.health > 0) { // Deck empty, boss defeated or N/A
                    gameShouldEnd = true;
                    winReason = `${modifiablePlayer.character?.name || 'The adventurer'} has conquered the frontier!`;
                }
                modifiableGameStateUpdates.eventDeck = currentEventDeck;
                modifiableGameStateUpdates.eventDiscardPile = currentEventDiscard;

            } else if (modifiablePlayer.isCampfireActive && currentActiveEventForNewDay === null) {
                 _log("The campfire keeps the wilderness quiet for the night. No new event.", "info");
                  modifiableGameStateUpdates.activeEventTurnCounter = 0;
            }
        } else { // An event was already active from previous turn and carried over
            _log(`[Event Draw Debug] Event ${currentActiveEventForNewDay?.id} carried over.`, 'debug');
            if (initialTurnState.activeEvent?.id === currentActiveEventForNewDay?.id) {
                 modifiableGameStateUpdates.activeEventTurnCounter = (initialTurnState.activeEventTurnCounter || 0) + 1;
            } else { 
                 modifiableGameStateUpdates.activeEventTurnCounter = 1;
            }
        }
        _log(`[Event Draw Debug] End of new event draw logic. Final Active Event for new day: ${currentActiveEventForNewDay?.id || 'None'}. Turn counter: ${modifiableGameStateUpdates.activeEventTurnCounter}`, 'debug');

        // Start of New Day Animal Attacks (for carried-over or newly persisting animals)
        if (!gameShouldEnd && currentActiveEventForNewDay && currentActiveEventForNewDay.type === 'Event' && currentActiveEventForNewDay.subType === 'animal' && (currentActiveEventForNewDay.health || 0) > 0 && !modifiablePlayer.isCampfireActive) {
            const animal = currentActiveEventForNewDay;
            let animalShouldAttack = false;
            const isCarriedOverEvent = initialTurnState.activeEvent?.id === animal.id;
            const effectiveTurnCounterForAttackCheck = modifiableGameStateUpdates.activeEventTurnCounter !== undefined ? modifiableGameStateUpdates.activeEventTurnCounter : (isCarriedOverEvent ? (initialTurnState.activeEventTurnCounter || 0) +1 : 1);


            if ((animal.health || 0) <= 4) { 
                if (isCarriedOverEvent && initialTurnState.activeEventJustAttacked) {
                    animalShouldAttack = true;
                    _log(`${animal.name} (Small, was attacked last turn) retaliates!`, 'event');
                }
            } else if ((animal.health || 0) > 4 && (animal.health || 0) <= 8 && !animal.id.startsWith('threat_skunk')) { 
                if (effectiveTurnCounterForAttackCheck === 2) { 
                    animalShouldAttack = true;
                    _log(`${animal.name} (Medium, start of 2nd turn active) attacks!`, 'event');
                }
            } else if ((animal.health || 0) > 8) { 
                 if (isCarriedOverEvent && !initialTurnState.activeEventJustAttacked) {
                    animalShouldAttack = true;
                    _log(`${animal.name} (Large, not attacked last turn) continues its assault!`, 'event');
                }
            }

            if (animalShouldAttack && animal.effect?.type === 'damage' && (animal.effect.amount || 0) > 0) {
                const { updatedPlayer, animationDetails, hatDiscarded } = applyDamageAndGetAnimation(modifiablePlayer, animal.effect.amount || 0, animal.name, animal.id);
                modifiablePlayer = updatedPlayer;
                if (hatDiscarded) modifiablePlayer.playerDiscard.push(hatDiscarded);
                if (animationDetails) modifiableGameStateUpdates.pendingPlayerDamageAnimation = animationDetails; 
                triggerAnimation('player-area-shake-effect', 'player');
                if (modifiablePlayer.health <= 0) {
                    gameShouldEnd = true;
                    winReason = `${modifiablePlayer.character?.name || 'Player'} was defeated by ${animal.name}.`;
                }
            }
        }
    }
    
    // Waterskin Canteen heal at end of turn if equipped
    if (!gameShouldEnd && modifiablePlayer.health > 0) {
        const waterskin = modifiablePlayer.equippedItems.find(item => item.id === 'upgrade_waterskin_canteen_t1');
        if (waterskin && waterskin.effect?.type === 'heal' && waterskin.effect.amount) {
            modifiablePlayer = applyHealToPlayer(modifiablePlayer, waterskin.effect.amount, waterskin.name);
        }
    }
    
    // Campfire (no heal, just consumption)
    if (modifiablePlayer.isCampfireActive) { // No longer heals
        modifiablePlayer.isCampfireActive = false;
        _log("The campfire fades to embers.", 'info');
    }
    
    if (localStorage.getItem('aiBossDefeated_WWS') === 'true' && modifiablePlayer.health > 0 && !gameShouldEnd) {
        gameShouldEnd = true;
        winReason = `${modifiablePlayer.character?.name || 'The adventurer'} defeated ${initialTurnState.aiBoss?.name || 'the ultimate evil'}!`;
    }

    if (gameShouldEnd) {
        modifiableGameStateUpdates.status = 'finished';
        modifiableGameStateUpdates.winReason = winReason;
        _log(winReason, 'system');
        if (modifiablePlayer.health > 0) {
            localStorage.setItem('ngPlusLevel_WWS', (initialTurnState.ngPlusLevel + 1).toString());
            localStorage.setItem('ngPlusPlayerGold_WWS', modifiablePlayer.gold.toString());
            const deckToCarryOver = [...modifiablePlayer.playerDeck, ...modifiablePlayer.playerDiscard, ...modifiablePlayer.hand.filter(c => c !== null) as CardData[]];
            localStorage.setItem('wildWestWinDeck_WWS', JSON.stringify(deckToCarryOver.map(c => c.id)));
            localStorage.setItem('wildWestEquipped_WWS', JSON.stringify(modifiablePlayer.equippedItems.map(c => c.id)));
        } else { // Player lost
            localStorage.setItem('ngPlusLevel_WWS', '0');
            localStorage.removeItem('ngPlusPlayerGold_WWS');
            localStorage.removeItem('wildWestWinDeck_WWS');
            localStorage.removeItem('wildWestEquipped_WWS');
            localStorage.removeItem('aiBossDefeated_WWS');
            // NG+ Themed Set clear
            const ngPlusMilestone = Math.floor(initialTurnState.ngPlusLevel / NG_PLUS_THEME_MILESTONE_INTERVAL) * NG_PLUS_THEME_MILESTONE_INTERVAL;
            if (ngPlusMilestone > 0) {
                localStorage.removeItem(`ngPlusThemeSet_${ngPlusMilestone}_WWS`);
            }
            // Clear active game banner and pending damage animation on defeat
            modifiableGameStateUpdates.activeGameBanner = null;
            modifiableGameStateUpdates.pendingPlayerDamageAnimation = null;
            if (bannerTimeoutRef.current) {
                clearTimeout(bannerTimeoutRef.current);
                bannerTimeoutRef.current = null;
            }
            if (autoEndTurnTimerRef.current) {
                clearTimeout(autoEndTurnTimerRef.current);
                autoEndTurnTimerRef.current = null;
            }
        }

    } else { // Game not ending, proceed to new day setup
        let cardsToDrawForNewDay = modifiablePlayer.handSize;
        let newDayDrawnCount = 0;
        let tempDeckNewDay = [...modifiablePlayer.playerDeck];
        let tempDiscardNewDay = [...modifiablePlayer.playerDiscard];
        let tempHandNewDay: (CardData | null)[] = new Array(modifiablePlayer.handSize).fill(null);


        for (let i = 0; i < cardsToDrawForNewDay; i++) {
            if (tempDeckNewDay.length === 0) {
                if (tempDiscardNewDay.length > 0) {
                    _log("Reshuffling player discard into deck.", "debug");
                    tempDeckNewDay = shuffleArray(tempDiscardNewDay);
                    tempDiscardNewDay = [];
                } else {
                    _log("Player deck empty, cannot draw more cards for new day.", "info");
                    break;
                }
            }

            let cardPlacedInNewDayHand = false;
            for (let j = 0; j < modifiablePlayer.handSize; j++) {
                if (tempHandNewDay[j] === null) { // Find first empty slot
                    const drawnCardForNewDay = tempDeckNewDay.shift();
                    if (drawnCardForNewDay) {
                        tempHandNewDay[j] = drawnCardForNewDay;
                        newDayDrawnCount++;
                        cardPlacedInNewDayHand = true;
                    }
                    break; 
                }
            }
             if (!cardPlacedInNewDayHand && tempDeckNewDay.length > 0) { // Hand full
                 break;
             }
        }
        if (newDayDrawnCount > 0) {
            _log(`Drawing ${newDayDrawnCount} cards for the new day.`, "info");
            modifiablePlayer.playerDeck = tempDeckNewDay;
            modifiablePlayer.playerDiscard = tempDiscardNewDay;
            modifiablePlayer.hand = tempHandNewDay; // Assign the newly constructed hand
            modifiablePlayer.isUnsortedDraw = true; // Flag for sorting
        } else {
             _log("No cards drawn for the new day (deck/discard empty or hand full).", "info");
             modifiablePlayer.hand = tempHandNewDay; // Ensure hand is at least empty if no cards drawn
        }
    }


    if (!gameShouldEnd) {
        modifiablePlayer.hasEquippedThisTurn = false;
        modifiablePlayer.turnEnded = false;
        modifiablePlayer.hasTakenActionThisTurn = false;
        modifiablePlayer.hasRestockedThisTurn = false;
        modifiableGameStateUpdates.turn = initialTurnState.turn + 1;
        _log(`--- Day ${initialTurnState.turn + 1} ---`, 'turn');
        modifiableGameStateUpdates.scrollAnimationPhase = 'fadingInAndScrollingUp';
    } else {
        modifiableGameStateUpdates.scrollAnimationPhase = 'none'; // No scroll up if game ends
    }

    if (modifiablePlayer.isUnsortedDraw) {
        const actualCards = modifiablePlayer.hand.filter(c => c !== null) as CardData[];
        actualCards.sort((a, b) => getCardCategory(a) - getCardCategory(b) || a.name.localeCompare(b.name));

        const newHandConfiguration: (CardData | null)[] = new Array(modifiablePlayer.handSize).fill(null);
        for (let i = 0; i < actualCards.length; i++) {
            newHandConfiguration[i] = actualCards[i];
        }
        modifiablePlayer.hand = newHandConfiguration;
        modifiablePlayer.isUnsortedDraw = false;
    }

    const finalEventForBlockTrade = modifiableGameStateUpdates.activeEvent === undefined ? initialTurnState.activeEvent : modifiableGameStateUpdates.activeEvent;
    modifiableGameStateUpdates.blockTradeDueToHostileEvent = isEventConsideredHostile(finalEventForBlockTrade);


    setGameState(prevState => {
        if (!prevState) return null;
        return {
            ...prevState,
            ...modifiableGameStateUpdates,
            playerDetails: {
                ...prevState.playerDetails,
                [PLAYER_ID]: modifiablePlayer
            }
        };
    });

    setShowEndTurnFade(false);
    setIsEndingTurn(false);

    setTimeout(() => {
      setGameState(prev => {
        if (!prev) return null;
        let nextState = {...prev};
        if (nextState.showLightningStrikeFlash) nextState.showLightningStrikeFlash = false;
        if (nextState.pendingPlayerDamageAnimation && !gameShouldEnd) nextState.pendingPlayerDamageAnimation = null; // Clear if game not ending
        else if (gameShouldEnd) nextState.pendingPlayerDamageAnimation = null; // Always clear if game ended
        
        if (nextState.scrollAnimationPhase === 'fadingInAndScrollingUp' || gameShouldEnd) {
             nextState.scrollAnimationPhase = 'none'; // Reset after scroll or if game ended
        }
        return nextState;
      });
    }, 500);

  }, [isEndingTurn, _log, applyDamageAndGetAnimation, applyImmediateEventAndCheckEndTurn, applyHealToPlayer, triggerGoldFlash, triggerAnimation, triggerBanner]);


  const endTurn = () => {
    if (!isEndingTurn) {
      endTurnLogic();
    }
  };

  const selectCharacter = useCallback((character: Character) => {
    setGameState(prev => {
      if (!prev || prev.status !== 'setup') return prev;

      let currentNGPlusLevel = prev.ngPlusLevel;
      let baseHealth = character.health;
      if (currentNGPlusLevel >= NG_PLUS_PLAYER_HEALTH_BOOST_INTERVAL) {
          const numBoosts = Math.floor(currentNGPlusLevel / NG_PLUS_PLAYER_HEALTH_BOOST_INTERVAL);
          baseHealth += numBoosts * NG_PLUS_PLAYER_HEALTH_BOOST_AMOUNT;
      }
      const ngPlusAdjustedHealth = Math.max(1, baseHealth - currentNGPlusLevel);


      const starterCards = character.starterDeck
        .map(id => CURRENT_CARDS_DATA[id])
        .filter(Boolean) as CardData[];

      const initialHandWithNulls: (CardData | null)[] = new Array(HAND_LIMIT).fill(null);

      const updatedPlayerDetails: PlayerDetails = {
        ...INITIAL_PLAYER_STATE_TEMPLATE,
        name: prev.playerDetails[PLAYER_ID]?.name || null,
        character: character,
        health: ngPlusAdjustedHealth,
        maxHealth: ngPlusAdjustedHealth,
        gold: character.gold,
        playerDeck: [...starterCards],
        hand: initialHandWithNulls,
        ngPlusLevel: currentNGPlusLevel,
        handSize: HAND_LIMIT,
        equipSlots: EQUIP_LIMIT,
      };
       _log(`${character.name} selected. Base Health: ${character.health}, NG+ Adjusted Max Health: ${ngPlusAdjustedHealth}, Gold: ${character.gold}. NG+${currentNGPlusLevel}`, 'system');
      return {
        ...prev,
        playerDetails: { [PLAYER_ID]: updatedPlayerDetails }
      };
    });
  }, [_log]);


  const confirmName = useCallback((name: string) => {
    setGameState(prev => {
      if (!prev || prev.status !== 'setup') return prev;
       _log(`Character name set to: ${name}.`, 'system');
      return {
        ...prev,
        playerDetails: {
          ...prev.playerDetails,
          [PLAYER_ID]: { ...prev.playerDetails[PLAYER_ID], name }
        }
      };
    });
  }, [_log]);


  const loadInitialState = useCallback(async (isNewGamePlusContinue = false) => {
    _log("Setting up a new adventure...", "system");

    let currentNGPlusLevel = 0;
    let carriedOverGold: number | null = null;
    let loadedPlayerCharacterForNGPlus: Character | null = null;
    let loadedPlayerNameForNGPlus: string | null = null;

    if (isNewGamePlusContinue) {
        currentNGPlusLevel = parseInt(localStorage.getItem('ngPlusLevel_WWS') || '0');
        carriedOverGold = parseInt(localStorage.getItem('ngPlusPlayerGold_WWS') || '0');
        // For NG+ boss generation, we need player character details if available
        const savedPlayerDetailsString = localStorage.getItem('wildWestPlayerDetailsForNGPlus_WWS');
        if (savedPlayerDetailsString) {
            try {
                const savedPlayerDetails: { name: string, characterId: string } = JSON.parse(savedPlayerDetailsString);
                loadedPlayerNameForNGPlus = savedPlayerDetails.name;
                loadedPlayerCharacterForNGPlus = CHARACTERS_DATA_MAP[savedPlayerDetails.characterId] || null;
            } catch (e) {
                 _log("Error parsing NG+ player details for boss generation.", "error");
            }
        }
        _log(`Continuing from NG+${currentNGPlusLevel}. Gold: ${carriedOverGold}`, "system");
    } else {
         localStorage.setItem('ngPlusLevel_WWS', '0');
         localStorage.removeItem('ngPlusPlayerGold_WWS');
         localStorage.removeItem('wildWestWinDeck_WWS');
         localStorage.removeItem('wildWestEquipped_WWS');
         localStorage.removeItem('aiBossDefeated_WWS');
         localStorage.removeItem('wildWestPlayerDetailsForNGPlus_WWS');
         // Clear any themed sets from previous NG+ runs if starting fresh
         Object.keys(localStorage).forEach(key => {
            if (key.startsWith('ngPlusThemeSet_') && key.endsWith('_WWS')) {
                localStorage.removeItem(key);
            }
         });
    }

    // NG+ Card Scaling/Remixing Logic
    if (currentNGPlusLevel === 0) {
        resetCurrentCardsData();
    } else {
        const currentMilestone = Math.floor((currentNGPlusLevel -1) / NG_PLUS_THEME_MILESTONE_INTERVAL) * NG_PLUS_THEME_MILESTONE_INTERVAL;
        const isAtNewMilestone = currentNGPlusLevel > 0 && currentNGPlusLevel % NG_PLUS_THEME_MILESTONE_INTERVAL === 0;
        let themedSetKey = '';
        if (currentMilestone > 0) { // Only use themed set if past the first milestone (e.g. NG+10, NG+20)
            themedSetKey = `ngPlusThemeSet_${currentMilestone}_WWS`;
        }
        
        let baseCardsForThisRun: { [id: string]: CardData } | null = null;

        if (isAtNewMilestone) { // At NG+10, NG+20, etc. -> Attempt AI Remix
            _log(`Reached NG+${currentNGPlusLevel}, a new theme milestone. Attempting AI card remix.`, "system");
            try {
                const remixedCards = await remixCardsForNGPlusGame(_log, ALL_CARDS_DATA_MAP, currentNGPlusLevel);
                if (remixedCards) {
                    baseCardsForThisRun = remixedCards;
                    localStorage.setItem(`ngPlusThemeSet_${currentNGPlusLevel}_WWS`, JSON.stringify(remixedCards));
                    _log(`AI-remixed cards for NG+${currentNGPlusLevel} saved as new theme.`, "system");
                } else {
                    _log(`AI remix failed for NG+${currentNGPlusLevel}. Applying manual scaling from absolute base.`, "error");
                    baseCardsForThisRun = applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, currentNGPlusLevel);
                }
            } catch (error) {
                console.error(`Error during NG+${currentNGPlusLevel} card remixing:`, error);
                _log(`Error during NG+${currentNGPlusLevel} card remixing. Applying manual scaling from absolute base.`, "error");
                baseCardsForThisRun = applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, currentNGPlusLevel);
            }
        } else if (themedSetKey && localStorage.getItem(themedSetKey)) { // Between milestones, use stored theme
             _log(`Loading themed card set from NG+${currentMilestone} for current NG+${currentNGPlusLevel}.`, "system");
             try {
                const storedThemedSet = JSON.parse(localStorage.getItem(themedSetKey)!);
                const increment = currentNGPlusLevel - currentMilestone;
                baseCardsForThisRun = applyIncrementalNGPlusScaling(storedThemedSet, increment);
                 _log(`Applied +${increment} incremental scaling to NG+${currentMilestone} themed set.`, "system");
             } catch (e) {
                _log(`Error loading or scaling stored theme set ${themedSetKey}. Applying manual scaling from absolute base.`, "error");
                baseCardsForThisRun = applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, currentNGPlusLevel);
             }
        } else { // No stored theme, or before first milestone with AI remix (e.g. NG+1 to NG+9)
            _log(`Applying manual scaling for NG+${currentNGPlusLevel} from absolute base.`, "system");
            baseCardsForThisRun = applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, currentNGPlusLevel);
        }
        updateCurrentCardsData(baseCardsForThisRun!);
    }


    let finalBossForGame: CardData | null = preGeneratedAiBoss;
    if (!finalBossForGame || finalBossForGame.id === 'default_boss' || finalBossForGame.id === 'default_boss_fallback' || currentNGPlusLevel > 0) {
        finalBossForGame = await generateAIBossForGame(_log, loadedPlayerCharacterForNGPlus, loadedPlayerNameForNGPlus);
    }
    if (!finalBossForGame) finalBossForGame = await generateAIBossForGame(_log, loadedPlayerCharacterForNGPlus, loadedPlayerNameForNGPlus);


    let availableCardsPool = Object.values(CURRENT_CARDS_DATA);
    if (finalBossForGame) {
        availableCardsPool = availableCardsPool.filter(c => c.id !== finalBossForGame!.id);
    }

    const allStarterCardIds = new Set<string>();
    Object.values(CHARACTERS_DATA_MAP).forEach(char => {
        char.starterDeck.forEach(id => allStarterCardIds.add(id));
    });
    availableCardsPool = availableCardsPool.filter(card => !allStarterCardIds.has(card.id));


    let eventDeckInProgress: CardData[] = [];

    let animalThreatsPool = availableCardsPool.filter(c => c.type === 'Event' && c.subType === 'animal');
    if (currentNGPlusLevel === 0) {
        animalThreatsPool.sort((a, b) => (a.health || 0) - (b.health || 0));
    } else {
        animalThreatsPool = shuffleArray(animalThreatsPool);
    }
    const { picked: selectedAnimalThreats, remainingPool: poolAfterAnimals } = pickRandomDistinctFromPool(animalThreatsPool, 8);
    eventDeckInProgress.push(...selectedAnimalThreats);
    availableCardsPool = poolAfterAnimals.concat(availableCardsPool.filter(c => !(c.type === 'Event' && c.subType === 'animal')));


    let humanThreatsPool = availableCardsPool.filter(c => c.type === 'Event' && c.subType === 'human');
     if (currentNGPlusLevel === 0) {
        humanThreatsPool.sort((a,b) => (a.health || 0) - (b.health || 0));
    } else {
        humanThreatsPool = shuffleArray(humanThreatsPool);
    }
    const { picked: selectedHumanThreats, remainingPool: poolAfterHumans } = pickRandomDistinctFromPool(humanThreatsPool, 7);
    eventDeckInProgress.push(...selectedHumanThreats);
    availableCardsPool = poolAfterHumans.concat(availableCardsPool.filter(c => !(c.type === 'Event' && c.subType === 'human')));


    let naturalThreatsPool = availableCardsPool.filter(c => c.type === 'Event' && (c.subType === 'illness' || c.subType === 'environmental'));
    const { picked: selectedNaturalThreats, remainingPool: poolAfterNatural } = pickRandomDistinctFromPool(naturalThreatsPool, 2);
    eventDeckInProgress.push(...selectedNaturalThreats);
    availableCardsPool = poolAfterNatural.concat(availableCardsPool.filter(c => !(c.type === 'Event' && (c.subType === 'illness' || c.subType === 'environmental'))));


    const numValuablesForEvent = Math.min(3, Math.floor(Math.random() * 4));
    let eventValuablesPool = availableCardsPool.filter(c => c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry'));
    const { picked: selectedEventValuables, remainingPool: poolAfterEventValuables } = pickRandomDistinctFromPool(eventValuablesPool, numValuablesForEvent);
    eventDeckInProgress.push(...selectedEventValuables);
    availableCardsPool = poolAfterEventValuables.concat(availableCardsPool.filter(c => !(c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry'))));


    const itemsNeededForEvent = Math.max(0, EVENT_DECK_SIZE - eventDeckInProgress.length);
    let eventItemsPool = availableCardsPool.filter(c =>
        c.type !== 'Event' &&
        !(c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry')) &&
        !allStarterCardIds.has(c.id)
    );
    const { picked: selectedEventItems, remainingPool: poolAfterEventItems } = pickRandomDistinctFromPool(eventItemsPool, itemsNeededForEvent);
    eventDeckInProgress.push(...selectedEventItems);
    availableCardsPool = poolAfterEventItems.concat(availableCardsPool.filter(c => c.type === 'Event' || (c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry')) || allStarterCardIds.has(c.id) ));

    const finalEventDeck = shuffleArray(eventDeckInProgress.slice(0, EVENT_DECK_SIZE));

    let playerDeckAugmentationCards: CardData[] = [];

    const numValuablesForPlayer = Math.min(2, Math.floor(Math.random() * 3));
    let playerValuablesPool = availableCardsPool.filter(c => c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry')); 
    const { picked: selectedPlayerValuables, remainingPool: poolAfterPlayerValuables } = pickRandomDistinctFromPool(playerValuablesPool, numValuablesForPlayer);
    playerDeckAugmentationCards.push(...selectedPlayerValuables);
    availableCardsPool = poolAfterPlayerValuables.concat(availableCardsPool.filter(c => !(c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry'))));


    const itemsNeededForPlayerAugmentation = Math.max(0, (PLAYER_DECK_TARGET_SIZE - 4) - playerDeckAugmentationCards.length); 
    let playerItemsPool = availableCardsPool.filter(c =>
        c.type !== 'Event' &&
        !(c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry')) &&
        !allStarterCardIds.has(c.id)
    );
    const { picked: selectedPlayerItems, remainingPool: poolAfterPlayerItems } = pickRandomDistinctFromPool(playerItemsPool, itemsNeededForPlayerAugmentation);
    playerDeckAugmentationCards.push(...selectedPlayerItems);
    availableCardsPool = poolAfterPlayerItems.concat(availableCardsPool.filter(c => c.type === 'Event' || (c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry')) || allStarterCardIds.has(c.id) ));


    let storeCandidates = availableCardsPool.filter(c =>
        c.type !== 'Event' &&
        c.buyCost && c.buyCost > 0 &&
        !(c.id.startsWith('item_gold_nugget') || c.id.startsWith('item_jewelry')) &&
        !allStarterCardIds.has(c.id)
    );
    let fullStoreItemPool = shuffleArray(storeCandidates);
    let storeItemDeckForGame = fullStoreItemPool.slice(0, STORE_DECK_TARGET_SIZE);
    const storeDisplayItems = storeItemDeckForGame.splice(0, Math.min(STORE_DISPLAY_LIMIT, storeItemDeckForGame.length));

    const initialPlayerState: PlayerDetails = {
        ...INITIAL_PLAYER_STATE_TEMPLATE,
        ngPlusLevel: currentNGPlusLevel,
        hand: new Array(HAND_LIMIT).fill(null),
        gold: carriedOverGold !== null ? carriedOverGold : INITIAL_PLAYER_STATE_TEMPLATE.gold,
     };

    const initialLog = isNewGamePlusContinue && gameStateRef.current?.log ? gameStateRef.current.log.slice(0, MAX_PERSISTED_LOG_ENTRIES) : [];
     if(isNewGamePlusContinue && initialLog.length === 0 && gameStateRef.current?.log && gameStateRef.current.log.length > 0) {
        initialLog.push(...(gameState?.log || []).slice(0, MAX_PERSISTED_LOG_ENTRIES));
    }


    setGameState({
      status: 'setup',
      playerDetails: { [PLAYER_ID]: initialPlayerState },
      eventDeck: finalEventDeck,
      eventDiscardPile: [],
      activeEvent: null,
      activeEventTurnCounter: 0,
      storeItemDeck: storeItemDeckForGame,
      storeDisplayItems,
      storeItemDiscardPile: [],
      turn: 1,
      storyGenerated: false,
      log: isNewGamePlusContinue ? [] : initialLog,
      selectedCard: null,
      ngPlusLevel: currentNGPlusLevel,
      modals: { message: initialModalState, story: initialModalState },
      aiBoss: finalBossForGame!,
      goldFlashPlayer: false,
      laudanumVisualActive: false,
      showLightningStrikeFlash: false,
      blockTradeDueToHostileEvent: false,
      activeEventJustAttacked: false,
      activeGameBanner: initialGameBannerState,
      pendingPlayerDamageAnimation: null,
      isLoadingBossIntro: false,
      playerDeckAugmentationPool: playerDeckAugmentationCards,
      scrollAnimationPhase: 'none',
      pendingSkunkSprayAnimation: false,
    });

  }, [_log, preGeneratedAiBoss]);


  useEffect(() => {
    const savedGame = localStorage.getItem('wildWestGameState_WWS');
    if (savedGame) {
      try {
        const parsedState: GameState = JSON.parse(savedGame);
        parsedState.log = Array.isArray(parsedState.log) ? parsedState.log : [];
        if (parsedState.playerDetails[PLAYER_ID] && !Array.isArray(parsedState.playerDetails[PLAYER_ID].hand[0]) && parsedState.playerDetails[PLAYER_ID].hand.length <= HAND_LIMIT ) {
            const currentHandCards = parsedState.playerDetails[PLAYER_ID].hand.filter(c => c !== null) as CardData[];
            const newHandWithNulls: (CardData | null)[] = new Array(HAND_LIMIT).fill(null);
            currentHandCards.forEach((card, idx) => {
                if(idx < HAND_LIMIT) newHandWithNulls[idx] = card;
            });
            parsedState.playerDetails[PLAYER_ID].hand = newHandWithNulls;
        }

        if (parsedState.selectedCard && (parsedState.selectedCard.card === null || typeof parsedState.selectedCard.card !== 'object' || typeof parsedState.selectedCard.card.id === 'undefined')) {
            _log("Sanitizing invalid selectedCard.card from saved state during load.", "debug");
            parsedState.selectedCard = null;
        }


        if (parsedState.status && parsedState.playerDetails && parsedState.turn) {
            // Ensure turn-specific flags are reset when loading a game
            if (parsedState.playerDetails[PLAYER_ID]) {
                parsedState.playerDetails[PLAYER_ID].hasTakenActionThisTurn = false;
                parsedState.playerDetails[PLAYER_ID].hasEquippedThisTurn = false;
                parsedState.playerDetails[PLAYER_ID].turnEnded = false;
                 _log("Turn-specific player flags reset on game load.", "debug");
            }
            
            // NG+ Card data handling on load
            if (parsedState.ngPlusLevel === 0) {
                 resetCurrentCardsData();
                 setGameState({...parsedState, scrollAnimationPhase: parsedState.scrollAnimationPhase || 'none', pendingSkunkSprayAnimation: parsedState.pendingSkunkSprayAnimation || false });
                 _log("Resumed game from saved state.", "system");
            } else {
                 const currentMilestone = Math.floor((parsedState.ngPlusLevel -1) / NG_PLUS_THEME_MILESTONE_INTERVAL) * NG_PLUS_THEME_MILESTONE_INTERVAL;
                 const isAtNewMilestoneOnLoad = parsedState.ngPlusLevel > 0 && parsedState.ngPlusLevel % NG_PLUS_THEME_MILESTONE_INTERVAL === 0;
                 let themedSetKey = '';
                 if (currentMilestone > 0) {
                    themedSetKey = `ngPlusThemeSet_${currentMilestone}_WWS`;
                 }
                 let baseCardsForThisRun: { [id: string]: CardData } | null = null;

                 if (isAtNewMilestoneOnLoad) { // If loaded state is AT a milestone, it implies AI remix should have happened.
                    const milestoneKey = `ngPlusThemeSet_${parsedState.ngPlusLevel}_WWS`;
                    const storedMilestoneSet = localStorage.getItem(milestoneKey);
                    if (storedMilestoneSet) {
                        try {
                            baseCardsForThisRun = JSON.parse(storedMilestoneSet);
                             _log(`Loaded AI-remixed theme set for NG+${parsedState.ngPlusLevel} from storage.`, "system");
                        } catch (e) {
                             _log(`Error parsing stored milestone theme ${milestoneKey}. Will attempt re-remix or manual scale.`, "error");
                        }
                    }
                    if (!baseCardsForThisRun) { // Remix or scale if not found for the milestone
                        remixCardsForNGPlusGame(_log, ALL_CARDS_DATA_MAP, parsedState.ngPlusLevel).then(remixed => {
                            baseCardsForThisRun = remixed || applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, parsedState.ngPlusLevel);
                            if (remixed) localStorage.setItem(milestoneKey, JSON.stringify(remixed));
                            updateCurrentCardsData(baseCardsForThisRun!);
                            setGameState({...parsedState, scrollAnimationPhase: parsedState.scrollAnimationPhase || 'none', pendingSkunkSprayAnimation: parsedState.pendingSkunkSprayAnimation || false });
                            _log("Resumed game from saved state (NG+ Milestone).", "system");
                        });
                        return; // Async operation, return to avoid double setGameState
                    }
                 } else if (themedSetKey && localStorage.getItem(themedSetKey)) { // Between milestones
                    try {
                        const storedTheme = JSON.parse(localStorage.getItem(themedSetKey)!);
                        const increment = parsedState.ngPlusLevel - currentMilestone;
                        baseCardsForThisRun = applyIncrementalNGPlusScaling(storedTheme, increment);
                        _log(`Loaded and incrementally scaled NG+${currentMilestone} theme for NG+${parsedState.ngPlusLevel}.`, "system");
                    } catch (e) {
                        _log(`Error loading/scaling NG+${currentMilestone} theme. Manual scaling.`, "error");
                        baseCardsForThisRun = applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, parsedState.ngPlusLevel);
                    }
                 } else { // Fallback, e.g. NG+1 to NG+9
                     baseCardsForThisRun = applyManualNGPlusScaling(ALL_CARDS_DATA_MAP, parsedState.ngPlusLevel);
                     _log(`Manually scaled cards for NG+${parsedState.ngPlusLevel} on load.`, "system");
                 }
                 updateCurrentCardsData(baseCardsForThisRun!);
                 setGameState({...parsedState, scrollAnimationPhase: parsedState.scrollAnimationPhase || 'none', pendingSkunkSprayAnimation: parsedState.pendingSkunkSprayAnimation || false });
                 _log("Resumed game from saved state (NG+).", "system");
            }
            if (parsedState.aiBoss) setPreGeneratedAiBoss(parsedState.aiBoss);

        } else {
            _log("Saved game state was incomplete. Starting fresh.", "debug");
            localStorage.removeItem('wildWestGameState_WWS');
            loadInitialState().catch(error => {
                console.error("Error during initial state load after incomplete save:", error);
            });
        }
      } catch (error) {
        console.error("Error parsing saved game state:", error);
        localStorage.removeItem('wildWestGameState_WWS');
        loadInitialState().catch(e => console.error("Error loading initial state after parse error:", e));
      }
    } else {
        loadInitialState().catch(error => {
            console.error("Error during initial state load:", error);
            _log("Critical error loading game state. Please try refreshing.", "error");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (gameState && gameState.status !== 'setup' && gameState.status !== 'generating_boss_intro' && gameState.status !== 'showing_boss_intro' && gameState.status !== 'finished') {
      try {
        const gameStateToSave = {
          ...gameState,
          log: gameState.log.slice(0, MAX_PERSISTED_LOG_ENTRIES)
        };
        const serializedState = JSON.stringify(gameStateToSave);
        localStorage.setItem('wildWestGameState_WWS', serializedState);
      } catch (error) {
        console.error("Error saving game state:", error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            _log("Error saving game progress: Storage quota exceeded. Some log entries might be lost. Try clearing browser storage if this persists.", "error");
        } else {
            _log("Error saving game progress.", "error");
        }
      }
    }
     if (gameState && gameState.status === 'finished') {
        localStorage.removeItem('wildWestGameState_WWS');
         // Save player details for NG+ if they won
        if (gameState.playerDetails[PLAYER_ID] && gameState.playerDetails[PLAYER_ID].health > 0) {
             const player = gameState.playerDetails[PLAYER_ID];
             if (player.name && player.character) {
                localStorage.setItem('wildWestPlayerDetailsForNGPlus_WWS', JSON.stringify({ name: player.name, characterId: player.character.id }));
             }
        }
        _log("Finished game state, cleared saved progress.", "debug");
    }
  }, [gameState, _log]);

  const proceedToGamePlay = useCallback(() => {
    setGameState(prevState => {
        if (!prevState) return null;

        let modifiablePlayer = { ...prevState.playerDetails[PLAYER_ID] };
        let modifiableGameStateUpdates: Partial<GameState> = {
            playerDeckAugmentationPool: [], // Always clear this when proceeding
        };

        modifiablePlayer.hatDamageNegationUsedThisTurn = false; // Ensure reset before first event

        let eventDeck = [...prevState.eventDeck];
        let activeEvent = prevState.activeEvent;
        let pendingDamageAnimationFromProceed = null;

        if (!activeEvent && eventDeck.length > 0 && !modifiablePlayer.isCampfireActive) {
            activeEvent = eventDeck.shift()!;
            modifiableGameStateUpdates.activeEventTurnCounter = 1;

            const { updatedPlayer: playerAfterImmediateEvent, turnEndedByEvent, gameShouldEnd: endAfterImmediate, eventRemoved, winReason: reasonAfterImmediate, damageInfo: immediateDamageInfo, hatDiscarded } = applyImmediateEventAndCheckEndTurn(activeEvent, modifiablePlayer, _log, applyDamageAndGetAnimation);
            modifiablePlayer = playerAfterImmediateEvent;
            if (hatDiscarded) modifiablePlayer.playerDiscard.push(hatDiscarded);
            pendingDamageAnimationFromProceed = immediateDamageInfo;

            if (endAfterImmediate) {
                modifiableGameStateUpdates.status = 'finished';
                modifiableGameStateUpdates.winReason = reasonAfterImmediate || "Defeated during initial reveal.";
                modifiableGameStateUpdates.activeGameBanner = null; // Clear banner on immediate defeat
                 if (bannerTimeoutRef.current) { clearTimeout(bannerTimeoutRef.current); bannerTimeoutRef.current = null; }
                 if (autoEndTurnTimerRef.current) { clearTimeout(autoEndTurnTimerRef.current); autoEndTurnTimerRef.current = null; }
                modifiableGameStateUpdates.pendingPlayerDamageAnimation = null; // Clear pending animation on defeat

                _log(modifiableGameStateUpdates.winReason, 'system');
                localStorage.setItem('ngPlusLevel_WWS', '0');
                localStorage.removeItem('ngPlusPlayerGold_WWS');
                localStorage.removeItem('wildWestWinDeck_WWS');
                localStorage.removeItem('wildWestEquipped_WWS');
                localStorage.removeItem('aiBossDefeated_WWS');
                const ngPlusMilestone = Math.floor(prevState.ngPlusLevel / NG_PLUS_THEME_MILESTONE_INTERVAL) * NG_PLUS_THEME_MILESTONE_INTERVAL;
                if (ngPlusMilestone > 0) {
                    localStorage.removeItem(`ngPlusThemeSet_${ngPlusMilestone}_WWS`);
                }
            } else {
                modifiableGameStateUpdates.status = 'playing';
                if (eventRemoved) {
                    modifiableGameStateUpdates.eventDiscardPile = [...(prevState.eventDiscardPile || []), activeEvent];
                    activeEvent = null;
                    modifiableGameStateUpdates.activeEventTurnCounter = 0;
                }
                if (activeEvent?.id === 'threat_lightning_strike') modifiableGameStateUpdates.showLightningStrikeFlash = true;
                
                if (turnEndedByEvent && activeEvent?.effect?.turn_end) { // Check activeEvent again, as it might be null
                   _log("First event is auto-ending the turn.", "debug");
                   // The endTurnLogic will be triggered by triggerBanner if applicable
                }
            }
        } else if (activeEvent) {
             modifiableGameStateUpdates.activeEventTurnCounter = prevState.activeEventTurnCounter || 1;
             modifiableGameStateUpdates.status = 'playing'; // Ensure status is playing if event carried over
        } else { // No active event, no new event (e.g. campfire active or deck empty)
            modifiableGameStateUpdates.status = 'playing';
        }

        modifiableGameStateUpdates.activeEvent = activeEvent;
        modifiableGameStateUpdates.eventDeck = eventDeck;
        modifiableGameStateUpdates.pendingPlayerDamageAnimation = pendingDamageAnimationFromProceed || (modifiableGameStateUpdates.status === 'finished' ? null : prevState.pendingPlayerDamageAnimation);
        
        // Only set blockTrade if status is 'playing'
        if (modifiableGameStateUpdates.status === 'playing' || (!modifiableGameStateUpdates.status && prevState.status === 'playing_initial_reveal')) {
            modifiableGameStateUpdates.blockTradeDueToHostileEvent = isEventConsideredHostile(activeEvent);
        } else {
            modifiableGameStateUpdates.blockTradeDueToHostileEvent = false;
        }


         _log(`Game starting/resuming. Player: ${modifiablePlayer.name}, Health: ${modifiablePlayer.health}/${modifiablePlayer.maxHealth}, Deck: ${modifiablePlayer.playerDeck.length}, Hand: ${modifiablePlayer.hand.filter(c => c !== null).length} cards. Status: ${modifiableGameStateUpdates.status || prevState.status}`, "system");
        if (modifiablePlayer.playerDeck.length + modifiablePlayer.hand.filter(c => c !== null).length === 0 && modifiablePlayer.health > 0 && modifiableGameStateUpdates.status !== 'finished') {
            _log("CRITICAL ERROR: Player has no cards in deck or hand at game start/resume!", "error");
        }
         if (modifiablePlayer.health <= 0 && modifiableGameStateUpdates.status !== 'finished') {
             _log(`CRITICAL ERROR: Player has ${modifiablePlayer.health} health at game start/resume, but status is not 'finished'! Forcing finished.`, "error");
             modifiableGameStateUpdates.status = 'finished';
             modifiableGameStateUpdates.winReason = modifiableGameStateUpdates.winReason || "Defeated due to critical health error.";
             modifiableGameStateUpdates.activeGameBanner = null;
             modifiableGameStateUpdates.pendingPlayerDamageAnimation = null;
        }

        return {
            ...prevState,
            ...modifiableGameStateUpdates,
            playerDetails: { ...prevState.playerDetails, [PLAYER_ID]: modifiablePlayer },
        };
    });
  }, [_log, applyDamageAndGetAnimation, applyImmediateEventAndCheckEndTurn]);

  const startGame = useCallback(async (playerNameFromSetup: string, characterFromSetup: Character) => {
    setGameState(prevState => {
        if (!prevState) {
             _log("Previous state is null, cannot start game.", "error");
             return null;
        }
        if (!characterFromSetup || !playerNameFromSetup) {
            _log(`Cannot start game: Character or name not provided. Name: '${playerNameFromSetup}', Char: '${characterFromSetup?.id}'`, "error");
            return prevState;
        }

        _log(`Starting the game for ${playerNameFromSetup} the ${characterFromSetup.name}...`, "system");

        let modifiablePlayer = { ...prevState.playerDetails[PLAYER_ID] };
        let modifiableGameStateUpdates: Partial<GameState> = {};
        modifiablePlayer.hatDamageNegationUsedThisTurn = false;

        modifiablePlayer.name = playerNameFromSetup;
        modifiablePlayer.character = characterFromSetup;

        if (prevState.ngPlusLevel === 0) {
            modifiablePlayer.gold = characterFromSetup.gold;
        } else { // For NG+, gold is carried over (handled in loadInitialState)
            // But ensure maxHealth is correctly set based on character and NG+ level
            let baseHealth = characterFromSetup.health;
            if (prevState.ngPlusLevel >= NG_PLUS_PLAYER_HEALTH_BOOST_INTERVAL) {
                const numBoosts = Math.floor(prevState.ngPlusLevel / NG_PLUS_PLAYER_HEALTH_BOOST_INTERVAL);
                baseHealth += numBoosts * NG_PLUS_PLAYER_HEALTH_BOOST_AMOUNT;
            }
            modifiablePlayer.maxHealth = Math.max(1, baseHealth - prevState.ngPlusLevel);
            modifiablePlayer.health = modifiablePlayer.maxHealth; // Start NG+ at full (new) max health
        }


        const starterCards = characterFromSetup.starterDeck
            .map(id => CURRENT_CARDS_DATA[id])
            .filter(Boolean) as CardData[];
        let currentDeck = [...starterCards];

        currentDeck.push(...(prevState.playerDeckAugmentationPool || []));

        if (prevState.ngPlusLevel > 0) {
            const carriedOverDeckIdsString = localStorage.getItem('wildWestWinDeck_WWS_pending');
            if (carriedOverDeckIdsString) {
                try {
                    const carriedOverCardIds: string[] = JSON.parse(carriedOverDeckIdsString);
                    const carriedOverCards = carriedOverCardIds
                        .map(id => CURRENT_CARDS_DATA[id])
                        .filter(Boolean) as CardData[];
                    if (carriedOverCards.length > 0) {
                        currentDeck.push(...carriedOverCards);
                        _log(`Added ${carriedOverCards.length} carried-over NG+ cards. Deck size: ${currentDeck.length}.`, "system");
                    }
                    localStorage.removeItem('wildWestWinDeck_WWS_pending');
                } catch (e) {
                    console.error("Error parsing NG+ pending deck:", e);
                     _log("Error applying NG+ carry-over deck.", "error");
                }
            }
            const carriedOverEquippedIdsString = localStorage.getItem('wildWestEquipped_WWS_pending');
            if (carriedOverEquippedIdsString) {
                 try {
                    const carriedOverEquippedIds: string[] = JSON.parse(carriedOverEquippedIdsString);
                    modifiablePlayer.equippedItems = carriedOverEquippedIds
                        .map(id => CURRENT_CARDS_DATA[id])
                        .filter(Boolean) as CardData[];
                    _log(`Loaded ${modifiablePlayer.equippedItems.length} equipped items for NG+.`, "system");
                    // Apply persistent effects from NG+ equipped items
                    modifiablePlayer.equippedItems.forEach(item => {
                        if (item.effect?.persistent && item.type === 'Player Upgrade') {
                             const effect = item.effect;
                             if (effect.subtype === 'max_health' && typeof effect.amount === 'number') {
                                modifiablePlayer.maxHealth += effect.amount;
                                modifiablePlayer.health += effect.amount; // Also increase current health
                             }
                             if (effect.subtype === 'damage_negation') {
                                modifiablePlayer.hatDamageNegationAvailable = true;
                                if (typeof effect.max_health === 'number') {
                                    modifiablePlayer.maxHealth += effect.max_health;
                                    modifiablePlayer.health += effect.max_health;
                                }
                             }
                        }
                    });

                    localStorage.removeItem('wildWestEquipped_WWS_pending');
                 } catch (e) {
                    console.error("Error parsing NG+ pending equipped items:", e);
                    _log("Error applying NG+ carry-over equipped items.", "error");
                 }
            }
        }

        const fillerItemIds = ['provision_hardtack', 'provision_dried_meat', 'item_knife_t1'];
        let fillerIndex = 0;
        while(currentDeck.length < PLAYER_DECK_TARGET_SIZE) {
            const fillerCardId = fillerItemIds[fillerIndex % fillerItemIds.length];
            const fillerCard = CURRENT_CARDS_DATA[fillerCardId];
            if (fillerCard) {
                currentDeck.push(fillerCard);
            } else {
                _log(`Warning: Filler card ID ${fillerCardId} not found.`, "error");
                break;
            }
            fillerIndex++;
        }
        modifiablePlayer.playerDeck = shuffleArray(currentDeck);

        let actualCardsForInitialHand: CardData[] = [];
        for (let i = 0; i < modifiablePlayer.handSize; i++) {
            if (modifiablePlayer.playerDeck.length === 0) break;
            actualCardsForInitialHand.push(modifiablePlayer.playerDeck.shift()!);
        }
        actualCardsForInitialHand.sort((a,b) => getCardCategory(a) - getCardCategory(b) || a.name.localeCompare(b.name));

        for (let i = 0; i < modifiablePlayer.handSize; i++) {
            if (i < actualCardsForInitialHand.length) {
                modifiablePlayer.hand[i] = actualCardsForInitialHand[i];
            } else {
                modifiablePlayer.hand[i] = null;
            }
        }

         _log(`Player deck finalized. Total cards in deck: ${modifiablePlayer.playerDeck.length}. Health: ${modifiablePlayer.health}/${modifiablePlayer.maxHealth}`, "system");
        if (modifiablePlayer.playerDeck.length + modifiablePlayer.hand.filter(c => c !== null).length === 0) {
            _log("CRITICAL ERROR: Player deck and hand are empty after finalization in startGame!", "error");
        }
         if (modifiablePlayer.health <= 0) {
            _log("CRITICAL ERROR: Player health is zero or less after finalization in startGame!", "error");
        }

        return {
             ...prevState,
             ...modifiableGameStateUpdates,
             playerDetails: { [PLAYER_ID]: modifiablePlayer },
             status: 'generating_boss_intro',
             isLoadingBossIntro: true,
             log: [],
        };
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    const currentGSForBossIntro = gameStateRef.current;
    if (!currentGSForBossIntro || !currentGSForBossIntro.playerDetails[PLAYER_ID].character || !currentGSForBossIntro.playerDetails[PLAYER_ID].name || !currentGSForBossIntro.aiBoss) {
        _log("Missing critical data for boss intro. Proceeding to game.", "error");
        setGameState(prevGS => {
            if (!prevGS) return null;
            return { ...prevGS, status: 'playing_initial_reveal', isLoadingBossIntro: false, playerDeckAugmentationPool: [] };
        });
        if (gameStateRef.current && gameStateRef.current.status === 'playing_initial_reveal') {
            proceedToGamePlay();
        }
        return;
    }

    try {
        const storyElements = await generateBossIntroStory(
            currentGSForBossIntro.playerDetails[PLAYER_ID].name!,
            currentGSForBossIntro.playerDetails[PLAYER_ID].character!,
            currentGSForBossIntro.aiBoss!,
            _log
        );

        setGameState(prevGS => {
            if (!prevGS) return null;
            if (storyElements) {
                return {
                    ...prevGS,
                    status: 'showing_boss_intro',
                    bossIntroTitle: storyElements.title,
                    bossIntroParagraph: storyElements.paragraph,
                    isLoadingBossIntro: false,
                };
            } else { // Fallback if storyElements is null
                return { ...prevGS, status: 'playing_initial_reveal', isLoadingBossIntro: false, playerDeckAugmentationPool: [] };
            }
        });
         if (gameStateRef.current && gameStateRef.current.status === 'playing_initial_reveal') {
            proceedToGamePlay();
        }
    } catch (error) {
        console.error("Error generating boss intro:", error);
        _log("Error generating boss intro. Proceeding to game.", "error");
         setGameState(prevGS => {
            if (!prevGS) return null;
            return { ...prevGS, status: 'playing_initial_reveal', isLoadingBossIntro: false, playerDeckAugmentationPool: [] };
        });
        if (gameStateRef.current && gameStateRef.current.status === 'playing_initial_reveal') {
            proceedToGamePlay();
        }
    }
  }, [_log, proceedToGamePlay]);


  const resetGame = useCallback((isNewGamePlusContinue = false) => {
    _log("Resetting game...", "system");
    localStorage.removeItem('wildWestGameState_WWS');

    if (!isNewGamePlusContinue) {
        localStorage.removeItem('ngPlusLevel_WWS');
        localStorage.removeItem('ngPlusPlayerGold_WWS');
        localStorage.removeItem('wildWestWinDeck_WWS');
        localStorage.removeItem('wildWestEquipped_WWS');
        localStorage.removeItem('aiBossDefeated_WWS');
        localStorage.removeItem('wildWestWinDeck_WWS_pending');
        localStorage.removeItem('wildWestEquipped_WWS_pending');
        localStorage.removeItem('wildWestPlayerDetailsForNGPlus_WWS');
         Object.keys(localStorage).forEach(key => {
            if (key.startsWith('ngPlusThemeSet_') && key.endsWith('_WWS')) {
                localStorage.removeItem(key);
            }
         });
        setPreGeneratedAiBoss(null);
    } else { // Preparing for NG+
        const deckToCarry = localStorage.getItem('wildWestWinDeck_WWS');
        if (deckToCarry) {
            localStorage.setItem('wildWestWinDeck_WWS_pending', deckToCarry);
            localStorage.removeItem('wildWestWinDeck_WWS');
        }
        const equippedToCarry = localStorage.getItem('wildWestEquipped_WWS');
        if (equippedToCarry) {
            localStorage.setItem('wildWestEquipped_WWS_pending', equippedToCarry);
            localStorage.removeItem('wildWestEquipped_WWS');
        }
        // Player details for NG+ are already saved in the 'finished' state part of useEffect[gameState]
        localStorage.removeItem('aiBossDefeated_WWS'); // Reset boss defeated flag for new NG+ run
    }
    loadInitialState(isNewGamePlusContinue).catch(error => {
        console.error("Error during game reset:", error);
        _log("Critical error resetting game state. Please try refreshing.", "error");
    });
  }, [_log, loadInitialState]);


  const handleRestockStore = useCallback(() => {
    setGameState(prevState => {
      if (!prevState || prevState.playerDetails[PLAYER_ID].hasRestockedThisTurn || prevState.playerDetails[PLAYER_ID].gold < 1 || prevState.playerDetails[PLAYER_ID].turnEnded || prevState.blockTradeDueToHostileEvent) {
        if (prevState?.blockTradeDueToHostileEvent) _log("Cannot restock store while hostile event is active!", "error");
        else if (prevState?.playerDetails[PLAYER_ID].turnEnded) _log("Cannot restock, turn ended.", "error");
        else if (prevState?.playerDetails[PLAYER_ID].hasRestockedThisTurn) _log("Already restocked this turn.", "error");
        else if (prevState?.playerDetails[PLAYER_ID].gold < 1) _log("Not enough gold to restock.", "error");
        return prevState;
      }

      let modifiablePlayer = { ...prevState.playerDetails[PLAYER_ID] };
      let currentStoreDeck = [...prevState.storeItemDeck];
      let currentStoreDisplay = [...prevState.storeDisplayItems];
      let modifiableGameStateUpdates: Partial<GameState> = {};

      currentStoreDisplay.forEach(item => {
        if (item) currentStoreDeck.push(item);
      });
      currentStoreDisplay = new Array(STORE_DISPLAY_LIMIT).fill(null);

      if (currentStoreDeck.length < STORE_DISPLAY_LIMIT && prevState.storeItemDiscardPile.length > 0) {
        currentStoreDeck.push(...shuffleArray(prevState.storeItemDiscardPile));
        modifiableGameStateUpdates.storeItemDiscardPile = [];
      }

      currentStoreDeck = shuffleArray(currentStoreDeck);

      for (let i = 0; i < STORE_DISPLAY_LIMIT; i++) {
        if (currentStoreDeck.length > 0) {
          currentStoreDisplay[i] = currentStoreDeck.shift()!;
        } else {
          break;
        }
      }

      modifiablePlayer.gold -= 1;
      modifiablePlayer.hasRestockedThisTurn = true;
      triggerGoldFlash(PLAYER_ID);
      _log(`Restocked store for 1 Gold.`, 'action');

      modifiableGameStateUpdates.storeItemDeck = currentStoreDeck;
      modifiableGameStateUpdates.storeDisplayItems = currentStoreDisplay;
      modifiableGameStateUpdates.selectedCard = null;

      return {
        ...prevState,
        ...modifiableGameStateUpdates,
        playerDetails: {
          ...prevState.playerDetails,
          [PLAYER_ID]: modifiablePlayer
        },
      };
    });
  }, [_log, triggerGoldFlash]);


  const closeModal = useCallback((modalType: 'message' | 'story') => {
    setGameState(prev => {
        if (!prev) return null;
        if (modalType === 'message') {
            return { ...prev, modals: { ...prev.modals, message: initialModalState } };
        } else if (modalType === 'story') {
            return { ...prev, modals: { ...prev.modals, story: initialModalState } };
        }
        return prev;
    });
  }, []);

  const setSelectedCard = useCallback((details: { card: CardData; source: string; index: number } | null) => {
     setGameState(prev => prev ? { ...prev, selectedCard: details } : null);
  }, []);

  const deselectAllCards = useCallback(() => {
    if (gameStateRef.current?.selectedCard) {
        setGameState(prev => prev ? { ...prev, selectedCard: null } : null);
    }
  }, []);


  return {
    gameState,
    selectCharacter,
    confirmName,
    startGame,
    resetGame,
    handleCardAction,
    handleRestockStore,
    endTurn,
    closeModal,
    setSelectedCard,
    deselectAllCards,
    showEndTurnFade,
    proceedToGamePlay,
  };
};
