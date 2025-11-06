/**
 * Utility class for JSDoc generation
 */
export class JSDocUtils {
  /**
   * Escapes backticks and comment delimiters in text to avoid JSDoc syntax errors
   */
  escapeBackticks(text: string): string {
    let sanitized = text;
    // Remove backticks entirely to avoid template literal syntax errors in JSDoc
    sanitized = sanitized.replace(/`([^`]+)`/g, '$1');
    // Escape comment delimiters that would break JSDoc comments
    sanitized = sanitized.replace(/\*\//g, '* /'); // Replace */ with * / to avoid closing comment
    sanitized = sanitized.replace(/\/\*/g, '/ *'); // Replace /* with / * to avoid opening comment
    return sanitized;
  }

  /**
   * Generates a JSDoc comment for a schema with comprehensive metadata
   */
  generateJSDocComment(schema: any, propertyName?: string): string | undefined {
    // Early return if no relevant data
    if (!schema.description && !propertyName && !schema.type && !schema.enum && 
        schema.default === undefined && schema.example === undefined && 
        schema.const === undefined && !schema.format &&
        schema.minimum === undefined && schema.maximum === undefined &&
        schema.minLength === undefined && schema.maxLength === undefined && !schema.pattern &&
        schema.minItems === undefined && schema.maxItems === undefined &&
        schema.nullable !== true && schema.readOnly !== true && schema.writeOnly !== true) {
      return undefined;
    }

    const parts: string[] = [];

    // Main description
    if (schema.description) {
      parts.push(this.escapeBackticks(schema.description));
    } else if (propertyName) {
      // For properties without descriptions, provide a meaningful default
      parts.push(`${propertyName} property`);
    }

    // Add constraints and metadata in a compact format
    const constraints: string[] = [];

    // Type information - only add if we don't have a description
    if (!schema.description && schema.type) {
      constraints.push(`Type: ${schema.type}`);
    }

    // Default value
    if (schema.default !== undefined) {
      constraints.push(`Default: ${JSON.stringify(schema.default)}`);
    }

    // Example
    if (schema.example !== undefined) {
      constraints.push(`Example: ${JSON.stringify(schema.example)}`);
    }

    // Enum values - only process if enum exists and has values
    if (schema.enum?.length > 0) {
      constraints.push(`Allowed values: ${schema.enum.map((v: any) => JSON.stringify(v)).join(', ')}`);
    }

    // Const value
    if (schema.const !== undefined) {
      constraints.push(`Constant value: ${JSON.stringify(schema.const)}`);
    }

    // Format
    if (schema.format) {
      constraints.push(`Format: ${schema.format}`);
    }

    // Numeric constraints
    if (schema.minimum !== undefined) {
      constraints.push(`Minimum: ${schema.minimum}`);
    }
    if (schema.maximum !== undefined) {
      constraints.push(`Maximum: ${schema.maximum}`);
    }

    // String constraints
    if (schema.minLength !== undefined) {
      constraints.push(`Min length: ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined) {
      constraints.push(`Max length: ${schema.maxLength}`);
    }
    if (schema.pattern) {
      constraints.push(`Pattern: ${this.escapeBackticks(String(schema.pattern))}`);
    }

    // Array constraints
    if (schema.minItems !== undefined) {
      constraints.push(`Min items: ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined) {
      constraints.push(`Max items: ${schema.maxItems}`);
    }

    // Special flags
    if (schema.nullable === true) {
      constraints.push('Nullable: true');
    }
    if (schema.readOnly === true) {
      constraints.push('Read-only: true');
    }
    if (schema.writeOnly === true) {
      constraints.push('Write-only: true');
    }

    // Combine all parts into a single comment
    if (parts.length > 0 || constraints.length > 0) {
      const allParts = [...parts];
      if (constraints.length > 0) {
        allParts.push(constraints.join(', '));
      }
      return allParts.join('\n');
    }

    return undefined;
  }

  /**
   * Builds a comprehensive JSDoc for a property (returns raw content without formatting)
   */
  buildComprehensivePropertyJSDoc(propSchema: any, propName: string, indent: string = ''): string {
    const mainDescription = this.generateJSDocComment(propSchema, propName) || `${propName} property`;
    
    // For nested object properties, just return the main description
    // The nested properties will have their own JSDoc comments in the inline type
    if ((propSchema.type === 'object' || propSchema.properties) && propSchema.properties) {
      return mainDescription;
    }
    
    // For array of objects, we also skip the Properties section since items will have JSDoc
    if (propSchema.type === 'array' && propSchema.items) {
      const itemSchema = propSchema.items;
      if ((itemSchema.type === 'object' || itemSchema.properties) && itemSchema.properties) {
        return mainDescription;
      }
    }
    
    // For other types, return the main description
    return mainDescription;
  }
}

