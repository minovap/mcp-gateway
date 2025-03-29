import { LogMessage } from './types';

// Process batch messages in history
export const processBatchMessages = (messages: LogMessage[]): LogMessage[] => {
  let lastStartTime = null;
  const processedMessages = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Only process batch level messages
    if (msg.level !== 'batch') {
      processedMessages.push(msg);
      continue;
    }

    // Check if this is a [done] message
    const isDoneMessage = msg.message && msg.message.trim() === '[done]';

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
      // If not a [done] message, consider it a start unless it actually contains [done]
      if (msg.message && msg.message.trim() !== '[done]') {
        lastStartTime = new Date(msg.timestamp).getTime();
      }
      processedMessages.push(msg);
    }
  }

  return processedMessages;
};