<script setup>
/** Result dialog shown when a human game ends (checkmate / stalemate / draw). */
import { computed } from "vue";
import { VdModal, VdButton } from "@vanduo-oss/vd3";
import { useGameStore } from "../../composables/useGameStore.js";

const store = useGameStore();
const { gameEndResult } = store;

const open = computed({
  get: () => gameEndResult.value !== null,
  set: (v) => {
    if (!v) gameEndResult.value = null;
  },
});

const view = computed(() => {
  const payload = gameEndResult.value;
  if (!payload) return { icon: "", title: "", message: "", tone: "draw" };
  const { result, playerColor } = payload;

  if (result.outcome === "checkmate") {
    const isPlayerWinner = result.winner === playerColor;
    const winner = result.winner === "white" ? "White" : "Black";
    return {
      icon: isPlayerWinner ? "🎉" : "😔",
      title: `${winner} Wins`,
      message: `Checkmate. ${winner} wins.`,
      tone: isPlayerWinner ? "victory" : "defeat",
    };
  }
  if (result.outcome === "stalemate") {
    return {
      icon: "🤝",
      title: "Draw",
      message: "The game ended in a draw by stalemate.",
      tone: "draw",
    };
  }
  if (result.outcome === "draw") {
    return {
      icon: "🤝",
      title: "Draw",
      message: `The game ended in a draw: ${result.reason || "by agreement"}.`,
      tone: "draw",
    };
  }
  return {
    icon: "🏁",
    title: "Game Over",
    message: result.reason || "The game has ended.",
    tone: "draw",
  };
});

function newGame() {
  gameEndResult.value = null;
  store.newGame();
}
</script>

<template>
  <VdModal v-model:open="open" size="sm" :title="view.title">
    <div
      id="game-end-modal"
      class="game-end-body"
      :class="`game-end-tone-${view.tone}`"
    >
      <div class="game-end-icon" aria-hidden="true">{{ view.icon }}</div>
      <p class="game-end-message">{{ view.message }}</p>
    </div>
    <template #footer>
      <VdButton id="game-end-new-game-btn" variant="primary" @click="newGame">
        <i class="ph-duotone ph-flag-checkered" aria-hidden="true"></i>
        New Game
      </VdButton>
      <VdButton
        id="game-end-close-btn"
        variant="ghost"
        @click="open = false"
      >Close</VdButton>
    </template>
  </VdModal>
</template>
