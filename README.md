# YouTube Summary Generator

A Chrome extension that uses Google's Gemini AI to generate real-time summaries of YouTube videos when you hover over them on the home page.

## Features

- Hover over YouTube video thumbnails to see an AI-generated summary
- Customizable hover delay
- Secure API key storage
- Works on YouTube home page and search results

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now appear in your Chrome toolbar

## Usage

1. Click on the extension icon in Chrome toolbar
2. Enter your Gemini API key (get one from [Google MakerSuite](https://makersuite.google.com/app/apikey))
3. Adjust the hover delay if desired (default is 1000ms)
4. Save your settings
5. Navigate to YouTube
6. Hover over any video thumbnail on the home page or search results
7. After the hover delay, a summary will appear below the thumbnail

## Getting a Gemini API Key

1. Visit [Google MakerSuite](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key and paste it into the extension settings

## Permissions

This extension requires the following permissions:
- `activeTab`: To interact with the YouTube page
- `scripting`: To inject content scripts
- `storage`: To save your API key and settings

## Privacy

- Your Gemini API key is stored locally in Chrome's synced storage
- Video information is sent to the Gemini API for summarization
- No data is collected by the extension developers

## Development

The extension is built using plain JavaScript, HTML, and CSS. It consists of:

- `manifest.json`: Extension configuration
- `content.js`: Main script that runs on YouTube pages
- `popup.html/js/css`: UI for the extension popup
- `styles.css`: Styling for the summary container

## License

MIT License 