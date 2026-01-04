/**
 * Background Service Worker
 * Handles video downloads using chrome.downloads API
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_VIDEO') {
    handleVideoDownload(message.data)
      .then(downloadId => {
        sendResponse({ success: true, downloadId });
      })
      .catch(error => {
        console.error('Download failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }
});

async function handleVideoDownload({ url, filename, conversationId, messageIndex, fileIndex }) {
  try {
    // Extract filename from URL if not provided
    let finalFilename = filename;
    if (!finalFilename) {
      const urlParams = new URLSearchParams(new URL(url).search);
      const urlFilename = urlParams.get('filename');
      if (urlFilename) {
        finalFilename = urlFilename;
      } else {
        // Generate filename based on metadata
        const ext = 'mp4'; // Default extension
        finalFilename = `${conversationId}_msg${messageIndex}_video${fileIndex}.${ext}`;
      }
    }

    // Use chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: `gemini-videos/${finalFilename}`,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    console.log(`Download started: ${finalFilename} (ID: ${downloadId})`);
    return downloadId;

  } catch (error) {
    console.error('Error initiating download:', error);
    throw error;
  }
}

// Monitor download progress
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state) {
    if (downloadDelta.state.current === 'complete') {
      console.log(`Download completed: ${downloadDelta.id}`);
    } else if (downloadDelta.state.current === 'interrupted') {
      console.error(`Download interrupted: ${downloadDelta.id}`);
    }
  }
});
