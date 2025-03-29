import {LogMessage, LogMessageForWeb} from './types';

// Process batch messages in history
export const processBatchMessages = (messages: LogMessageForWeb[]): LogMessageForWeb[] => {
  let lastStartTime = null;
  const processedMessages = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Only process batch level messages
    if (msg.tool_name !== 'batch_request') {
      processedMessages.push(msg);
      continue;
    }

    // Check if this is a [done] message
    const isDoneMessage = msg.type === 'response';

    if (isDoneMessage && lastStartTime) {
      // Create a modified message with the timing information
      const endTime = new Date(msg.timestamp).getTime();
      const durationSec = ((endTime - lastStartTime) / 1000).toFixed(3);

      processedMessages.push({
        ...msg,
        message: `✅ ${durationSec}s`
      });

      // Reset the last start time
      lastStartTime = null;
    } else {
      processedMessages.push(msg);
    }
  }

  return processedMessages;
};