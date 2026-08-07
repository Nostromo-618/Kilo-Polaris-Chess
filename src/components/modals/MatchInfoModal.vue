<script setup>
/** Explains the engine-vs-engine match setup and how to read its results. */
import { VdModal } from "@vanduo-oss/vd3";
import { useModals } from "../../composables/useModals.js";

const { matchInfoOpen } = useModals();
</script>

<template>
  <VdModal v-model:open="matchInfoOpen" size="xl" title="How the engine match works">
    <div id="match-info-modal" class="match-info-scope">
      <p class="match-info-lead">
        Engine Match pits two chess engines against each other so you can watch
        them play. Here's how the settings work — and how to read the result
        fairly.
      </p>

      <div class="match-info-grid">
      <section class="match-info-section">
        <h4><i class="ph-duotone ph-cpu" aria-hidden="true"></i> The two engines</h4>
        <p>
          <strong>Aurora Polaris</strong> is this project's own from-scratch
          engine. <strong>TomitankChess</strong> is a strong third-party engine
          (vendored) used as an external strength yardstick.
        </p>
      </section>

      <section class="match-info-section">
        <h4><i class="ph-duotone ph-gauge" aria-hidden="true"></i> "Strength" is a search-depth cap</h4>
        <p>
          Each engine's level 1–6 caps how deep it searches. The two scales are
          <em>not</em> the same: a low level deliberately weakens the engine so
          it stays beatable. Tomitank's levels map to fixed search depths, so its
          level 3 is much shallower than its level 6.
        </p>
      </section>

      <section class="match-info-section">
        <h4><i class="ph-duotone ph-clock" aria-hidden="true"></i> Equal move time ≠ equal thinking</h4>
        <p>
          Both sides get the same milliseconds per move. But a depth-capped
          engine finishes early and leaves most of that time unused, while an
          uncapped engine spends all of it. So a shared move-time is only a fair,
          equal-effort contest when neither side is held back by a low level.
        </p>
      </section>

      <section class="match-info-section">
        <h4><i class="ph-duotone ph-lightning" aria-hidden="true"></i> Full strength (uncapped)</h4>
        <p>
          Each engine has a <strong>full strength</strong> toggle that removes
          its depth cap and lets it search to the move-time limit — the real
          engine, above level 6. The level selector then no longer limits that
          engine. With both toggles on, the match is a true equal-time contest;
          expect Tomitank to be much stronger.
        </p>
      </section>

      <section class="match-info-section match-info-section--wide">
        <h4><i class="ph-duotone ph-ruler" aria-hidden="true"></i> How Aurora measures up (honest)</h4>
        <p>
          Measured over 40 games at 1&nbsp;second per move, Aurora at its top
          level (6):
        </p>
        <table class="match-info-table">
          <thead>
            <tr><th>Opponent (equal time)</th><th>Aurora level 6 score</th></tr>
          </thead>
          <tbody>
            <tr><td>Tomitank level 1</td><td>~97%</td></tr>
            <tr><td>Tomitank level 3</td><td>~64%</td></tr>
            <tr><td>Tomitank full strength</td><td>~1%</td></tr>
          </tbody>
        </table>
        <p class="match-info-note">
          So Aurora's strongest setting lands around Tomitank's level 2–3. It
          beats the low levels comfortably, is roughly even at level 3, and is
          outclassed by the full-strength engine — which is expected for a small,
          dependency-free browser engine.
        </p>
      </section>
      </div>

      <p class="match-info-smallprint">
        This is engine-vs-engine only. The single-player “vs Computer” difficulty
        is a separate, independent setting and is unaffected by anything here.
      </p>
    </div>
  </VdModal>
</template>
