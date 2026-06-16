/**
 * api-resp-integration.js — Orchestration for the API-RESP wizard.
 *
 * Handles tab switching and initializes all tab UI classes on DOMContentLoaded.
 */

function openApiRespTab(index) {
  const tabs    = document.querySelectorAll('.tab');
  const panels  = document.querySelectorAll('.tab-content');

  tabs.forEach((btn, i) => btn.classList.toggle('active', i === index));
  panels.forEach((panel, i) => panel.classList.toggle('active', i === index));

  if (index === 0 && window.ApiRespConnectorUI) {
    ApiRespConnectorUI.loadConfig();
  }
  if (index === 1 && window.ApiRespSchemaUI) {
    ApiRespSchemaUI.load();
  }
  if (index === 2 && window.ApiRespMappingUI) {
    ApiRespMappingUI.loadFromSchema();
  }
  if (index === 3 && window.ApiRespValidationUI) {
    ApiRespValidationUI.loadFromMapping();
  }
  if (index === 4 && window.ApiRespPersistenceUI) {
    ApiRespPersistenceUI.load();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.ApiRespConnectorUI)   ApiRespConnectorUI.init();
  if (window.ApiRespSchemaUI)      ApiRespSchemaUI.init();
  if (window.ApiRespMappingUI)     ApiRespMappingUI.init();
  if (window.ApiRespValidationUI)  ApiRespValidationUI.init();
  if (window.ApiRespPersistenceUI) ApiRespPersistenceUI.init();

  // Open first tab
  openApiRespTab(0);
});
