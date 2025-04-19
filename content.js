// YouTube Summary Generator Content Script

// Configuration
let API_KEY = ''; // You'll need to add your Gemini API key here
let HOVER_DELAY = 1000; // Time in milliseconds before summary is generated
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Global variables
let hoverTimer = null;
let summaryContainer = null;
let currentVideoId = null;

// Initialize the extension
function initialize() {
  try {
    console.log('YouTube Summary Generator extension initialized');
    loadSettings();
    createSummaryContainer();
    observePageChanges();
    attachHoverListeners();
    setupMessageListener();
    
    // Notify background script that content script has loaded successfully
    chrome.runtime.sendMessage({ 
      action: 'contentScriptLoaded',
      url: window.location.href
    }).catch(err => {
      console.warn('Could not notify background script of content script load:', err);
    });
  } catch (error) {
    console.error('Initialization error:', error);
    showErrorMessage('Failed to initialize extension: ' + error.message);
  }
}

// Display error message on the page for debugging
function showErrorMessage(message, location = 'general') {
  console.error(`Error (${location}):`, message);
  
  if (summaryContainer) {
    summaryContainer.innerHTML = `<div class="yt-summary-error">Error (${location}): ${message}</div>`;
    summaryContainer.style.display = 'block';
  } else {
    // Create a floating error container if summary container doesn't exist
    const errorContainer = document.createElement('div');
    errorContainer.style.position = 'fixed';
    errorContainer.style.top = '10px';
    errorContainer.style.right = '10px';
    errorContainer.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorContainer.style.color = 'white';
    errorContainer.style.padding = '10px';
    errorContainer.style.borderRadius = '5px';
    errorContainer.style.zIndex = '9999';
    errorContainer.innerHTML = `Error (${location}): ${message}`;
    document.body.appendChild(errorContainer);
    
    // Remove after 10 seconds
    setTimeout(() => {
      document.body.removeChild(errorContainer);
    }, 10000);
  }
}

// Load settings from Chrome storage
function loadSettings() {
  try {
    chrome.storage.sync.get(['apiKey', 'hoverDelay'], (result) => {
      if (result.apiKey) {
        API_KEY = result.apiKey;
        console.log('API key loaded from storage');
      } else {
        console.warn('No API key found in storage');
      }
      
      if (result.hoverDelay) {
        HOVER_DELAY = result.hoverDelay;
        console.log('Hover delay loaded from storage:', HOVER_DELAY);
      }
    });
  } catch (error) {
    showErrorMessage('Failed to load settings: ' + error.message, 'loadSettings');
  }
}

// Set up message listener for settings updates
function setupMessageListener() {
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Message received:', message);
      
      // Respond to ping messages (used to check if content script is ready)
      if (message.action === 'ping') {
        console.log('Received ping message, sending pong');
        sendResponse({ status: 'pong' });
        return true;
      }
      
      if (message.action === 'updateSettings') {
        API_KEY = message.settings.apiKey;
        HOVER_DELAY = message.settings.hoverDelay;
        console.log('Settings updated:', message.settings);
        sendResponse({ status: 'success' });
      }
      return true; // Return true to indicate async response
    });
  } catch (error) {
    showErrorMessage('Failed to setup message listener: ' + error.message, 'setupMessageListener');
  }
}

// Create the floating summary container
function createSummaryContainer() {
  try {
    summaryContainer = document.createElement('div');
    summaryContainer.id = 'yt-summary-container';
    summaryContainer.className = 'yt-summary-container';
    summaryContainer.style.display = 'none';
    document.body.appendChild(summaryContainer);
  } catch (error) {
    showErrorMessage('Failed to create summary container: ' + error.message, 'createSummaryContainer');
  }
}

