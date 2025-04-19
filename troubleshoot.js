// Troubleshooting script for YouTube Summary Generator

document.addEventListener('DOMContentLoaded', () => {
  const extensionStatusEl = document.getElementById('extension-status');
  const apiKeyStatusEl = document.getElementById('api-key-status');
  const backgroundStatusEl = document.getElementById('background-status');
  const contentScriptStatusEl = document.getElementById('content-script-status');
  const runDiagnosticsBtn = document.getElementById('run-diagnostics');
  const logEl = document.getElementById('log');
  
  // Initialize
  runDiagnostics();
  
  // Event listeners
  runDiagnosticsBtn.addEventListener('click', runDiagnostics);
  
  // Run all diagnostics
  function runDiagnostics() {
    log('Starting diagnostics...');
    checkExtensionStatus();
    checkApiKey();
    checkBackgroundScript();
    checkContentScript();
  }
  
  // Check extension status
  function checkExtensionStatus() {
    try {
      if (chrome && chrome.runtime && chrome.runtime.id) {
        updateStatus(extensionStatusEl, 'success', 'Extension is active');
        log('Extension status: Active');
      } else {
        updateStatus(extensionStatusEl, 'error', 'Extension is not active');
        log('Extension status: Not active');
      }
    } catch (error) {
      updateStatus(extensionStatusEl, 'error', `Error checking extension: ${error.message}`);
      log(`Error checking extension: ${error.message}`);
    }
  }
  
  // Check API key
  function checkApiKey() {
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (chrome.runtime.lastError) {
        updateStatus(apiKeyStatusEl, 'error', `Error accessing storage: ${chrome.runtime.lastError.message}`);
        log(`Error accessing storage: ${chrome.runtime.lastError.message}`);
        return;
      }
      
      if (result.apiKey) {
        // Only show first few characters of API key for security
        const maskedKey = result.apiKey.substring(0, 4) + '****' + result.apiKey.substring(result.apiKey.length - 4);
        updateStatus(apiKeyStatusEl, 'success', `API key found: ${maskedKey}`);
        log('API key found (masked for security)');
      } else {
        updateStatus(apiKeyStatusEl, 'warning', 'No API key found. Click the extension icon to set up your API key.');
        log('No API key found');
      }
    });
  }
  
  // Check background script
  function checkBackgroundScript() {
    try {
      chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          updateStatus(backgroundStatusEl, 'error', `Background script error: ${chrome.runtime.lastError.message}`);
          log(`Background script error: ${chrome.runtime.lastError.message}`);
          return;
        }
        
        if (response && response.status === 'pong') {
          updateStatus(backgroundStatusEl, 'success', 'Background script is running');
          log('Background script status: Running');
        } else {
          updateStatus(backgroundStatusEl, 'error', 'Background script is not responding correctly');
          log('Background script status: Not responding correctly');
        }
      });
    } catch (error) {
      updateStatus(backgroundStatusEl, 'error', `Error checking background script: ${error.message}`);
      log(`Error checking background script: ${error.message}`);
    }
  }
  
  // Check if content script is active on any YouTube tabs
  function checkContentScript() {
    try {
      // Query for YouTube tabs
      chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
        if (chrome.runtime.lastError) {
          updateStatus(contentScriptStatusEl, 'error', `Error querying tabs: ${chrome.runtime.lastError.message}`);
          log(`Error querying tabs: ${chrome.runtime.lastError.message}`);
          return;
        }
        
        if (tabs.length === 0) {
          updateStatus(contentScriptStatusEl, 'warning', 'No YouTube tabs found. Open YouTube to use the extension.');
          log('No YouTube tabs found');
          return;
        }
        
        log(`Found ${tabs.length} YouTube tab(s)`);
        let checkedCount = 0;
        let activeCount = 0;
        
        // Check each tab
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
            checkedCount++;
            
            if (chrome.runtime.lastError) {
              log(`Tab ${tab.id}: Content script not loaded (${chrome.runtime.lastError.message})`);
            } else if (response && response.status === 'pong') {
              log(`Tab ${tab.id}: Content script active`);
              activeCount++;
            } else {
              log(`Tab ${tab.id}: Content script not responding correctly`);
            }
            
            // If all tabs checked, update status
            if (checkedCount === tabs.length) {
              if (activeCount > 0) {
                updateStatus(contentScriptStatusEl, 'success', `Content script active on ${activeCount} of ${tabs.length} YouTube tabs`);
              } else {
                updateStatus(contentScriptStatusEl, 'warning', 'Content script not active on any YouTube tabs. Try refreshing your YouTube tabs.');
              }
            }
          });
        });
      });
    } catch (error) {
      updateStatus(contentScriptStatusEl, 'error', `Error checking content script: ${error.message}`);
      log(`Error checking content script: ${error.message}`);
    }
  }
  
  // Update status element
  function updateStatus(element, type, message) {
    element.textContent = message;
    element.className = `status ${type}`;
  }
  
  // Add to log
  function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    logEl.textContent += `[${timestamp}] ${message}\n`;
    logEl.scrollTop = logEl.scrollHeight; // Scroll to bottom
  }
}); 