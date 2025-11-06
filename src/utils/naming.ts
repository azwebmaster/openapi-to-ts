/**
 * Utility class for naming transformations with built-in caching for performance
 */
export class NamingUtils {
  private typeNameCache = new Map<string, string>();
  private propertyNameCache = new Map<string, string>();
  private methodNameCache = new Map<string, string>();
  private kebabCaseCache = new Map<string, string>();

  /**
   * Converts a string to TypeScript type name (PascalCase)
   */
  toTypeName(name: string): string {
    // Check cache first
    if (this.typeNameCache.has(name)) {
      return this.typeNameCache.get(name)!;
    }

    // Remove hyphens/underscores and capitalize the following character (whether letter or number)
    let result = name.replace(/[-_]([a-zA-Z0-9])/g, (_, char) => {
      // Capitalize letters, keep numbers as-is
      return /[a-z]/.test(char) ? char.toUpperCase() : char;
    });
    
    // Remove any remaining hyphens/underscores
    result = result.replace(/[-_]/g, '');
    
    // Capitalize first character if it's a letter
    result = result.replace(/^([a-z])/, (_, char) => char.toUpperCase());
    
    // TypeScript identifiers cannot start with a number - prefix with underscore if needed
    if (/^[0-9]/.test(result)) {
      result = '_' + result;
    }
    
    // Cache the result
    this.typeNameCache.set(name, result);
    return result;
  }

  /**
   * Converts a string to a valid TypeScript property name
   */
  toPropertyName(name: string): string {
    // Check cache first
    if (this.propertyNameCache.has(name)) {
      return this.propertyNameCache.get(name)!;
    }

    // Strip existing quotes if present (handle cases where name might already be quoted)
    let unquotedName = name.trim();
    if ((unquotedName.startsWith("'") && unquotedName.endsWith("'")) || 
        (unquotedName.startsWith('"') && unquotedName.endsWith('"'))) {
      unquotedName = unquotedName.slice(1, -1);
    }

    let result: string;
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(unquotedName)) {
      result = unquotedName;
    } else {
      result = `'${unquotedName}'`;
    }
    
    // Cache the result
    this.propertyNameCache.set(name, result);
    return result;
  }

  /**
   * Converts an operation ID to a valid method name
   */
  toMethodName(operationId: string): string {
    // OPTIMIZATION: Cache method name transformations
    if (this.methodNameCache.has(operationId)) {
      return this.methodNameCache.get(operationId)!;
    }

    // Handle namespace patterns: if operationId looks like clean namespace/method pattern,
    // take everything after the first separator. Otherwise, treat the whole thing as method name.
    let methodPart = operationId;
    
    // Check for both forward slash and dot separators
    if (operationId.includes('/')) {
      const parts = operationId.split('/');
      // If first part looks like a clean namespace (alphanumeric), use everything after first slash
      if (parts[0] && /^[a-zA-Z][a-zA-Z0-9]*$/.test(parts[0])) {
        methodPart = parts.slice(1).join('/');
      }
      // Otherwise treat the whole operationId as the method name
    } else if (operationId.includes('.')) {
      const parts = operationId.split('.');
      // If first part looks like a clean namespace (alphanumeric), use everything after first dot
      if (parts[0] && /^[a-zA-Z][a-zA-Z0-9]*$/.test(parts[0])) {
        methodPart = parts.slice(1).join('.');
      }
      // Otherwise treat the whole operationId as the method name
    }

    const result = methodPart
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .replace(/_([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/^./, c => c.toLowerCase());

    // Cache the result
    this.methodNameCache.set(operationId, result);
    return result;
  }

  /**
   * Converts a string to kebab-case
   */
  toKebabCase(str: string): string {
    // Check cache first
    if (this.kebabCaseCache.has(str)) {
      return this.kebabCaseCache.get(str)!;
    }

    const result = str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
    
    // Cache the result
    this.kebabCaseCache.set(str, result);
    return result;
  }

  /**
   * Converts a name to a valid JavaScript/TypeScript identifier (camelCase)
   */
  toValidIdentifier(name: string): string {
    // Convert a name to a valid JavaScript/TypeScript identifier (camelCase)
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .replace(/_([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/^./, c => c.toLowerCase());
  }

  /**
   * Clears all naming caches
   */
  clearCaches(): void {
    this.typeNameCache.clear();
    this.propertyNameCache.clear();
    this.methodNameCache.clear();
    this.kebabCaseCache.clear();
  }
}

