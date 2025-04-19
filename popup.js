// Popup script for YouTube Summary Generator

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const apiKeyInput = document.getElementById('api-key');
  const hoverDelayInput = document.getElementById('hover-delay');
  const saveButton = document.getElementById('save-btn');
  const statusMessage = document.getElementById('status-message');
  const troubleshootLink = document.getElementById('troubleshoot-link');
  
  // Add a notice element for YouTube tab status
  const youtubeNotice = document.createElement('div');
  youtubeNotice.className = 'youtube-notice';
  document.querySelector('.info').prepend(youtubeNotice);
  
  // Load saved settings and check YouTube tabs
  loadSettings();
  checkYoutubeTabs();
  
  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  troubleshootLink.addEventListener('click', openTroubleshootPage);
  
  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(['apiKey', 'hoverDelay'], (result) => {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
      
      if (result.hoverDelay) {
        hoverDelayInput.value = result.hoverDelay;
      }
    });
  }
  
  // Check if there are any YouTube tabs with content scripts loaded
  function checkYoutubeTabs() {
    try {
      chrome.runtime.sendMessage({ action: 'checkYoutubeTabs' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error checking YouTube tabs:', chrome.runtime.lastError.message);
          updateYoutubeNotice('error');
          return;
        }
        
        if (!response || !response.youtubeTabs) {
          updateYoutubeNotice('no-tabs');
          return;
        }
        
        const youtubeTabs = response.youtubeTabs;
        console.log('YouTube tabs:', youtubeTabs);
        
        if (youtubeTabs.length === 0) {
          updateYoutubeNotice('no-tabs');
        } else {
          const readyTabs = youtubeTabs.filter(tab => tab.contentScriptReady);
          if (readyTabs.length > 0) {
            updateYoutubeNotice('ready', readyTabs.length);
          } else {
            updateYoutubeNotice('not-ready', youtubeTabs.length);
          }
        }
      });
    } catch (error) {
      console.error('Error in checkYoutubeTabs:', error);
      updateYoutubeNotice('error');
    }
  }
  
  // Update the YouTube notice message
  function updateYoutubeNotice(status, count = 0) {
    switch (status) {
      case 'no-tabs':
        youtubeNotice.className = 'youtube-notice warning';
        youtubeNotice.innerHTML = '⚠️ No YouTube tabs open. <a href="https://www.youtube.com" target="_blank">Open YouTube</a> to use this extension.';
        break;
      case 'not-ready':
        youtubeNotice.className = 'youtube-notice warning';
        youtubeNotice.innerHTML = `⚠️ ${count} YouTube tab(s) open but extension not activated. <a href="#" id="refresh-tabs">Refresh YouTube tabs</a>.`;
        document.getElementById('refresh-tabs').addEventListener('click', refreshYoutubeTabs);
        break;
      case 'ready':
        youtubeNotice.className = 'youtube-notice success';
        youtubeNotice.innerHTML = `✅ Extension active on ${count} YouTube tab(s).`;
        break;
      case 'error':
        youtubeNotice.className = 'youtube-notice error';
        youtubeNotice.innerHTML = '❌ Error checking YouTube tabs. Try restarting the browser.';
        break;
    }
  }
  
  // Refresh all YouTube tabs to reload the content script
  function refreshYoutubeTabs(e) {
    if (e) e.preventDefault();
    
    chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError.message);
        showStatus('Error refreshing tabs', 'error');
        return;
      }
      
      if (tabs.length === 0) {
        showStatus('No YouTube tabs found', 'warning');
        return;
      }
      
      let refreshed = 0;
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id, {}, () => {
          refreshed++;
          if (refreshed === tabs.length) {
            showStatus(`Refreshed ${refreshed} YouTube tab(s)`, 'success');
            // Wait a bit for the tabs to reload before checking status again
            setTimeout(checkYoutubeTabs, 2000);
          }
        });
      });
    });
  }
  
  // Save settings to storage
  function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    const hoverDelay = parseInt(hoverDelayInput.value, 10);
    
    if (!apiKey) {
      showStatus('Please enter a valid API key', 'error');
      return;
    }
    
    if (isNaN(hoverDelay) || hoverDelay < 500 || hoverDelay > 5000) {
      showStatus('Hover delay must be between 500-5000ms', 'error');
      return;
    }
    
    // Save to Chrome storage
    chrome.storage.sync.set({
      apiKey: apiKey,
      hoverDelay: hoverDelay
    }, () => {
      showStatus('Settings saved successfully!', 'success');
      
      // Check if we have YouTube tabs to send messages to
      checkYoutubeTabs();
      
      // Send message to content script to update settings
      tryToUpdateActiveTab(apiKey, hoverDelay);
    });
  }
  
  // Try to update the active tab's content script safely
  function tryToUpdateActiveTab(apiKey, hoverDelay) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          console.log('No active tabs found');
          return;
        }
        
        const activeTab = tabs[0];
        if (!activeTab.url || !activeTab.url.includes('youtube.com')) {
          console.log('Active tab is not a YouTube page');
          return;
        }
        
        // Check if content script is ready by sending a ping
        try {
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'ping' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.log('Content script not ready or not available:', chrome.runtime.lastError.message);
                updateYoutubeNotice('not-ready', 1);
                return;
              }
              
              // Content script is ready, send the actual settings
              chrome.tabs.sendMessage(
                activeTab.id,
                {
                  action: 'updateSettings',
                  settings: {
                    apiKey: apiKey,
                    hoverDelay: hoverDelay
                  }
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.log('Error sending settings to content script:', chrome.runtime.lastError.message);
                  } else {
                    console.log('Settings updated in content script:', response);
                    updateYoutubeNotice('ready', 1);
                  }
                }
              );
            }
          );
        } catch (error) {
          console.error('Error sending message to tab:', error);
        }
      });
    } catch (error) {
      console.error('Error in tryToUpdateActiveTab:', error);
    }
  }
  
  // Open troubleshooting page
  function openTroubleshootPage(e) {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('troubleshoot.html')
    });
  }
  
  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    
    // Clear message after 3 seconds
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }
}); 