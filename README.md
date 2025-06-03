# YouTube Summary Generator

A Chrome extension that uses Google's Gemini AI to generate real-time summaries of YouTube videos when you hover over them on the home page.

https://github.com/user-attachments/assets/b791519d-19a4-48e5-a898-9def1de5fed3


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
