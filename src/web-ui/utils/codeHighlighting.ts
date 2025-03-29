// Function to guess the language based on content
export const guessLanguage = (content: any): string => {
  // Default to json for object data
  if (typeof content === 'object') return 'json';

  const str = String(content);

  // HTML detection
  if (str.startsWith('<!DOCTYPE html>') || str.includes('<html') ||
      (str.includes('<') && str.includes('</') && str.includes('>'))) {
    return 'html';
  }

  // XML detection
  if (str.startsWith('<?xml') || (str.includes('<') && str.includes('</') &&
      str.includes('xmlns='))) {
    return 'xml';
  }

  // JavaScript/TypeScript detection
  if (str.includes('function') && (str.includes('{') || str.includes('=>'))) return 'javascript';
  if (str.includes('import ') && str.includes('from ')) return 'typescript';
  if (str.includes('class ') && str.includes('extends ')) return 'typescript';
  if (str.includes('const ') || str.includes('let ') || str.includes('var ')) return 'javascript';
  if (str.includes('export') && (str.includes('interface') || str.includes('type '))) return 'typescript';

  // CSS detection
  if (str.includes('{') && str.includes('}') &&
     (str.includes('px') || str.includes('em') || str.includes('rgb') ||
      str.includes('margin') || str.includes('padding'))) {
    return 'css';
  }

  // SQL detection
  if ((str.includes('SELECT') || str.includes('UPDATE') || str.includes('INSERT INTO') ||
       str.includes('DELETE FROM')) &&
      (str.includes('FROM') || str.includes('WHERE') || str.includes('VALUES'))) {
    return 'sql';
  }

  // Bash/Shell detection
  if (str.startsWith('#!') || str.startsWith('$') || str.includes('apt-get') ||
      str.includes('sudo') || str.includes('chmod') || str.includes('./')) {
    return 'bash';
  }

  // JSON detection
  try {
    if (str.trim().startsWith('{') || str.trim().startsWith('[')) {
      JSON.parse(str);
      return 'json';
    }
  } catch (e) {
    // Not valid JSON, continue with other checks
  }

  // Default for unknown
  return 'plaintext';
};