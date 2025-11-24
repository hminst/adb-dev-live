/**
 * Shared utilities for publishing and tree operations
 * Used by language-rollout and tree-publish tools
 */

// Helper function for API options
export function getOpts(token, method = 'GET') {
  return {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// Helper function to extract org, repo, and path from full path
export function parseFullPath(fullPath) {
  // fullPath format: /{org}/{repo}/path/to/file.html
  const parts = fullPath.split('/').filter(p => p);
  if (parts.length < 2) {
    throw new Error(`Invalid path format: ${fullPath}`);
  }
  const org = parts[0];
  const repo = parts[1];
  let remainingPath = '/' + parts.slice(2).join('/');
  
  // Remove .html extension for preview/live URLs
  if (remainingPath.endsWith('.html')) {
    remainingPath = remainingPath.slice(0, -5);
  }
  
  return { org, repo, path: remainingPath };
}

// Function to push a page to preview
export async function pushToPreview(fullPath, token) {
  try {
    const { org, repo, path } = parseFullPath(fullPath);
    const url = `https://admin.hlx.page/preview/${org}/${repo}/main${path}`;
    
    const opts = getOpts(token, 'POST');
    const resp = await fetch(url, opts);
    
    if (!resp.ok) {
      return { 
        success: false, 
        message: `Could not push to preview: ${fullPath}`, 
        status: resp.status 
      };
    }
    
    return { 
      success: true, 
      message: `Successfully pushed to preview: ${fullPath}` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Error pushing to preview: ${error.message}` 
    };
  }
}

// Function to push a page to live
export async function pushToLive(fullPath, token) {
  try {
    const { org, repo, path } = parseFullPath(fullPath);
    const url = `https://admin.hlx.page/live/${org}/${repo}/main${path}`;
    
    const opts = getOpts(token, 'POST');
    const resp = await fetch(url, opts);
    
    if (!resp.ok) {
      return { 
        success: false, 
        message: `Could not push to live: ${fullPath}`, 
        status: resp.status 
      };
    }
    
    return { 
      success: true, 
      message: `Successfully published to live: ${fullPath}` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Error pushing to live: ${error.message}` 
    };
  }
}

// Function to push a page to both preview and/or live
// fullPath should include org and repo: /{org}/{repo}/path/to/file.html
export async function pushPage(fullPath, token, options = {}) {
  const { preview = false, live = false } = options;
  const results = { preview: null, live: null };
  
  if (preview) {
    results.preview = await pushToPreview(fullPath, token);
  }
  
  if (live) {
    results.live = await pushToLive(fullPath, token);
  }
  
  return results;
}

// Build hierarchical tree structure from flat file list
export function buildTreeStructure(files, basePath) {
  const tree = {};
  
  files.forEach(file => {
    const relativePath = file.path.replace(basePath, '');
    const parts = relativePath.split('/').filter(p => p);
    
    let current = tree;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? { __file: true, path: file.path } : {};
      }
      current = current[part];
    });
  });
  
  return tree;
}

// Render tree node recursively
export function renderTreeNode(node, name, level, basePath, parentPath = '') {
  const indent = '  '.repeat(level);
  const isFile = node.__file;
  const currentPath = parentPath ? `${parentPath}/${name}` : name;
  
  if (isFile) {
    return `
      <div class="tree-node" data-level="${level}" data-path="${currentPath}">
        <div class="tree-node-content">
          <span class="tree-connector">${indent}</span>
          <input type="checkbox" class="file-checkbox" data-path="${node.path}" id="file-${currentPath.replace(/\//g, '-')}">
          <label for="file-${currentPath.replace(/\//g, '-')}" class="tree-name">📄 ${name}</label>
        </div>
      </div>
    `;
  } else {
    let html = `
      <div class="tree-node" data-level="${level}" data-path="${currentPath}">
        <div class="tree-node-content">
          <span class="tree-connector">${indent}</span>
          <input type="checkbox" class="folder-checkbox" data-path="${currentPath}" id="folder-${currentPath.replace(/\//g, '-')}">
          <label for="folder-${currentPath.replace(/\//g, '-')}" class="tree-name">📁 ${name}</label>
        </div>
      </div>
    `;
    
    const children = Object.keys(node).filter(k => k !== '__file').sort();
    children.forEach(childName => {
      const childNode = node[childName];
      html += renderTreeNode(childNode, childName, level + 1, basePath, currentPath);
    });
    
    return html;
  }
}

