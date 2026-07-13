<script setup>
/** Board column: the board island plus the desktop-only board-size slider. */
import { VdSlider } from "@vanduo-oss/vd3";
import BoardIsland from "./BoardIsland.vue";
import { useGameStore } from "../composables/useGameStore.js";

const store = useGameStore();
const { boardSizeSlider } = store;
</script>

<template>
  <section class="board-section" aria-label="Chess board">
    <BoardIsland />
    <div class="board-size-control-desktop">
      <label for="board-size-range" class="board-size-label">Board size</label>
      <VdSlider
        id="board-size-range"
        :model-value="boardSizeSlider"
        :min="0"
        :max="100"
        @update:model-value="(v) => store.setBoardSizeSlider(v)"
      />
    </div>
  </section>
</template>