// MutationObserver to handle dynamically loaded content
function observePageChanges() {
  try {
    const observer = new MutationObserver((mutations) => {
      if (document.querySelectorAll('ytd-rich-grid-media, ytd-video-renderer').length > 0) {
        attachHoverListeners();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } catch (error) {
    showErrorMessage('Failed to observe page changes: ' + error.message, 'observePageChanges');
  }
}

// Attach hover event listeners to video thumbnails
function attachHoverListeners() {
  try {
    // Try different selectors for YouTube's video elements
    const selectors = [
      'ytd-rich-grid-media', 
      'ytd-video-renderer', 
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-reel-item-renderer'
    ];
    
    // Find all elements using all selectors
    let videoElements = [];
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector: ${selector}`);
        videoElements = [...videoElements, ...elements];
      }
    });
    
    console.log('Total video elements found:', videoElements.length);
    
    if (videoElements.length === 0) {
      console.warn('No video elements found on page, trying alternative approach');
      // Fallback to any elements containing thumbnails
      const thumbContainers = document.querySelectorAll('a[href*="watch?v="]');
      console.log('Found alternative thumbnails:', thumbContainers.length);
      videoElements = [...thumbContainers];
    }
    
    // Debugging: log all video elements data
    console.log('Video elements inspection:');
    videoElements.forEach((el, index) => {
      if (index < 5) { // Limit to first 5 to avoid console spam
        console.log(`Element ${index}:`, {
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          href: el.href || 'No href'
        });
      }
    });
    
    videoElements.forEach((videoElement, index) => {
      if (videoElement.hasAttribute('data-summary-attached')) {
        return;
      }
      
      // Try multiple selectors for thumbnails
      const thumbnailSelectors = [
        '#thumbnail', 
        'a[href*="watch?v="]', 
        'a[href*="youtu.be"]',
        '.yt-simple-endpoint',
        'a.ytd-thumbnail'
      ];
      
      let thumbnail = null;
      
      // Try each selector until we find a match
      for (const selector of thumbnailSelectors) {
        const element = videoElement.querySelector(selector);
        if (element) {
          thumbnail = element;
          console.log(`Found thumbnail with selector '${selector}' for element ${index}`);
          break;
        }
      }
      
      // If no thumbnail found with selectors, check if the element itself is a link
      if (!thumbnail && videoElement.tagName === 'A' && 
          (videoElement.href?.includes('watch?v=') || videoElement.href?.includes('youtu.be'))) {
        thumbnail = videoElement;
        console.log(`Element ${index} is itself a thumbnail link`);
      }
      
      if (!thumbnail) {
        console.warn(`No thumbnail found for video element ${index}`, videoElement);
        // Debug output all child elements to help find the right selector
        if (index < 3) { // Limit to first 3 to avoid console spam
          console.log('Child elements:');
          Array.from(videoElement.querySelectorAll('*')).slice(0, 10).forEach((child, childIndex) => {
            console.log(`Child ${childIndex}:`, {
              tagName: child.tagName,
              id: child.id, 
              className: child.className,
              href: child.href || 'No href'
            });
          });
        }
        return;
      }
      
      videoElement.setAttribute('data-summary-attached', 'true');
      
      thumbnail.addEventListener('mouseenter', (event) => {
        try {
          // Find the video container
          const videoItem = event.target.closest(selectors.join(', ')) || 
                           event.target.closest('a[href*="watch?v="]');
                           
          if (!videoItem) {
            console.warn('No video item found on hover');
            console.log('Hover target:', event.target);
            return;
          }
          
          // Try multiple selectors for title
          const titleSelectors = [
            '#video-title', 
            '[title]', 
            '.title', 
            '[aria-label]',
            'span.ytd-thumbnail-overlay-time-status-renderer'
          ];
          
          let titleElement = null;
          let videoTitle = '';
          
          // Try each selector until we find a match
          for (const selector of titleSelectors) {
            const element = videoItem.querySelector(selector);
            if (element) {
              titleElement = element;
              if (element.textContent) {
                videoTitle = element.textContent.trim();
              } else if (element.getAttribute('title')) {
                videoTitle = element.getAttribute('title').trim();
              } else if (element.getAttribute('aria-label')) {
                videoTitle = element.getAttribute('aria-label').trim();
              }
              
              if (videoTitle) {
                console.log(`Found title "${videoTitle}" with selector '${selector}'`);
                break;
              }
            }
          }
          
          // If no title found, try to get it from the video item itself
          if (!videoTitle) {
            if (videoItem.getAttribute('title')) {
              videoTitle = videoItem.getAttribute('title').trim();
              console.log(`Found title "${videoTitle}" from item title attribute`);
            } else if (videoItem.getAttribute('aria-label')) {
              videoTitle = videoItem.getAttribute('aria-label').trim();
              console.log(`Found title "${videoTitle}" from item aria-label`);
            }
          }
          
          if (!videoTitle) {
            console.warn('No title found for video, using fallback');
            videoTitle = 'Unknown Video Title';
          }
          
          // Get video ID either from the thumbnail href or from other sources
          let videoId = null;
          let extractionMethod = '';
          
          // Detailed debugging for videoId extraction
          console.log('Trying to extract video ID for:', {
            thumbnailHref: thumbnail.href || 'No href',
            thumbnailTagName: thumbnail.tagName,
            videoTitle: videoTitle
          });
          
          // Try multiple approaches to find the video ID
          if (thumbnail.href) {
            // Method 1: Extract from href attribute
            videoId = extractVideoId(thumbnail.href);
            if (videoId) extractionMethod = 'thumbnail.href';
          }
          
          if (!videoId) {
            // Method 2: Extract from thumbnail's parent element
            const linkElement = thumbnail.closest('a');
            if (linkElement && linkElement.href) {
              console.log('Trying parent link href:', linkElement.href);
              videoId = extractVideoId(linkElement.href);
              if (videoId) extractionMethod = 'parent link href';
            }
          }
          
          if (!videoId) {
            // Method 3: Extract from the video ID attribute directly
            const videoIdElement = videoItem.querySelector('[href*="watch?v="]');
            if (videoIdElement && videoIdElement.href) {
              console.log('Trying href from child element:', videoIdElement.href);
              videoId = extractVideoId(videoIdElement.href);
              if (videoId) extractionMethod = 'child element href';
            }
          }
          
          if (!videoId) {
            // Method 4: Find any element with a video ID
            const possibleElements = videoItem.querySelectorAll('a');
            console.log(`Found ${possibleElements.length} anchor elements to check`);
            for (const el of possibleElements) {
              if (el.href && el.href.includes('watch?v=')) {
                console.log('Trying anchor element href:', el.href);
                videoId = extractVideoId(el.href);
                if (videoId) {
                  extractionMethod = 'anchor element search';
                  break;
                }
              }
            }
          }
          
          if (!videoId) {
            // Method 5: Try to extract from data attributes
            const dataElements = videoItem.querySelectorAll('[data-video-id]');
            console.log(`Found ${dataElements.length} elements with data-video-id`);
            for (const el of dataElements) {
              const dataVideoId = el.getAttribute('data-video-id');
              if (dataVideoId) {
                console.log('Found data-video-id:', dataVideoId);
                videoId = dataVideoId;
                extractionMethod = 'data-video-id attribute';
                break;
              }
            }
          }
          
          if (!videoId) {
            // Method 6: Try to extract from any aria-label that might contain video ID
            const thumbnailImg = thumbnail.querySelector('img[src*="vi/"]');
            if (thumbnailImg && thumbnailImg.src) {
              console.log('Trying to extract from image src:', thumbnailImg.src);
              // Extract from thumbnail URL
              const match = thumbnailImg.src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
              if (match) {
                videoId = match[1];
                extractionMethod = 'thumbnail image src';
              }
            }
          }
          
          if (!videoId) {
            // Method 7: Try to extract from any of these data attributes that YouTube uses
            const dataAttributes = [
              'data-video-id', 'data-videoid', 'data-params', 'data-video-ids'
            ];
            
            for (const attr of dataAttributes) {
              const elements = videoItem.querySelectorAll(`[${attr}]`);
              for (const el of elements) {
                const value = el.getAttribute(attr);
                console.log(`Found ${attr}:`, value);
                if (value && value.length === 11) {
                  videoId = value;
                  extractionMethod = `${attr} attribute`;
                  break;
                }
              }
              if (videoId) break;
            }
          }
          
          if (!videoId) {
            // Method 8: Last resort, check ALL anchors on the page
            if (videoItem.innerHTML && videoItem.innerHTML.includes('watch?v=')) {
              const tempMatch = videoItem.innerHTML.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
              if (tempMatch && tempMatch[1]) {
                videoId = tempMatch[1];
                extractionMethod = 'HTML content scan';
              }
            }
          }
          
          if (!videoId) {
            console.warn('Could not extract video ID using any method for:', videoTitle);
            console.error('Video item details:', {
              innerHTML: videoItem.innerHTML.substring(0, 200) + '...',
              outerHTML: videoItem.outerHTML.substring(0, 200) + '...'
            });
            return;
          }
          
          console.log(`Hover detected for video: ${videoId} (${extractionMethod}), title: ${videoTitle}`);
          
          // Calculate position for the summary container
          const rect = thumbnail.getBoundingClientRect();
          
          // Position the summary container
          positionSummaryContainer(rect);
          
          // Clear any existing timer
          if (hoverTimer) {
            clearTimeout(hoverTimer);
          }
          
          // Show loading state
          summaryContainer.style.display = 'block';
          summaryContainer.innerHTML = '<div class="yt-summary-loading">Generating summary...</div>';
          
          // Set timer to generate summary after delay
          hoverTimer = setTimeout(() => {
            generateSummary(videoId, videoTitle);
          }, HOVER_DELAY);
        } catch (error) {
          showErrorMessage('Error during hover handling: ' + error.message, 'mouseenter');
          console.error('Detailed hover error:', error);
        }
      });
      
      thumbnail.addEventListener('mouseleave', () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        summaryContainer.style.display = 'none';
      });
    });
  } catch (error) {
    showErrorMessage('Failed to attach hover listeners: ' + error.message, 'attachHoverListeners');
    console.error('Detailed attach error:', error);
  }
}

// Extract video ID from URL
function extractVideoId(url) {
  try {
    if (!url) return null;
    console.log('Extracting video ID from URL:', url);
    
    // Handle different YouTube URL formats
    // 1. Standard watch URLs: https://www.youtube.com/watch?v=VIDEO_ID
    // 2. Shortened URLs: https://youtu.be/VIDEO_ID
    // 3. Embed URLs: https://www.youtube.com/embed/VIDEO_ID
    // 4. Playlist URLs: https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
    
    // Pattern for standard watch URLs
    let match = url.match(/(?:[?&]v=|\/embed\/|\/watch\?v=|\/watch\?.+&v=|youtu.be\/|\/v\/|data-video-id="|videoId="|\/videos\/|\/v\/|\/e\/|\/watch\#!v=|\/user\/\w+\/\w+\/|\/embed\/|\/v\/|\/\d\/|\/user\/\w+\/\w+\/|\/embed\/|\/v\/|\/\d\/)([a-zA-Z0-9_-]{11})/);
    
    if (match && match[1]) {
      console.log('Video ID extracted successfully:', match[1]);
      return match[1];
    }
    
    // Try alternative patterns
    // Pattern for shortened URLs
    match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      console.log('Video ID extracted from shortened URL:', match[1]);
      return match[1];
    }
    
    // Pattern for embed URLs
    match = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      console.log('Video ID extracted from embed URL:', match[1]);
      return match[1];
    }
    
    // Look for video IDs in any part of the URL
    match = url.match(/([a-zA-Z0-9_-]{11})/);
    if (match && match[1] && url.includes('youtube')) {
      console.log('Video ID extracted from general URL pattern:', match[1]);
      return match[1];
    }
    
    console.warn('Could not extract video ID from URL:', url);
    return null;
  } catch (error) {
    showErrorMessage('Failed to extract video ID: ' + error.message, 'extractVideoId');
    return null;
  }
}

// Generate summary using background script (avoiding CORS issues)
async function generateSummary(videoId, videoTitle) {
  if (!API_KEY) {
    summaryContainer.innerHTML = '<div class="yt-summary-error">Error: API key not configured. Please set your Gemini API key in the extension popup.</div>';
    return;
  }
  
  try {
    console.log('Generating summary for:', videoId, videoTitle);
    
    // First, fetch video description and metadata using background script
    console.log('Requesting video info from background script');
    const videoInfoResponse = await sendMessageToBackground({
      action: 'fetchVideoInfo',
      data: {
        videoId: videoId
      }
    });
    
    if (!videoInfoResponse.success) {
      throw new Error('Failed to fetch video info: ' + videoInfoResponse.error);
    }
    
    const videoInfo = videoInfoResponse.videoInfo;
    console.log('Video info received from background script:', videoInfo);
    
    // Construct the prompt for Gemini
    const prompt = `Please generate a 2-3 sentence summary of this YouTube video. 
Title: ${videoTitle}
Description: ${videoInfo.description || 'Not available'}
Channel: ${videoInfo.channelTitle || 'Unknown'}`;
    
    // Send request to background script to generate summary
    console.log('Requesting summary from background script');
    const summaryResponse = await sendMessageToBackground({
      action: 'generateSummary',
      data: {
        apiKey: API_KEY,
        prompt: prompt
      }
    });
    
    if (!summaryResponse.success) {
      throw new Error('Failed to generate summary: ' + summaryResponse.error);
    }
    
    const summary = summaryResponse.summary;
    console.log('Summary received from background script');
    
    summaryContainer.innerHTML = `<div class="yt-summary-content">${summary}</div>`;
  } catch (error) {
    console.error('Error generating summary:', error);
    summaryContainer.innerHTML = `<div class="yt-summary-error">Failed to generate summary. Error: ${error.message}</div>`;
    showErrorMessage('Failed to generate summary: ' + error.message, 'generateSummary');
  }
}

// Helper function to send messages to background script
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Position the summary container properly
function positionSummaryContainer(rect) {
  // Calculate position
  const containerTop = rect.bottom + window.scrollY;
  const containerLeft = rect.left + window.scrollX;
  const containerWidth = rect.width;
  
  // Reset classes
  summaryContainer.classList.remove('right-edge', 'bottom-edge');
  
  // Position the container
  summaryContainer.style.top = `${containerTop}px`;
  summaryContainer.style.left = `${containerLeft}px`;
  summaryContainer.style.width = `${containerWidth}px`;
  
  // Check if the container is outside the viewport and adjust if needed
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // After the container is positioned, get its dimensions
  const containerRect = summaryContainer.getBoundingClientRect();
  
  // Adjust horizontal position if needed
  if (containerRect.right > viewportWidth) {
    summaryContainer.classList.add('right-edge');
  }
  
  // Adjust vertical position if needed
  if (containerRect.bottom > viewportHeight) {
    summaryContainer.classList.add('bottom-edge');
  }
}

// Start the extension
initialize(); 