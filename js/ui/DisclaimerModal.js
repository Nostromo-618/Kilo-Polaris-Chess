/**
 * DisclaimerModal.js
 *
 * Mandatory first-visit disclaimer modal using the Vanduo framework modal
 * component. The user MUST click "Accept" to proceed; the modal cannot be
 * dismissed by pressing ESC or clicking the backdrop.
 *
 * On accept:
 *   1. Stores acceptance in localStorage via storage.setDisclaimerAccepted()
 *   2. Closes the modal via VanduoModals.close()
 *   3. Calls the optional onAccepted callback
 */

import { setDisclaimerAccepted } from '../storage.js';

export class DisclaimerModal {
    /**
     * @param {HTMLElement} container - Element to inject modal HTML into
     * @param {() => void} [onAccepted] - Callback invoked after user accepts
     */
    constructor(container, onAccepted) {
        this.container = container;
        this.onAccepted = onAccepted || (() => { });
        this.modalEl = null;
        this._init();
    }

    _init() {
        // Build modal structure using Vanduo modal classes
        this.modalEl = document.createElement('div');
        this.modalEl.className = 'vd-modal';
        this.modalEl.id = 'disclaimer-modal';
        // Static backdrop — clicking outside does nothing
        this.modalEl.setAttribute('data-backdrop', 'static');
        // Disable ESC key dismissal
        this.modalEl.setAttribute('data-keyboard', 'false');
        this.modalEl.setAttribute('role', 'dialog');
        this.modalEl.setAttribute('aria-labelledby', 'disclaimer-modal-title');
        this.modalEl.setAttribute('aria-modal', 'true');

        this.modalEl.innerHTML = `
      <div class="vd-modal-dialog disclaimer-modal-dialog">
        <div class="vd-modal-content disclaimer-modal-content">
          <div class="vd-modal-header disclaimer-modal-header">
            <span class="disclaimer-modal-icon">
              <i class="ph-duotone ph-chess-piece"></i>
            </span>
            <h3 id="disclaimer-modal-title" class="vd-modal-title disclaimer-modal-title">
              Welcome to Aurora Polaris Chess
            </h3>
          </div>
          <div class="vd-modal-body disclaimer-modal-body">
            <p>
              This application is an open-source, browser-based chess game
              running entirely in your browser — no server, no account, no data
              collected.
            </p>
            <ul class="disclaimer-list">
              <li>
                <i class="ph-duotone ph-info" aria-hidden="true"></i>
                <div class="disclaimer-li-body">
                  <strong>For entertainment only.</strong> The computer engine is
                  a hobby project and is not a professional chess engine.
                </div>
              </li>
              <li>
                <i class="ph-duotone ph-database" aria-hidden="true"></i>
                <div class="disclaimer-li-body">
                  <strong>Local storage.</strong> Your settings and game progress
                  are saved <em>only</em> in your browser's local storage. Nothing
                  is sent to any server.
                </div>
              </li>
              <li>
                <i class="ph-duotone ph-code" aria-hidden="true"></i>
                <div class="disclaimer-li-body">
                  <strong>Open source.</strong> This project is provided as-is
                  under the MIT licence with no warranty of any kind.
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
                  >github.com/tomitank/tomitankChess</a>.
                  Aurora Polaris AI is also available; see
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
              By clicking <strong>Accept &amp; Play</strong> you acknowledge
              these terms and allow the app to save your preferences locally.
            </p>
          </div>
          <div class="vd-modal-footer disclaimer-modal-footer">
            <button
              id="disclaimer-accept-btn"
              class="vd-btn vd-btn-primary vd-btn-lg disclaimer-accept-btn"
            >
              <i class="ph-duotone ph-check-circle vd-mr-2"></i>
              Accept &amp; Play
            </button>
          </div>
        </div>
      </div>
    `;

        this.container.appendChild(this.modalEl);

        // Bind accept button
        const acceptBtn = this.modalEl.querySelector('#disclaimer-accept-btn');
        acceptBtn.addEventListener('click', () => this._handleAccept());

        // Focus trapping - keep focus inside modal when open
        this._handleFocusTrap = (e) => {
            if (e.key !== 'Tab') return;
            if (!this.modalEl.classList.contains('is-open')) return;

            const focusable = this.modalEl.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeInsideModal = this.modalEl.contains(document.activeElement);

            if (!activeInsideModal) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
                return;
            }

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', this._handleFocusTrap);
    }

    _handleAccept() {
        setDisclaimerAccepted();

        // Use the Vanduo Modals API to close properly
        if (window.VanduoModals && window.VanduoModals.modals.has(this.modalEl)) {
            window.VanduoModals.close(this.modalEl);
        } else {
            // Fallback: remove is-open class directly
            this.modalEl.classList.remove('is-open');
            this.modalEl.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('body-modal-open');
        }

        this.onAccepted();
    }

    /**
     * Show the disclaimer modal.
     * Initialises it with Vanduo Modals if not already done, then opens it.
     */
    show() {
        if (!this.modalEl) return;

        // Register with Vanduo Modals if available
        if (window.VanduoModals) {
            // initModal only if not already registered
            if (!window.VanduoModals.modals.has(this.modalEl)) {
                window.VanduoModals.initModal(this.modalEl);
            }
            window.VanduoModals.open(this.modalEl);
        } else {
            // Fallback: show manually
            this.modalEl.classList.add('is-open');
            this.modalEl.setAttribute('aria-hidden', 'false');
            document.body.classList.add('body-modal-open');
        }

        // Focus the accept button when modal opens for accessibility
        requestAnimationFrame(() => {
            const acceptBtn = this.modalEl.querySelector('#disclaimer-accept-btn');
            if (acceptBtn) acceptBtn.focus();
        });
    }

    /** Programmatic close (e.g. for testing) */
    hide() {
        if (window.VanduoModals && window.VanduoModals.modals.has(this.modalEl)) {
            window.VanduoModals.close(this.modalEl);
        } else {
            this.modalEl.classList.remove('is-open');
            this.modalEl.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('body-modal-open');
        }
    }

    /** @returns {boolean} */
    isVisible() {
        return this.modalEl
            ? this.modalEl.classList.contains('is-open')
            : false;
    }
}
