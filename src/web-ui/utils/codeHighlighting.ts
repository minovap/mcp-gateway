// Function to guess the language based on content and optionally a file path
export const guessLanguage = (content: any, filePath?: string): string => {
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

  // If content-based detection failed and filePath is provided, use extension as fallback
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'jsx': return 'jsx';
      case 'html': return 'html';
      case 'htm': return 'html';
      case 'css': return 'css';
      case 'scss': return 'scss';
      case 'less': return 'less';
      case 'py': return 'python';
      case 'rb': return 'ruby';
      case 'java': return 'java';
      case 'php': return 'php';
      case 'go': return 'go';
      case 'rs': return 'rust';
      case 'c': return 'c';
      case 'cpp': return 'cpp';
      case 'h': return 'c';
      case 'hpp': return 'cpp';
      case 'sh': return 'bash';
      case 'md': return 'markdown';
      case 'sql': return 'sql';
      case 'json': return 'json';
      case 'xml': return 'xml';
      case 'yaml': return 'yaml';
      case 'yml': return 'yaml';
    }
  }

  // Default for unknown
  return 'plaintext';
};