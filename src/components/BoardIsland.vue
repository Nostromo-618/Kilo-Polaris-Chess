<script setup>
/**
 * BoardIsland — the one imperative island in the app. It hands its root element
 * to the framework-agnostic `BoardView` (8x8 grid, SVG pieces, highlights,
 * promotion overlay) and bridges its callbacks to the game store. BoardView is
 * game-critical and uses no vd3, so it is kept verbatim rather than rewritten.
 */
import { onMounted, onBeforeUnmount, ref } from "vue";
import { BoardView } from "../../js/ui/BoardView.js";
import { useGameStore } from "../composables/useGameStore.js";

const store = useGameStore();
const container = ref(null);
let boardView = null;

onMounted(() => {
  boardView = new BoardView(container.value, {
    onSquareSelected: (sq) => store.handleSquareSelected(sq),
    onPromotionPicked: (piece) => store.handlePromotionPicked(piece),
    onPromotionCancelled: () => store.handlePromotionCancelled(),
  });
  store.attachBoard(boardView);
});

onBeforeUnmount(() => {
  store.detachBoard();
  boardView?.hidePromotionPicker?.();
  boardView = null;
});
</script>

<template>
  <div
    id="board-container"
    ref="container"
    aria-label="Chess board"
    role="grid"
  ></div>
</template>
