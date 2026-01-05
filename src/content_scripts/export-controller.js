/**
 * Gemini Chat Exporter - Export Controller
 * Coordinates UI and export service interaction
 */

(function() {
  'use strict';

  // ============================================================================
  // EXPORT CONTROLLER
  // ============================================================================
  window.ExportController = class ExportController {
    constructor() {
      this.exportService = new ExportService();
      this.button = null;
    }

    /**
     * Initialize controller - create UI and attach listeners
     */
    init() {
      this.createUI();
      this.attachEventListeners();
      this.observeStorageChanges();
    }

    /**
     * Create UI elements
     */
    createUI() {
      this.button = UIBuilder.createButton();
      document.body.appendChild(this.button);
    }

    /**
     * Attach event listeners to UI
     */
    attachEventListeners() {
      this.button.addEventListener('click', () => this.handleButtonClick());
    }

    /**
     * Handle export button click
     */
    async handleButtonClick() {
      this.button.disabled = true;
      this.button.textContent = 'Exporting...';

      try {
        await this.exportService.execute();
      } catch (error) {
        console.error('Export error:', error);
      } finally {
        this.button.disabled = false;
        this.button.textContent = 'Export';
      }
    }

    /**
     * Observe storage changes to show/hide button
     */
    observeStorageChanges() {
      const updateVisibility = () => {
        try {
          if (chrome?.storage?.sync) {
            chrome.storage.sync.get(['hideExportBtn'], (result) => {
              this.button.style.display = result.hideExportBtn ? 'none' : '';
            });
          }
        } catch (e) {
          console.error('Storage access error:', e);
        }
      };

      updateVisibility();

      const observer = new MutationObserver(updateVisibility);
      observer.observe(document.body, { childList: true, subtree: true });

      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && 'hideExportBtn' in changes) {
            updateVisibility();
          }
        });
      }
    }
  };

})();
