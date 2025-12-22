const fsPromises = require('fs').promises;
const path = require('path');

class DirectoryTree {
  constructor() {
    this.root = new Map();
    this.pathCount = 0;
    this.baseDirectory = null; // Store where the tree was built from
  }

  size() {
    return this.pathCount;
  }

  async buildFrom(dirPath, options = {}) {
    // Store the base directory for path resolution (only if not already set)
    if (!this.baseDirectory) {
      this.baseDirectory = dirPath;
    }

    const { maxDepth = 5, currentDepth = 0, skipHidden = false, skipPatterns = [] } = options;

    if (currentDepth >= maxDepth) return;

    try {
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip hidden directories unless explicitly included
        if (skipHidden && entry.name.startsWith('.') && entry.name !== '.claude') {
          continue;
        }

        // Skip patterns and exclude .claude working directories
        if (
          skipPatterns.some((pattern) => entry.name.includes(pattern)) ||
          entry.name === '.claude' ||
          dirPath.includes('/.claude')
        ) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        // Add path relative to the original root directory
        // If we're at depth 0, just add the directory name
        // Otherwise, add the full path
        if (currentDepth === 0) {
          this.addPath(entry.name); // Add relative path for first level
        } else {
          // For deeper levels, we need to construct the relative path
          const relativePath = path.relative(
            options.rootDir || dirPath.split(path.sep).slice(0, -currentDepth).join(path.sep),
            fullPath
          );
          this.addPath(relativePath);
        }

        // Recursively build subdirectories
        await this.buildFrom(fullPath, {
          maxDepth,
          currentDepth: currentDepth + 1,
          skipHidden,
          skipPatterns,
          rootDir: options.rootDir || dirPath,
        });
      }
    } catch (err) {
      // Permission denied or doesn't exist - skip silently
    }
  }

  addPath(fullPath) {
    const parts = fullPath.split(path.sep).filter((p) => p && p.trim());
    let current = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!current.has(part)) {
        current.set(part, {
          children: new Map(),
          fullPath: parts.slice(0, i + 1).join(path.sep),
          name: part,
        });
        this.pathCount++;
      }
      current = current.get(part).children;
    }
  }

  findBestMatch(hyphenatedPath) {
    // Extract base path
    let processedName = hyphenatedPath;
    let basePath = '';

    if (hyphenatedPath.startsWith('-Users-')) {
      processedName = hyphenatedPath.replace(/^-Users-/, '');
      // Base path is root since Users will be included in matched parts
      basePath = '/';
    } else if (hyphenatedPath.startsWith('-private-')) {
      processedName = hyphenatedPath.replace(/^-private-/, '');
      basePath = '/private/';
    } else {
      // For other paths, return as-is
      return hyphenatedPath;
    }

    const parts = processedName.split('-').filter((p) => p);

    // Quick validation: if first part looks like UUID or temp/analysis, skip
    if (parts.length > 0) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const tempPattern = /^(tmp|temp|analysis|trial)/i;
      if (uuidPattern.test(parts[0]) || tempPattern.test(parts[0])) {
        return hyphenatedPath; // Return original to indicate it's not a valid project
      }
    }

    // Walk tree to find longest matching path
    // Start from the appropriate node based on how the tree was built
    let startNode = this.root;
    let startMatched = [];

    if (hyphenatedPath.startsWith('-Users-')) {
      // If tree was built from /Users, then root contains user directories directly
      // If tree was built from root (/), then we need to navigate to Users first
      if (this.baseDirectory === '/Users') {
        // Tree built from /Users, root contains user dirs directly
        // No need to add 'Users' to matched since it's the base
        startNode = this.root;
        startMatched = [];
        basePath = '/Users'; // Base path includes Users
      } else {
        // Tree built from root, need to find Users node first
        if (this.root.has('Users')) {
          startNode = this.root.get('Users').children;
          startMatched = ['Users'];
        }
      }
    }

    const result = this.findLongestMatch(parts, startNode, startMatched);

    if (result.matched.length > 0) {
      // Use path.join to avoid double slashes
      const path = require('path');
      const resolvedPath = path.join(basePath, ...result.matched);
      // Verify this is actually a valid project path (has at least 3 components for user/project/subdir or user/meaningful-project)
      const pathComponents = resolvedPath.split('/').filter((p) => p);
      if (pathComponents.length >= 3) {
        // Additional check: make sure it's not just user + UUID/temp directories
        const lastComponent = pathComponents[pathComponents.length - 1];
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const tempPattern = /^(tmp|temp|analysis|trial)/i;

        if (!uuidPattern.test(lastComponent) && !tempPattern.test(lastComponent)) {
          return resolvedPath;
        }
      }
    }

    // Fallback: return original to indicate it's not a valid project path
    return hyphenatedPath;
  }

  findLongestMatch(parts, node, matched) {
    if (parts.length === 0) {
      return { matched, remaining: [] };
    }

    // Helper function to try a combination with optional trailing space
    function tryCombination(combination, node) {
      if (node.has(combination)) {
        return node.get(combination);
      }
      // Also try with trailing space (for directories like "Stage 2 95 RON 002inch ")
      if (node.has(combination + ' ')) {
        return node.get(combination + ' ');
      }
      return null;
    }

    // Only try combinations when we're at least 2 levels deep (after user/project)
    // This prevents trying combinations at the root level (e.g., "username Downloads")
    if (parts.length >= 2 && matched.length >= 1) {
      // Try full remaining parts as a single combination first (for directories like "volv-analytics-12345678")
      const fullCombined = parts.join('-');
      if (node.has(fullCombined)) {
        const childNode = node.get(fullCombined);
        matched.push(fullCombined);

        return this.findLongestMatch([], childNode.children, matched);
      }

      // Try 6-part combinations (like "Stage 2 95 RON 002inch")
      if (parts.length >= 6) {
        const sixPartSpaceCombined = parts.slice(0, 6).join(' ');
        const childNode = tryCombination(sixPartSpaceCombined, node);
        if (childNode) {
          matched.push(sixPartSpaceCombined + (node.has(sixPartSpaceCombined + ' ') ? ' ' : ''));

          return this.findLongestMatch(parts.slice(6), childNode.children, matched);
        }
      }

      // Try 5-part combinations (like "Stage 2 95 RON")
      if (parts.length >= 5) {
        const fivePartSpaceCombined = parts.slice(0, 5).join(' ');
        const childNode = tryCombination(fivePartSpaceCombined, node);
        if (childNode) {
          matched.push(fivePartSpaceCombined + (node.has(fivePartSpaceCombined + ' ') ? ' ' : ''));

          return this.findLongestMatch(parts.slice(5), childNode.children, matched);
        }
      }

      // Try 4-part combinations
      if (parts.length >= 4) {
        const fourPartSpaceCombined = parts.slice(0, 4).join(' ');
        const childNode = tryCombination(fourPartSpaceCombined, node);
        if (childNode) {
          matched.push(fourPartSpaceCombined + (node.has(fourPartSpaceCombined + ' ') ? ' ' : ''));

          return this.findLongestMatch(parts.slice(4), childNode.children, matched);
        }
      }

      // Try 3-part combinations
      if (parts.length >= 3) {
        const threePartSpaceCombined = parts.slice(0, 3).join(' ');
        const childNode = tryCombination(threePartSpaceCombined, node);
        if (childNode) {
          matched.push(
            threePartSpaceCombined + (node.has(threePartSpaceCombined + ' ') ? ' ' : '')
          );

          return this.findLongestMatch(parts.slice(3), childNode.children, matched);
        }
      }

      // Try 2-part combinations (for "Personal Vault")
      const twoPartSpaceCombined = parts[0] + ' ' + parts[1];
      const childNode = tryCombination(twoPartSpaceCombined, node);
      if (childNode) {
        matched.push(twoPartSpaceCombined + (node.has(twoPartSpaceCombined + ' ') ? ' ' : ''));

        return this.findLongestMatch(parts.slice(2), childNode.children, matched);
      }

      // Try 2-part hyphen combinations (for "volv-analytics")
      const twoPartHyphenCombined = parts[0] + '-' + parts[1];
      if (node.has(twoPartHyphenCombined)) {
        const childNode = node.get(twoPartHyphenCombined);
        matched.push(twoPartHyphenCombined);

        return this.findLongestMatch(parts.slice(2), childNode.children, matched);
      }
    }

    // If no combined match, try single part
    const candidate = parts[0];
    if (node.has(candidate)) {
      const childNode = node.get(candidate);
      matched.push(candidate);

      return this.findLongestMatch(parts.slice(1), childNode.children, matched);
    }

    // No match found for current part, append remaining as-is
    matched.push(...parts);
    return { matched, remaining: [] };
  }
}

module.exports = DirectoryTree;
