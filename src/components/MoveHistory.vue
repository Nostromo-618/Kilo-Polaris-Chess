<script setup>
/** The move log (SAN-ish entries produced by the engine snapshot). */
import { useGameStore } from "../composables/useGameStore.js";

const { history } = useGameStore();
</script>

<template>
  <section class="history-section" aria-label="Move history">
    <h2 class="panel-heading">Move History</h2>
    <ol id="move-history" class="move-history-list">
      <li v-for="(entry, index) in history" :key="index" :data-index="index">
        {{ entry }}
      </li>
    </ol>
    <p v-if="!history.length" class="move-history-empty">
      No moves yet — start a game to see the move log.
    </p>
  </section>
</template>
