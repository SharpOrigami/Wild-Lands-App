
import React from 'react';
import { useGameState } from './hooks/useGameState';
import SetupScreen from './screens/SetupScreen';
import GameScreen from './screens/GameScreen';
import ModalComponent from './components/ModalComponent';
import OverlayEffectsComponent from './components/OverlayEffectsComponent';
import BossIntroStoryComponent from './components/BossIntroStoryComponent'; // Import new component
import { PLAYER_ID } from './constants';

const App: React.FC = () => {
  const {
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
    proceedToGamePlay, // Get the new function
  } = useGameState();

  if (!gameState) {
    return <div className="text-center text-[var(--paper-bg)] text-2xl font-western p-10">Loading the Frontier...</div>;
  }

  const playerDetails = gameState.playerDetails[PLAYER_ID];

  return (
    <div className="container mx-auto p-4 rounded-lg shadow-xl max-w-7xl relative" onClick={deselectAllCards} aria-live="polite">
      <OverlayEffectsComponent
        activeLaudanum={gameState.laudanumVisualActive}
        showLightningStrikeFlash={gameState.showLightningStrikeFlash}
        endGameStatus={gameState.status === 'finished' ? (playerDetails?.health > 0 ? 'victory' : 'defeat') : undefined}
        winReason={gameState.winReason}
        scoutedCard={gameState.selectedCard?.source === 'scouted_preview' ? gameState.selectedCard.card : undefined}
        clearScoutedCardPreview={() => {
          if (gameState.selectedCard?.source === 'scouted_preview') {
            setSelectedCard(null);
          }
        }}
        showEndTurnFade={showEndTurnFade}
        activeGameBanner={gameState.activeGameBanner}
        isStoryModalOpen={gameState.modals?.story.isOpen} // Pass story modal state
      />

      <h1 className="text-4xl font-western text-center text-stone-200 mb-6" style={{ textShadow: '2px 2px 4px #000' }}>
        Wild Lands
      </h1>

      {gameState.status === 'setup' && playerDetails && (
        <SetupScreen
          characters={playerDetails.character ? [] : undefined}
          selectedCharacter={playerDetails.character}
          onSelectCharacter={selectCharacter}
          onConfirmName={confirmName}
          onStartGame={startGame} // startGame now expects (name, character)
          ngPlusLevel={gameState.ngPlusLevel}
          characterName={playerDetails.name || ''}
          isLoadingBossIntro={gameState.isLoadingBossIntro || false}
        />
      )}

      {(gameState.status === 'generating_boss_intro' || gameState.status === 'showing_boss_intro') && (
        <BossIntroStoryComponent
          isLoading={gameState.status === 'generating_boss_intro'} // Simplified
          title={gameState.bossIntroTitle}
          paragraph={gameState.bossIntroParagraph}
          onContinue={proceedToGamePlay}
        />
      )}

      {(gameState.status === 'playing' || gameState.status === 'playing_initial_reveal') && playerDetails && (
         <GameScreen
            gameState={gameState}
            playerDetails={playerDetails}
            onCardAction={handleCardAction}
            onEndTurn={endTurn}
            onRestartGame={() => {
              closeModal('message');
              handleCardAction('SHOW_MODAL', {
                modalType: 'message',
                title: 'Restart Game?',
                text: `Are you sure you want to abandon this run and start over? ${gameState.ngPlusLevel > 0 ? 'NG+ progress will be reset.' : ''}`,
                confirmCallback: () => {
                  localStorage.removeItem('wildWestWinDeck_WWS'); // Added _WWS suffix
                  localStorage.setItem('ngPlusLevel_WWS', '0'); // Added _WWS suffix
                  resetGame();
                }
              });
            }}
            onRestockStore={handleRestockStore}
            selectedCardDetails={gameState.selectedCard}
            setSelectedCard={setSelectedCard}
            deselectAllCards={deselectAllCards}
        />
      )}

      {gameState.modals?.message.isOpen && (
        <ModalComponent
          title={gameState.modals.message.title}
          isOpen={gameState.modals.message.isOpen}
          onClose={() => closeModal('message')}
          confirmCallback={gameState.modals.message.confirmCallback}
          confirmText={gameState.modals.message.confirmText}
        >
          <p className="whitespace-pre-wrap">{gameState.modals.message.text}</p>
        </ModalComponent>
      )}

      {gameState.modals?.story.isOpen && (
        <ModalComponent
          title={gameState.modals.story.title}
          isOpen={gameState.modals.story.isOpen}
          onClose={() => {
            closeModal('story');
             setTimeout(() => {
                const playerWon = playerDetails?.health > 0 && gameState.status === 'finished';
                if(playerWon) {
                    resetGame(true);
                } else {
                    localStorage.removeItem('wildWestWinDeck_WWS'); // Added _WWS suffix
                    localStorage.setItem('ngPlusLevel_WWS', '0'); // Added _WWS suffix
                    resetGame();
                }
            }, 100);
          }}
          singleActionText={ 
            (playerDetails?.health > 0 && (gameState.winReason?.includes("defeated The Nameless Dread") || gameState.winReason?.includes("defeated ai_boss_") || gameState.winReason?.includes("conquered the frontier") || localStorage.getItem('aiBossDefeated_WWS') === 'true'))
            ? "Begin NG+"
            : "Play Again"
          }
        >
          <p className="whitespace-pre-wrap">{gameState.modals.story.text}</p>
        </ModalComponent>
      )}
    </div>
  );
};

export default App;
