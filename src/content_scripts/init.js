/**
 * Gemini Chat Exporter - Initialization
 * Entry point for the content script
 */

(function() {
  'use strict';

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  const controller = new ExportController();
  controller.init();

})();
