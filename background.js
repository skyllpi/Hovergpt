// Background script for YouTube Summary Generator

// Constants
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Track active YouTube tabs
let activeYoutubeTabs = new Map();

// Set up the extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Summary Generator extension installed');
});

// Track tab updates to know which tabs have YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only track when the tab is fully loaded and it's a YouTube URL
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
    console.log(`YouTube detected in tab ${tabId}: ${tab.url}`);
    activeYoutubeTabs.set(tabId, { url: tab.url, contentScriptReady: false });
  }
});

// Track tab removals to clean up our tracking
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeYoutubeTabs.has(tabId)) {
    console.log(`Removing tracked YouTube tab ${tabId}`);
    activeYoutubeTabs.delete(tabId);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request, 'from:', sender);

  // Track when content script loads on a YouTube page
  if (request.action === 'contentScriptLoaded') {
    if (sender.tab) {
      console.log(`Content script loaded in tab ${sender.tab.id}: ${request.url}`);
      activeYoutubeTabs.set(sender.tab.id, { 
        url: request.url, 
        contentScriptReady: true 
      });
    }
    sendResponse({ status: 'acknowledged' });
    return true;
  }

  if (request.action === 'generateSummary') {
    generateSummary(request.data.apiKey, request.data.prompt)
      .then(summary => {
        sendResponse({ success: true, summary });
      })
      .catch(error => {
        console.error('Error generating summary:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to generate summary'
        });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  if (request.action === 'fetchVideoInfo') {
    fetchVideoInfo(request.data.videoId)
      .then(videoInfo => {
        sendResponse({ success: true, videoInfo });
      })
      .catch(error => {
        console.error('Error fetching video info:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to fetch video info'
        });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // Message to check if any YouTube tabs have content script active
  if (request.action === 'checkYoutubeTabs') {
    const youtubeTabs = Array.from(activeYoutubeTabs.entries());
    console.log('Current YouTube tabs:', youtubeTabs);
    sendResponse({ 
      youtubeTabs: youtubeTabs.map(([tabId, data]) => ({
        tabId,
        url: data.url,
        contentScriptReady: data.contentScriptReady
      }))
    });
    return false;
  }
  
  // Respond to ping messages to check if background script is alive
  if (request.action === 'ping') {
    console.log('Received ping, sending pong');
    sendResponse({ status: 'pong' });
    return true;
  }
});

// Generate summary using Gemini API
async function generateSummary(apiKey, prompt) {
  try {
    console.log('Sending request to Gemini API');
    
    if (!apiKey) {
      throw new Error('API key is missing or empty');
    }
    
    const requestUrl = `${GEMINI_API_URL}?key=${apiKey}`;
    
    // Updated format for gemini-2.0-flash model
    const requestBody = {
      contents: [{
        role: "user",
        parts: [{
          text: prompt
        }]
      }],
      generation_config: {
        temperature: 0.2,
        max_output_tokens: 100,
        top_p: 0.8,
        top_k: 40
      }
    };
    
    console.log('Request payload:', JSON.stringify(requestBody, null, 2));
    
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        let errorMessage = `API returned ${response.status}`;
        
        try {
          const errorData = await response.json();
          console.error('Error response data:', errorData);
          if (errorData && errorData.error) {
            errorMessage += `: ${errorData.error.message || JSON.stringify(errorData.error)}`;
          }
        } catch (jsonError) {
          // If we can't parse the error as JSON, just use the text
          const errorText = await response.text();
          errorMessage += `: ${errorText.substring(0, 100)}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('API response received:', data);
      
      // Updated response parsing for gemini-2.0-flash model
      if (data.candidates && data.candidates.length > 0 && 
          data.candidates[0].content && 
          data.candidates[0].content.parts && 
          data.candidates[0].content.parts.length > 0) {
        return data.candidates[0].content.parts[0].text;
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('No summary generated in API response');
      }
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      throw new Error(`Network error: ${fetchError.message}`);
    }
  } catch (error) {
    console.error('Error in generateSummary:', error);
    throw error;
  }
}

// Fetch video information
async function fetchVideoInfo(videoId) {
  try {
    console.log('Fetching video info for:', videoId);
    
    if (!videoId) {
      throw new Error('Video ID is missing or empty');
    }
    
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video page. Status: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Try multiple regex patterns for description
      let description = '';
      const descriptionPatterns = [
        /"description":{"simpleText":"([^"]+)"/,
        /"shortDescription":"([^"]+)"/,
        /<meta name="description" content="([^"]+)"/,
        /"description":\s*"([^"]+)"/
      ];
      
      for (const pattern of descriptionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          description = match[1];
          break;
        }
      }
      
      // If no description found, try a more general search
      if (!description) {
        const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
        if (metaMatch && metaMatch[1]) {
          description = metaMatch[1];
        }
      }
      
      // Try multiple regex patterns for channel name
      let channelTitle = '';
      const channelPatterns = [
        /"ownerChannelName":"([^"]+)"/,
        /"channelName":"([^"]+)"/,
        /<link itemprop="name" content="([^"]+)">/,
        /"ownerProfileUrl":"[^"]*","title":"([^"]+)"/
      ];
      
      for (const pattern of channelPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          channelTitle = match[1];
          break;
        }
      }
      
      // If no channel found, try a more general approach
      if (!channelTitle) {
        const authorMatch = html.match(/<link[^>]*rel="author"[^>]*name="([^"]*)"[^>]*>/i);
        if (authorMatch && authorMatch[1]) {
          channelTitle = authorMatch[1];
        }
      }
      
      console.log('Video info extracted:', {
        description: description ? 'Found' : 'Not found',
        channelTitle: channelTitle ? 'Found' : 'Not found'
      });
      
      return {
        description: description || 'No description available',
        channelTitle: channelTitle || 'Unknown channel'
      };
    } catch (fetchError) {
      console.error('Error fetching video info:', fetchError);
      throw new Error(`Failed to fetch video info: ${fetchError.message}`);
    }
  } catch (error) {
    console.error('Error in fetchVideoInfo:', error);
    throw error;
  }
} 