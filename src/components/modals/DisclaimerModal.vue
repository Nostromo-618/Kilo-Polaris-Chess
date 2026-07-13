<script setup>
/**
 * First-visit disclaimer / consent gate. Mandatory: the only close path is
 * "Accept & Play" (which records acceptance). Backdrop / Escape / the built-in
 * close button are suppressed — vd3's VdModal has no `persistent` mode yet, so
 * we neutralize its dismiss emits and hide its close button via CSS.
 * (Logged as vd3 dogfooding feedback: VdModal could use a `dismissible` prop.)
 */
import { setDisclaimerAccepted } from "../../../js/storage.js";
import { VdModal, VdButton } from "@vanduo-oss/vd3";
import { useModals } from "../../composables/useModals.js";

const { disclaimerOpen, closeDisclaimer } = useModals();

function accept() {
  setDisclaimerAccepted();
  closeDisclaimer();
}
</script>

<template>
  <VdModal
    :open="disclaimerOpen"
    :close-on-backdrop="false"
    @update:open="() => {}"
  >
    <template #header>
      <div class="disclaimer-modal-heading">
        <span class="disclaimer-modal-icon">
          <i class="ph-duotone ph-chess-piece" aria-hidden="true"></i>
        </span>
        <h2 id="disclaimer-modal-title" class="disclaimer-modal-title">
          Welcome to Aurora Polaris Chess
        </h2>
      </div>
    </template>

    <div id="disclaimer-modal" class="disclaimer-scope">
    <p class="disclaimer-intro">
      This application is an open-source, browser-based chess game running
      entirely in your browser — no server, no account, no data collected.
    </p>

    <ul class="disclaimer-list">
      <li>
        <i class="ph-duotone ph-info" aria-hidden="true"></i>
        <div class="disclaimer-li-body">
          <strong>For entertainment only.</strong> The computer engine is a hobby
          project and is not a professional chess engine.
        </div>
      </li>
      <li>
        <i class="ph-duotone ph-database" aria-hidden="true"></i>
        <div class="disclaimer-li-body">
          <strong>Local storage.</strong> Your settings and game progress are
          saved <em>only</em> in your browser's local storage. Nothing is sent to
          any server.
        </div>
      </li>
      <li>
        <i class="ph-duotone ph-code" aria-hidden="true"></i>
        <div class="disclaimer-li-body">
          <strong>Open source.</strong> This project is provided as-is under the
          MIT licence with no warranty of any kind.
        </div>
      </li>
      <li>
        <i class="ph-duotone ph-cpu" aria-hidden="true"></i>
        <div class="disclaimer-li-body">
          <strong>Strong engine.</strong> You can play against
          <strong>TomitankChess</strong> (GPL-3.0), an embedded UCI engine from
          <a
            href="https://github.com/tomitank/tomitankChess"
            target="_blank"
            rel="noopener noreferrer"
            class="disclaimer-inline-link"
          >github.com/tomitank/tomitankChess</a>. Aurora Polaris AI is also
          available; see
          <a
            href="https://github.com/Nostromo-618/aurora-polaris-chess/blob/main/THIRD_PARTY_NOTICES.md"
            target="_blank"
            rel="noopener noreferrer"
            class="disclaimer-inline-link"
          >THIRD_PARTY_NOTICES.md</a>
          for licence details.
        </div>
      </li>
      <li>
        <i class="ph-duotone ph-star" aria-hidden="true"></i>
        <div class="disclaimer-li-body">
          <strong>Support the project.</strong> If you enjoy Aurora Polaris Chess,
          please consider starring the repository on GitHub:
          <a
            href="https://github.com/Nostromo-618/aurora-polaris-chess"
            target="_blank"
            rel="noopener noreferrer"
            class="disclaimer-inline-link"
          >github.com/Nostromo-618/aurora-polaris-chess</a>.
        </div>
      </li>
    </ul>

    <p class="disclaimer-footnote">
      By clicking <strong>Accept &amp; Play</strong> you acknowledge these terms
      and allow the app to save your preferences locally.
    </p>
    </div>

    <template #footer>
      <VdButton
        id="disclaimer-accept-btn"
        variant="primary"
        size="lg"
        class="disclaimer-accept-btn"
        @click="accept"
      >
        <i class="ph-duotone ph-check-circle" aria-hidden="true"></i>
        Accept &amp; Play
      </VdButton>
    </template>
  </VdModal>
</template>
