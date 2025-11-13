import SwaggerParser from '@apidevtools/swagger-parser';
import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import * as https from 'https';
import * as http from 'http';
import { ProgressIndicator } from './utils/progress.js';
import { NamingUtils } from './utils/naming.js';
import { JSDocUtils } from './utils/jsdoc.js';
import {
  TypeOutputMode,
  ClientOutputMode,
  APIConfig,
  OTTConfig,
  GeneratorOptions,
  OpenAPIDocument,
  resolveHeadersEnvironmentVariables,
} from './types.js';

export class OpenAPIGenerator {
  private project: Project;
  private api: OpenAPIDocument | null = null;
  private namespace: string;
  private typeOutputMode: TypeOutputMode;
  private clientOutputMode: ClientOutputMode;
  private operationIds: string[] | undefined;
  private progress: ProgressIndicator;
  private naming: NamingUtils;
  private jsdoc: JSDocUtils;
  // Performance optimization: memoization caches
  private typeStringCache = new Map<string, string>();
  private schemaRefCache = new Map<string, any>();
  private parameterRefCache = new Map<string, any>();
  // Cache for collectUsedTypes result to avoid duplicate calls
  private cachedUsedTypes: string[] | null = null;
  // Cache for parameter schemas and response types
  private parameterSchemaCache = new Map<string, any>();
  private responseTypeCache = new Map<string, string>();

  constructor(private options: GeneratorOptions) {
    this.progress = new ProgressIndicator(options.noProgress || false);
    this.naming = new NamingUtils();
    this.jsdoc = new JSDocUtils();
    this.project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 3, // Bundler
        declaration: true,
        strict: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        verbatimModuleSyntax: true,
      },
    });
    this.namespace = options.namespace || 'API';
    this.typeOutputMode = options.typeOutputMode || TypeOutputMode.SingleFile;
    this.clientOutputMode = options.clientOutputMode || ClientOutputMode.SplitByNamespace;
    this.operationIds = options.operationIds;
    
    // Resolve environment variables in headers
    if (this.options.headers) {
      this.options.headers = resolveHeadersEnvironmentVariables(this.options.headers);
    }
  }

  async generate(): Promise<void> {
    // Clear caches at the start of each generation
    this.typeStringCache.clear();
    this.schemaRefCache.clear();
    this.parameterRefCache.clear();
    this.cachedUsedTypes = null;
    this.naming.clearCaches();
    this.parameterSchemaCache.clear();
    this.responseTypeCache.clear();

    let specInput: string | object = this.options.spec;

    // If spec is a URL, fetch it
    if (this.options.spec.startsWith('http://') || this.options.spec.startsWith('https://')) {
      this.progress.message('📥 Fetching OpenAPI spec from URL...');
      specInput = await this.fetchFromUrl(this.options.spec, this.options.headers);
    }

    this.progress.message('📄 Parsing OpenAPI specification...');
    this.api = await SwaggerParser.parse(specInput as any) as OpenAPIDocument; 

    // Filter operations based on configuration
    this.filterOperationsByConfig();

    await fs.mkdir(this.options.outputDir, { recursive: true });

    this.progress.message('🔨 Generating types...');
    await this.generateTypes();
    
    this.progress.message('🔨 Generating client...');
    if (this.clientOutputMode === ClientOutputMode.SplitByNamespace) {
      await this.generateClientSplitByNamespace();
    } else {
      await this.generateClient();
    }
    
    this.progress.message('🔨 Generating index...');
    await this.generateIndex();
    
    this.progress.message('💾 Saving files...');
    await this.project.save();
    this.progress.message('✅ Generation complete!');
  }

  public async fetchFromUrl(url: string, headers?: Record<string, string>): Promise<object> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;

      const options = {
        headers: {
          'User-Agent': 'openapi-generator-cli',
          ...headers
        }
      };

      const req = client.get(url, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirects
          this.fetchFromUrl(res.headers.location, headers).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: Failed to fetch OpenAPI spec from ${url}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // Try to parse as JSON first, then fall back to YAML parsing by SwaggerParser
            let parsed: object;
            try {
              parsed = JSON.parse(data);
            } catch {
              // If JSON parsing fails, return the raw data and let SwaggerParser handle YAML
              parsed = data as any;
            }
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse OpenAPI spec from ${url}: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to fetch OpenAPI spec from ${url}: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error(`Request timeout while fetching OpenAPI spec from ${url}`));
      });
    });
  }

  private async generateTypes(): Promise<void> {
    if (!this.api) return;

    // Support both OpenAPI 3.x (components.schemas) and OpenAPI 2.0 (definitions)
    const allSchemas = (this.api.components as any)?.schemas || (this.api as any)?.definitions || {};

    // Filter schemas to only include those used by the specified operations
    const usedTypeNames = this.collectUsedTypes();
    const filteredSchemas: Record<string, any> = {};

    // If no operationIds are specified, generate all types
    if (!this.operationIds || this.operationIds.length === 0) {
      Object.assign(filteredSchemas, allSchemas);
    } else {
      // Convert to Set for O(1) lookups instead of O(n) Array.includes()
      const usedTypeNamesSet = new Set(usedTypeNames);
      
      // Only include schemas that are referenced by the specified operations
      for (const [schemaName, schema] of Object.entries(allSchemas)) {
        const typeName = this.naming.toTypeName(schemaName);
        if (usedTypeNamesSet.has(typeName)) {
          filteredSchemas[schemaName] = schema;
        }
      }
    }

    switch (this.typeOutputMode) {
      case TypeOutputMode.FilePerType:
        await this.generateTypesInSeparateFiles(filteredSchemas);
        break;
      case TypeOutputMode.GroupByTag:
        await this.generateTypesGroupedByTag(filteredSchemas);
        break;
      case TypeOutputMode.SingleFile:
      default:
        await this.generateTypesInSingleFile(filteredSchemas);
        break;
    }
  }

  private async generateTypesInSingleFile(schemas: Record<string, any>): Promise<void> {
    const file = this.project.createSourceFile(
      path.join(this.options.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    const schemaEntries = Object.entries(schemas);
    this.progress.start(schemaEntries.length, '📝 Generating types');
    
    for (let i = 0; i < schemaEntries.length; i++) {
      const [name, schema] = schemaEntries[i];
      this.generateTypeFromSchema(file, name, schema);
      this.progress.update(i + 1, this.naming.toTypeName(name));
    }
    
    this.progress.complete();
  }

  private async generateTypesInSeparateFiles(schemas: Record<string, any>): Promise<void> {
    const typesDir = path.join(this.options.outputDir, 'types');
    await fs.mkdir(typesDir, { recursive: true });

    // Create an index file that re-exports all types
    const indexFile = this.project.createSourceFile(
      path.join(this.options.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    const schemaEntries = Object.entries(schemas);
    this.progress.start(schemaEntries.length, '📝 Generating type files');

    for (let i = 0; i < schemaEntries.length; i++) {
      const [name, schema] = schemaEntries[i];
      const fileName = this.naming.toKebabCase(name) + '.ts';
      const file = this.project.createSourceFile(
        path.join(typesDir, fileName),
        undefined,
        { overwrite: true }
      );

      // Generate the type first
      this.generateTypeFromSchema(file, name, schema);
      
      // Then extract only the types that are actually used in the generated code
      const usedTypes = this.extractUsedTypesFromFile(file);
      const allSchemas = (this.api?.components as any)?.schemas || (this.api as any)?.definitions || {};
      
      // Get the type name being defined in this file (exclude it from imports)
      const currentTypeName = this.naming.toTypeName(name);
      
      // Filter to only include types that exist in our schema (not built-ins)
      // and exclude the type being defined in this file
      const importedTypes = new Set<string>();
      for (const typeName of usedTypes) {
        // Skip the type being defined in this file
        if (typeName === currentTypeName) {
          continue;
        }
        
        // Check if this type exists in our schemas
        const schemaName = Object.keys(allSchemas).find(
          schemaName => this.naming.toTypeName(schemaName) === typeName
        );
        if (schemaName) {
          importedTypes.add(typeName);
        }
      }
      
      // Add imports only for types that are actually used
      if (importedTypes.size > 0) {
        // Group imports by file (for separate files mode)
        const importsByFile = new Map<string, Set<string>>();
        for (const typeName of importedTypes) {
          const schemaName = Object.keys(allSchemas).find(
            schemaName => this.naming.toTypeName(schemaName) === typeName
          );
          if (schemaName) {
            const fileName = this.naming.toKebabCase(schemaName);
            if (!importsByFile.has(fileName)) {
              importsByFile.set(fileName, new Set());
            }
            importsByFile.get(fileName)!.add(typeName);
          }
        }
        
        // Add imports grouped by file
        for (const [fileName, types] of importsByFile) {
          file.addImportDeclaration({
            moduleSpecifier: `./${fileName}.js`,
            namedImports: Array.from(types).sort(),
            isTypeOnly: true,
          });
        }
      }

      // Add re-export to index file
      indexFile.addExportDeclaration({
        moduleSpecifier: `./types/${this.naming.toKebabCase(name)}.js`,
        namedExports: [this.naming.toTypeName(name)],
      });

      this.progress.update(i + 1, this.naming.toTypeName(name));
    }

    this.progress.complete();
  }

  private async generateTypesGroupedByTag(schemas: Record<string, any>): Promise<void> {
    const typesDir = path.join(this.options.outputDir, 'types');
    await fs.mkdir(typesDir, { recursive: true });

    // Group schemas by their tags (if available) or create a default group
    const schemaGroups = this.groupSchemasByTag(schemas);

    // Create an index file that re-exports all types
    const indexFile = this.project.createSourceFile(
      path.join(this.options.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    const groupEntries = Object.entries(schemaGroups);
    const totalTypes = Object.values(schemaGroups).reduce((sum, group) => sum + Object.keys(group).length, 0);
    let processedTypes = 0;
    
    this.progress.start(totalTypes, '📝 Generating grouped types');

    for (const [groupName, groupSchemas] of groupEntries) {
      const fileName = this.naming.toKebabCase(groupName) + '.ts';
      const file = this.project.createSourceFile(
        path.join(typesDir, fileName),
        undefined,
        { overwrite: true }
      );

      // Generate all types in this group first
      for (const [typeName, schema] of Object.entries(groupSchemas)) {
        this.generateTypeFromSchema(file, typeName, schema);
        processedTypes++;
        this.progress.update(processedTypes, this.naming.toTypeName(typeName));
      }

      // Then extract only the types that are actually used in the generated code
      const usedTypes = this.extractUsedTypesFromFile(file);
      const allSchemas = (this.api?.components as any)?.schemas || (this.api as any)?.definitions || {};
      
      // Get the type names defined in this group (exclude them from imports)
      const currentGroupTypeNames = new Set(
        Object.keys(groupSchemas).map(schemaName => this.naming.toTypeName(schemaName))
      );
      
      // Filter to only include types that exist in our schema (not built-ins)
      // and that are not in the same group
      const importedTypesByGroup = new Map<string, Set<string>>();
      for (const typeName of usedTypes) {
        // Skip types defined in this group
        if (currentGroupTypeNames.has(typeName)) {
          continue;
        }
        
        // Check if this type exists in our schemas
        const schemaName = Object.keys(allSchemas).find(
          schemaName => this.naming.toTypeName(schemaName) === typeName
        );
        if (schemaName) {
          // Check if it's in a different group
          const depGroup = this.findSchemaGroup(schemaName, schemaGroups);
          if (depGroup && depGroup !== groupName) {
            if (!importedTypesByGroup.has(depGroup)) {
              importedTypesByGroup.set(depGroup, new Set());
            }
            importedTypesByGroup.get(depGroup)!.add(typeName);
          }
        }
      }
      
      // Add imports grouped by file
      for (const [depGroup, types] of importedTypesByGroup) {
        file.addImportDeclaration({
          moduleSpecifier: `./${this.naming.toKebabCase(depGroup)}.js`,
          namedImports: Array.from(types).sort(),
          isTypeOnly: true,
        });
      }

      // Add re-export to index file
      indexFile.addExportDeclaration({
        moduleSpecifier: `./types/${this.naming.toKebabCase(groupName)}.js`,
      });
    }
    
    this.progress.complete();
  }

  private extractDependencies(schema: any): string[] {
    const dependencies = new Set<string>();

    const extractFromSchema = (s: any) => {
      if (!s) return;

      if (s.$ref) {
        const refName = s.$ref.split('/').pop();
        if (refName) dependencies.add(refName);
      }

      if (s.anyOf || s.oneOf || s.allOf) {
        const schemas = s.anyOf || s.oneOf || s.allOf;
        schemas.forEach((subSchema: any) => extractFromSchema(subSchema));
      }

      if (s.type === 'array' && s.items) {
        extractFromSchema(s.items);
      }

      if (s.properties) {
        Object.values(s.properties).forEach((prop: any) => extractFromSchema(prop));
      }

      if (s.additionalProperties && typeof s.additionalProperties === 'object') {
        extractFromSchema(s.additionalProperties);
      }
    };

    extractFromSchema(schema);
    return Array.from(dependencies);
  }

  private groupSchemasByTag(schemas: Record<string, any>): Record<string, Record<string, any>> {
    const groups: Record<string, Record<string, any>> = {};

    // Try to infer groups from schema names or use a default group
    for (const [name, schema] of Object.entries(schemas)) {
      // Simple grouping strategy: group by common prefixes or use 'common'
      const groupName = this.inferGroupName(name, schema);

      if (!groups[groupName]) {
        groups[groupName] = {};
      }
      groups[groupName][name] = schema;
    }

    // If we only have one group, split it into logical groups
    if (Object.keys(groups).length === 1 && Object.keys(schemas).length > 10) {
      return this.splitIntoLogicalGroups(schemas);
    }

    return groups;
  }

  private inferGroupName(name: string, schema: any): string {
    // Check if schema has x-tag or x-group extension
    if (schema['x-tag']) return schema['x-tag'];
    if (schema['x-group']) return schema['x-group'];

    // Common patterns for grouping
    const patterns = [
      { regex: /^(User|Account|Auth|Login|Session)/i, group: 'auth' },
      { regex: /^(Product|Item|Catalog|Category)/i, group: 'catalog' },
      { regex: /^(Order|Cart|Checkout|Payment)/i, group: 'commerce' },
      { regex: /^(Error|Exception|Problem)/i, group: 'errors' },
      { regex: /^(Response|Request|Payload)/i, group: 'common' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(name)) {
        return pattern.group;
      }
    }

    return 'models';
  }

  private splitIntoLogicalGroups(schemas: Record<string, any>): Record<string, Record<string, any>> {
    const groups: Record<string, Record<string, any>> = {};

    for (const [name, schema] of Object.entries(schemas)) {
      const groupName = this.inferGroupName(name, schema);

      if (!groups[groupName]) {
        groups[groupName] = {};
      }
      groups[groupName][name] = schema;
    }

    return groups;
  }

  private findSchemaGroup(schemaName: string, groups: Record<string, Record<string, any>>): string | undefined {
    for (const [groupName, groupSchemas] of Object.entries(groups)) {
      if (groupSchemas[schemaName]) {
        return groupName;
      }
    }
    return undefined;
  }


  /**
   * Extracts inline schemas from a parent schema and generates named types for them.
   * This ensures all nested inline object schemas are converted to named types with comments.
   */
  private extractAndGenerateNestedInlineTypes(
    file: SourceFile,
    parentTypeName: string,
    schema: any,
    visited: Set<any> = new Set()
  ): void {
    if (!schema || typeof schema !== 'object' || visited.has(schema)) {
      return;
    }
    visited.add(schema);

    // Skip if it's a reference (already has a name)
    if (schema.$ref) {
      return;
    }

    // Handle composition schemas
    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const schemas = schema.anyOf || schema.oneOf || schema.allOf;
      schemas.forEach((s: any, index: number) => {
        if (!s.$ref && (s.type === 'object' || s.properties)) {
          const nestedTypeName = `${parentTypeName}${this.naming.toTypeName(schema.anyOf ? 'AnyOf' : schema.oneOf ? 'OneOf' : 'AllOf')}${index}`;
          if (!file.getTypeAlias(nestedTypeName)) {
            this.generateTypeFromSchema(file, nestedTypeName, s);
            this.extractAndGenerateNestedInlineTypes(file, nestedTypeName, s, visited);
          }
        } else if (!s.$ref) {
          this.extractAndGenerateNestedInlineTypes(file, parentTypeName, s, visited);
        }
      });
      return;
    }

    // Handle array items
    if (schema.type === 'array' && schema.items) {
      const itemSchema = schema.items;
      if (!itemSchema.$ref && (itemSchema.type === 'object' || itemSchema.properties)) {
        const nestedTypeName = `${parentTypeName}Item`;
        if (!file.getTypeAlias(nestedTypeName)) {
          this.generateTypeFromSchema(file, nestedTypeName, itemSchema);
          this.extractAndGenerateNestedInlineTypes(file, nestedTypeName, itemSchema, visited);
        }
      } else if (!itemSchema.$ref) {
        this.extractAndGenerateNestedInlineTypes(file, parentTypeName, itemSchema, visited);
      }
    }

    // Handle object properties
    if ((schema.type === 'object' || schema.properties) && schema.properties) {
      const properties = schema.properties;
      for (const [propName, propSchema] of Object.entries(properties)) {
        const prop = propSchema as any;
        
        // Skip if it's a reference
        if (prop.$ref) {
          continue;
        }

        // Generate named type for inline object schemas
        if (prop.type === 'object' || prop.properties) {
          const nestedTypeName = `${parentTypeName}${this.naming.toTypeName(propName)}`;
          if (!file.getTypeAlias(nestedTypeName)) {
            this.generateTypeFromSchema(file, nestedTypeName, prop);
            // Recursively extract nested schemas
            this.extractAndGenerateNestedInlineTypes(file, nestedTypeName, prop, visited);
          }
        } else if (prop.type === 'array' && prop.items) {
          const itemSchema = prop.items;
          if (!itemSchema.$ref && (itemSchema.type === 'object' || itemSchema.properties)) {
            const nestedTypeName = `${parentTypeName}${this.naming.toTypeName(propName)}Item`;
            if (!file.getTypeAlias(nestedTypeName)) {
              this.generateTypeFromSchema(file, nestedTypeName, itemSchema);
              this.extractAndGenerateNestedInlineTypes(file, nestedTypeName, itemSchema, visited);
            }
          } else if (!itemSchema.$ref) {
            this.extractAndGenerateNestedInlineTypes(file, parentTypeName, itemSchema, visited);
          }
        } else {
          // Recursively process non-object schemas that might contain nested objects
          this.extractAndGenerateNestedInlineTypes(file, parentTypeName, prop, visited);
        }
      }
    }

    // Handle additionalProperties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && !schema.additionalProperties.$ref) {
      if (schema.additionalProperties.type === 'object' || schema.additionalProperties.properties) {
        const nestedTypeName = `${parentTypeName}AdditionalProperty`;
        if (!file.getTypeAlias(nestedTypeName)) {
          this.generateTypeFromSchema(file, nestedTypeName, schema.additionalProperties);
          this.extractAndGenerateNestedInlineTypes(file, nestedTypeName, schema.additionalProperties, visited);
        }
      } else {
        this.extractAndGenerateNestedInlineTypes(file, parentTypeName, schema.additionalProperties, visited);
      }
    }

    visited.delete(schema);
  }

  /**
   * Gets the type string for a schema, generating inline object types with JSDoc comments on nested properties.
   */
  private getTypeStringWithNestedJSDoc(schema: any, visited: Set<any> = new Set()): string {
    if (!schema) return 'unknown';

    // If it's a reference, use the referenced type name
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return this.naming.toTypeName(refName);
    }

    // For inline object schemas, generate formatted inline type with JSDoc comments
    if ((schema.type === 'object' || schema.properties) && !schema.$ref && !visited.has(schema)) {
      return this.generateInlineObjectTypeWithJSDoc(schema, visited);
    }

    // For array items that are inline objects
    if (schema.type === 'array' && schema.items) {
      const itemSchema = schema.items;
      if (!itemSchema.$ref && (itemSchema.type === 'object' || itemSchema.properties)) {
        return `Array<${this.generateInlineObjectTypeWithJSDoc(itemSchema, visited)}>`;
      }
      // Fall back for non-object array items
      return `Array<${this.getTypeStringWithNestedJSDoc(itemSchema, visited)}>`;
    }

    // Handle composition schemas
    if (schema.anyOf) {
      const types = schema.anyOf.map((s: any) => this.getTypeStringWithNestedJSDoc(s, visited));
      return `(${types.join(' | ')})`;
    }
    if (schema.oneOf) {
      const types = schema.oneOf.map((s: any) => this.getTypeStringWithNestedJSDoc(s, visited));
      return `(${types.join(' | ')})`;
    }
    if (schema.allOf) {
      const types = schema.allOf.map((s: any) => this.getTypeStringWithNestedJSDoc(s, visited));
      return `(${types.join(' & ')})`;
    }

    // Handle nullable flag
    const baseType = this.getBaseTypeString(schema);
    if (schema.nullable === true) {
      return `(${baseType} | null)`;
    }

    // Fall back to regular getTypeString for primitives and other types
    return this.getTypeString(schema);
  }

  /**
   * Generates an inline object type string with JSDoc comments on nested properties.
   */
  private generateInlineObjectTypeWithJSDoc(schema: any, visited: Set<any> = new Set()): string {
    if (!schema || !schema.properties || visited.has(schema)) {
      return this.getTypeString(schema);
    }
    visited.add(schema);

    const required = schema.required || [];
    const requiredSet = new Set(required);
    const props: string[] = [];

    for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
      const prop = propSchema as any;
      const optional = !requiredSet.has(propName);
      const propType = this.getTypeStringWithNestedJSDoc(prop, visited);
      
      // Get JSDoc comment for this nested property
      const docComment = this.jsdoc.generateJSDocComment(prop, propName);
      
      if (docComment) {
        // Format with JSDoc comment (no indentation - ts-morph will add it)
        props.push(`/** ${docComment} */`);
      }
      
      // Format property (no indentation - ts-morph will add it)
      props.push(`${this.naming.toPropertyName(propName)}${optional ? '?' : ''}: ${propType};`);
    }

    visited.delete(schema);
    // Format properties with 2 spaces indentation
    const formattedProps = props.map(prop => `  ${prop}`);
    return `{\n${formattedProps.join('\n')}\n}`;
  }

  /**
   * Builds JSDoc comment for a property.
   * For nested object properties, we don't include the Properties section since
   * nested properties already have their own JSDoc comments in the inline type.
   */

  private generateTypeFromSchema(file: SourceFile, name: string, schema: any): void {
    // Handle composition schemas first
    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const typeString = this.getTypeString(schema);
      // For types, use description directly from schema
      const docComment = schema.description 
        ? this.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.naming.toTypeName(name),
        type: typeString,
        isExported: true,
      });
      
      // Add JSDoc comment if description exists
      if (docComment) {
        typeAlias.addJsDoc({
          description: docComment,
        });
      }
      return;
    }

    // Handle discriminated unions
    if (schema.discriminator) {
      const typeString = this.getTypeString(schema);
      // For types, use description directly from schema
      const docComment = schema.description 
        ? this.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.naming.toTypeName(name),
        type: typeString,
        isExported: true,
      });
      
      // Add JSDoc comment if description exists
      if (docComment) {
        typeAlias.addJsDoc({
          description: docComment,
        });
      }
      return;
    }

    if (schema.type === 'object' || schema.properties) {
      const typeName = this.naming.toTypeName(name);
      // For types, use description directly from schema, don't add "property" suffix
      const docComment = schema.description 
        ? this.jsdoc.escapeBackticks(schema.description)
        : undefined;

      // Build object type literal with JSDoc comments on properties
      const properties = schema.properties || {};
      const required = schema.required || [];
      const requiredSet = new Set(required);

      const propStrings: string[] = [];
      for (const [propName, propSchema] of Object.entries(properties)) {
        const prop = propSchema as any;
        const propType = this.getTypeStringWithNestedJSDoc(prop);
        const propNameFormatted = this.naming.toPropertyName(propName);
        const optional = !requiredSet.has(propName);
        
        // Get JSDoc comment for this property
        const propDocComment = this.jsdoc.generateJSDocComment(prop, propName);
        
        if (propDocComment) {
          // Format with JSDoc comment above the property (no indentation - ts-morph will add it)
          propStrings.push(`/** ${propDocComment} */`);
        }
        
        // Add property with proper formatting (no indentation - ts-morph will add it)
        propStrings.push(`${propNameFormatted}${optional ? '?' : ''}: ${propType};`);
      }

      // Build type string with proper 2-space indentation
      // Format properties with 2 spaces indentation
      const formattedProps = propStrings.map(prop => `  ${prop}`);
      let typeString = `{\n${formattedProps.join('\n')}\n}`;

      // Handle allOf inheritance (intersection types)
      if (schema.allOf) {
        const inheritanceTypes = schema.allOf
          .filter((s: any) => s.$ref)
          .map((s: any) => this.getTypeString(s));

        if (inheritanceTypes.length > 0) {
          typeString = `(${inheritanceTypes.join(' & ')} & ${typeString})`;
        }
      }

      // Add type alias - ts-morph will add base indentation
      const typeAlias = file.addTypeAlias({
        name: typeName,
        type: typeString,
        isExported: true,
      });
      
      // Add JSDoc comment if description exists
      if (docComment) {
        typeAlias.addJsDoc({
          description: docComment,
        });
      }
      
      // Fix indentation: ts-morph adds 4 spaces, we want 2 spaces total
      // So we need to remove 2 spaces from each line
      const currentType = typeAlias.getTypeNode();
      if (currentType) {
        const currentText = currentType.getText();
        // Replace 6 spaces with 2 spaces, 4 spaces with 0 spaces (for closing brace)
        const fixedText = currentText
          .replace(/^      /gm, '  ')  // 6 spaces -> 2 spaces
          .replace(/^    }/gm, '}');   // 4 spaces before closing brace -> 0 spaces
        currentType.replaceWithText(fixedText);
      }
    } else if (schema.enum) {
      // For types, use description directly from schema
      const docComment = schema.description 
        ? this.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.naming.toTypeName(name),
        type: schema.enum.map((v: any) => JSON.stringify(v)).join(' | '),
        isExported: true,
      });
      
      // Add JSDoc comment if description exists
      if (docComment) {
        typeAlias.addJsDoc({
          description: docComment,
        });
      }
    } else {
      // For types, use description directly from schema
      const docComment = schema.description 
        ? this.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.naming.toTypeName(name),
        type: this.getTypeString(schema),
        isExported: true,
      });
      
      // Add JSDoc comment if description exists
      if (docComment) {
        typeAlias.addJsDoc({
          description: docComment,
        });
      }
    }
  }

  public getTypeString(schema: any): string {
    if (!schema) return 'unknown';

    // Create a cache key from the schema
    // For $ref, use the ref directly as the key
    if (schema.$ref) {
      const cacheKey = `ref:${schema.$ref}`;
      if (this.typeStringCache.has(cacheKey)) {
        return this.typeStringCache.get(cacheKey)!;
      }
      const refName = schema.$ref.split('/').pop();
      const result = this.naming.toTypeName(refName);
      this.typeStringCache.set(cacheKey, result);
      return result;
    }

    // For other schemas, use JSON string as cache key (excluding $ref)
    // We need to be careful with circular references, so we'll cache by structure
    const schemaKey = this.getSchemaCacheKey(schema);
    if (schemaKey && this.typeStringCache.has(schemaKey)) {
      return this.typeStringCache.get(schemaKey)!;
    }

    let result: string;

    // Handle composition schemas
    if (schema.anyOf) {
      const types = schema.anyOf.map((s: any) => this.getTypeString(s));
      result = `(${types.join(' | ')})`;
    } else if (schema.oneOf) {
      const types = schema.oneOf.map((s: any) => this.getTypeString(s));
      // Handle discriminated unions
      if (schema.discriminator) {
        result = this.generateDiscriminatedUnion(schema, types);
      } else {
        result = `(${types.join(' | ')})`;
      }
    } else if (schema.allOf) {
      const types = schema.allOf.map((s: any) => this.getTypeString(s));
      result = `(${types.join(' & ')})`;
    } else if (schema.type && Array.isArray(schema.type)) {
      // Handle nullable types (OpenAPI 3.1)
      const types = schema.type.map((t: string) => {
        if (t === 'null') return 'null';
        return this.getPrimitiveType(t, schema);
      });
      result = types.join(' | ');
    } else if (schema.const !== undefined) {
      // Handle const values (OpenAPI 3.1)
      result = this.handleConst(schema);
    } else {
      // Handle nullable flag (OpenAPI 3.0)
      const baseType = this.getBaseTypeString(schema);
      if (schema.nullable === true) {
        result = `(${baseType} | null)`;
      } else {
        result = baseType;
      }
    }

    // Cache the result if we have a key
    if (schemaKey) {
      this.typeStringCache.set(schemaKey, result);
    }

    return result;
  }

  /**
   * Creates a cache key for a schema, avoiding circular references
   */
  private getSchemaCacheKey(schema: any, visited: Set<any> = new Set()): string | null {
    if (!schema || typeof schema !== 'object') return null;
    
    // Don't create keys for circular references
    if (visited.has(schema)) return null;
    visited.add(schema);

    // For simple schemas, create a deterministic key
    const parts: string[] = [];
    
    if (schema.type) parts.push(`type:${schema.type}`);
    if (schema.enum) parts.push(`enum:${JSON.stringify(schema.enum)}`);
    if (schema.const !== undefined) parts.push(`const:${JSON.stringify(schema.const)}`);
    if (schema.nullable !== undefined) parts.push(`nullable:${schema.nullable}`);
    if (schema.format) parts.push(`format:${schema.format}`);
    
    // For objects with properties, include property names but not full traversal
    if (schema.properties && typeof schema.properties === 'object') {
      const propKeys = Object.keys(schema.properties).sort().join(',');
      parts.push(`props:${propKeys}`);
      if (schema.required) {
        parts.push(`required:${JSON.stringify(schema.required.sort())}`);
      }
    }
    
    // For arrays, include items type hint
    if (schema.type === 'array' && schema.items) {
      // Only include a hint, not full traversal to avoid circular refs
      if (schema.items.$ref) {
        parts.push(`items:${schema.items.$ref}`);
      } else if (schema.items.type) {
        parts.push(`items:${schema.items.type}`);
      }
    }

    visited.delete(schema);
    
    if (parts.length === 0) return null;
    return parts.join('|');
  }

  public getBaseTypeString(schema: any): string {
    switch (schema.type) {
      case 'string':
        return schema.enum
          ? schema.enum.map((v: any) => JSON.stringify(v)).join(' | ')
          : 'string';
      case 'number':
      case 'integer':
        return schema.enum
          ? schema.enum.map((v: any) => v.toString()).join(' | ')
          : 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return `Array<${schema.items ? this.getTypeString(schema.items) : 'unknown'}>`;
      case 'object':
        if (schema.properties) {
          // Inline object type
          const required = schema.required || [];
          const requiredSet = new Set(required);
          const props = Object.entries(schema.properties || {}).map(([key, prop]: [string, any]) => {
            const optional = !requiredSet.has(key);
            const propType = this.getTypeString(prop);
            return `${this.naming.toPropertyName(key)}${optional ? '?' : ''}: ${propType}`;
          });
          return `{ ${props.join('; ')} }`;
        }
        if (schema.additionalProperties) {
          if (schema.additionalProperties === true) {
            return 'Record<string, unknown>';
          }
          return `Record<string, ${this.getTypeString(schema.additionalProperties)}>`;
        }
        return 'Record<string, unknown>';
      default:
        return 'unknown';
    }
  }

  public getPrimitiveType(type: string, schema: any): string {
    switch (type) {
      case 'string':
        return schema.enum
          ? schema.enum.map((v: any) => JSON.stringify(v)).join(' | ')
          : 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return `Array<${schema.items ? this.getTypeString(schema.items) : 'unknown'}>`;
      case 'object':
        return 'Record<string, unknown>';
      default:
        return 'unknown';
    }
  }

  public generateDiscriminatedUnion(schema: any, types: string[]): string {
    const discriminator = schema.discriminator;
    if (!discriminator || !discriminator.propertyName) {
      return types.join(' | ');
    }

    // If discriminator has mapping, use mapped types
    if (discriminator.mapping) {
      const mappedTypes = Object.entries(discriminator.mapping).map(([key, value]: [string, any]) => {
        let typeName: string;
        if (typeof value === 'string' && value.startsWith('#/')) {
          // Reference to component
          const refName = value.split('/').pop();
          typeName = this.naming.toTypeName(refName || '');
        } else {
          typeName = this.naming.toTypeName(key);
        }
        return `(${typeName} & { ${discriminator.propertyName}: "${key}" })`;
      });
      return mappedTypes.join(' | ');
    }

    return types.join(' | ');
  }

  public handleConst(schema: any): string {
    if (schema.const !== undefined) {
      if (typeof schema.const === 'string') {
        return `"${schema.const}"`;
      }
      return JSON.stringify(schema.const);
    }
    return 'unknown';
  }

  private async generateClient(): Promise<void> {
    const file = this.project.createSourceFile(
      path.join(this.options.outputDir, 'client.ts'),
      undefined,
      { overwrite: true }
    );

    file.addImportDeclaration({
      moduleSpecifier: 'axios',
      namedImports: ['AxiosInstance', 'AxiosRequestConfig', 'AxiosResponse'],
      isTypeOnly: true,
    });

    file.addImportDeclaration({
      moduleSpecifier: 'axios',
      defaultImport: 'axios',
    });

    // Note: Type imports for request/response types are not needed in client.ts
    // as they are only used in namespace implementation files, not in the client class itself.
    // The client only needs namespace operation interfaces and factory functions.

    const classDeclaration = file.addClass({
      name: `${this.namespace}Client`,
      isExported: true,
    });

    // Add JSDoc comments for the client class using OpenAPI info
    const classDocs: string[] = [];
    if (this.api?.info?.title) {
      classDocs.push(this.api.info.title);
    }
    if (this.api?.info?.description) {
      if (classDocs.length > 0) classDocs.push('');
      classDocs.push(this.api.info.description);
    }
    if (classDocs.length > 0) {
      classDeclaration.addJsDoc({
        description: classDocs.join('\n'),
      });
    }

    classDeclaration.addProperty({
      name: 'client',
      type: 'AxiosInstance',
      isReadonly: true,
      scope: 'private' as any,
    });

    // Expose the internal axios client for direct access
    classDeclaration.addProperty({
      name: 'axios',
      type: 'AxiosInstance',
      isReadonly: true,
      scope: 'public' as any,
      docs: [{ description: 'Access to the internal AxiosInstance for advanced usage' }],
    });

    classDeclaration.addConstructor({
      parameters: [
        {
          name: 'baseURL',
          type: 'string',
        },
        {
          name: 'config',
          type: 'AxiosRequestConfig',
          hasQuestionToken: true,
        },
      ],
      statements: [
        `this.client = axios.create({ baseURL, ...config });`,
        `this.axios = this.client;`,
      ],
    });

    if (!this.api || !this.api.paths) return;

    // Group operations by namespace (from operationId) and generate namespace properties
    const namespacedOperations = this.groupOperationsByNamespace();

    // Collect root namespaces and generate them with all their sub-operations
    const rootNamespaces = new Set<string>();
    // Pre-flatten all operations once instead of creating intermediate arrays
    const allOperations: Array<{ path: string; method: string; operation: any; operationId: string }> = [];
    for (const operations of Object.values(namespacedOperations)) {
      allOperations.push(...operations);
    }
    
    // Precompute separator for each root namespace to avoid repeated checks
    const rootNamespaceSeparators = new Map<string, string>();
    const rootNamespaceOperations = new Map<string, Array<{ path: string; method: string; operation: any; operationId: string }>>();
    
    // Calculate total operations for progress tracking
    const totalOperations = allOperations.length;
    let processedOperations = 0;
    
    if (totalOperations > 0) {
      this.progress.start(totalOperations, '🔧 Generating operations');
    }

    // Process namespaces directly - no sorting needed for performance
    // (Sorting adds overhead and doesn't improve performance)
    for (const [namespace, operations] of Object.entries(namespacedOperations)) {
      if (namespace === 'default') {
        // Add methods directly to the main class for operations without namespace
        for (const { path, method, operation, metadata } of operations) {
          this.generateMethod(classDeclaration, path, method, operation, undefined, false, metadata);
          processedOperations++;
          this.progress.update(processedOperations, operation.operationId || `${method.toUpperCase()} ${path}`);
        }
      } else {
        // OPTIMIZATION: Use pre-computed separator and root namespace from metadata
        const firstOp = operations[0];
        const separator = firstOp?.metadata?.separator || (namespace.includes('/') ? '/' : '.');
        const rootNamespace = firstOp?.metadata?.rootNamespace || namespace.split(separator)[0];
        rootNamespaces.add(rootNamespace);
        
        // Precompute operations for this root namespace
        if (!rootNamespaceOperations.has(rootNamespace)) {
          rootNamespaceOperations.set(rootNamespace, []);
          rootNamespaceSeparators.set(rootNamespace, separator);
        }
        rootNamespaceOperations.get(rootNamespace)!.push(...operations);
      }
    }

    // Generate each root namespace with all its sub-operations
    // Process root namespaces in insertion order (no sorting overhead)
    for (const rootNamespace of rootNamespaces) {
      const allRootOperations = rootNamespaceOperations.get(rootNamespace) || [];
      const separator = rootNamespaceSeparators.get(rootNamespace) || '/';
      
      // OPTIMIZATION: Use pre-computed parts from metadata if available
      const hasNested = allRootOperations.some((op: any) => {
        const parts = op.metadata?.parts || op.operationId.split(separator);
        return parts.length > 2;
      });
      
      if (hasNested) {
        this.generateNestedNamespace(classDeclaration, rootNamespace, allRootOperations);
        // Update progress for each operation in nested namespace
        for (const op of allRootOperations) {
          const { path, method, operation } = op as any;
          processedOperations++;
          this.progress.update(processedOperations, operation.operationId || `${method.toUpperCase()} ${path}`);
        }
      } else {
        this.generateNamespaceProperty(classDeclaration, rootNamespace, allRootOperations);
        // Update progress for each operation in namespace
        for (const op of allRootOperations) {
          const { path, method, operation } = op as any;
          processedOperations++;
          this.progress.update(processedOperations, operation.operationId || `${method.toUpperCase()} ${path}`);
        }
      }
    }
    
    if (totalOperations > 0) {
      this.progress.complete();
    }
  }

  private async generateClientSplitByNamespace(): Promise<void> {
    // Create main client file
    const mainFile = this.project.createSourceFile(
      path.join(this.options.outputDir, 'client.ts'),
      undefined,
      { overwrite: true }
    );

    mainFile.addImportDeclaration({
      moduleSpecifier: 'axios',
      namedImports: ['AxiosInstance', 'AxiosRequestConfig'],
      isTypeOnly: true,
    });

    mainFile.addImportDeclaration({
      moduleSpecifier: 'axios',
      defaultImport: 'axios',
    });

    // Note: Type imports for request/response types are not needed in client.ts
    // as they are only used in namespace implementation files, not in the client class itself.
    // The client only needs namespace operation interfaces and factory functions.
    // We'll collect types per-namespace for optimal imports (optimization #1).

    const classDeclaration = mainFile.addClass({
      name: `${this.namespace}Client`,
      isExported: true,
    });

    // Add JSDoc comments for the client class using OpenAPI info
    const classDocs: string[] = [];
    if (this.api?.info?.title) {
      classDocs.push(this.api.info.title);
    }
    if (this.api?.info?.description) {
      if (classDocs.length > 0) classDocs.push('');
      classDocs.push(this.api.info.description);
    }
    if (classDocs.length > 0) {
      classDeclaration.addJsDoc({
        description: classDocs.join('\n'),
      });
    }

    classDeclaration.addProperty({
      name: 'client',
      type: 'AxiosInstance',
      isReadonly: true,
      scope: 'private' as any,
    });

    // Expose the internal axios client for direct access
    classDeclaration.addProperty({
      name: 'axios',
      type: 'AxiosInstance',
      isReadonly: true,
      scope: 'public' as any,
      docs: [{ description: 'Access to the internal AxiosInstance for advanced usage' }],
    });

    classDeclaration.addConstructor({
      parameters: [
        {
          name: 'baseURL',
          type: 'string',
        },
        {
          name: 'config',
          type: 'AxiosRequestConfig',
          hasQuestionToken: true,
        },
      ],
      statements: [
        `this.client = axios.create({ baseURL, ...config });`,
        `this.axios = this.client;`,
      ],
    });

    if (!this.api || !this.api.paths) return;

    // Create namespace directory
    const namespacesDir = path.join(this.options.outputDir, 'namespaces');
    await fs.mkdir(namespacesDir, { recursive: true });

    // Group operations by namespace
    const namespacedOperations = this.groupOperationsByNamespace();

    // Separate operations into root namespaces
    const rootNamespaces = new Set<string>();
    const rootNamespaceOperations = new Map<string, Array<{ path: string; method: string; operation: any; operationId: string }>>();
    const rootNamespaceSeparators = new Map<string, string>();
    const allOperations: Array<{ path: string; method: string; operation: any; operationId: string }> = [];

    // Process namespaces directly - no sorting needed for performance
    // (Sorting adds overhead and doesn't improve performance)
    for (const [namespace, operations] of Object.entries(namespacedOperations)) {
      if (namespace === 'default') {
        // Default namespace operations stay in main file
        allOperations.push(...operations);
      } else {
        // OPTIMIZATION: Use pre-computed separator and root namespace from metadata
        const firstOp = operations[0];
        const separator = firstOp?.metadata?.separator || (namespace.includes('/') ? '/' : '.');
        const rootNamespace = firstOp?.metadata?.rootNamespace || namespace.split(separator)[0];
        rootNamespaces.add(rootNamespace);

        if (!rootNamespaceOperations.has(rootNamespace)) {
          rootNamespaceOperations.set(rootNamespace, []);
          rootNamespaceSeparators.set(rootNamespace, separator);
        }
        rootNamespaceOperations.get(rootNamespace)!.push(...operations);
        allOperations.push(...operations);
      }
    }

    // Calculate total operations for progress tracking
    const totalOperations = allOperations.length;
    let processedOperations = 0;

    if (totalOperations > 0) {
      this.progress.start(totalOperations, '🔧 Generating operations');
    }

    // Generate default namespace operations in main file
    const defaultOperations = namespacedOperations['default'] || [];
    for (const { path, method, operation, metadata } of defaultOperations) {
      this.generateMethod(classDeclaration, path, method, operation, undefined, false, metadata);
      processedOperations++;
      this.progress.update(processedOperations, operation.operationId || `${method.toUpperCase()} ${path}`);
    }

    // Generate separate files for each namespace
    // Process root namespaces in insertion order (no sorting overhead)
    for (const rootNamespace of rootNamespaces) {
      const operations = rootNamespaceOperations.get(rootNamespace) || [];
      const separator = rootNamespaceSeparators.get(rootNamespace) || '/';
      
      // Generate namespace file
      const namespaceFileName = this.naming.toKebabCase(rootNamespace) + '.ts';
      const namespaceFilePath = path.join(namespacesDir, namespaceFileName);
      
      // Remove existing file from project and disk to avoid ts-morph update conflicts
      const existingFile = this.project.getSourceFile(namespaceFilePath);
      if (existingFile) {
        this.project.removeSourceFile(existingFile);
      }
      
      // Delete file from disk and project if it exists to ensure clean recreation
      try {
        await fs.unlink(namespaceFilePath);
      } catch (error: any) {
        // Ignore ENOENT (file doesn't exist) errors
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Create file with empty content first to avoid ts-morph trying to load existing content
      const namespaceFile = this.project.createSourceFile(
        namespaceFilePath,
        '',
        { overwrite: true }
      );

      // Add imports (file is fresh, no need to check for existing)
      namespaceFile.addImportDeclaration({
        moduleSpecifier: 'axios',
        namedImports: ['AxiosInstance', 'AxiosRequestConfig', 'AxiosResponse'],
        isTypeOnly: true,
      });

      // Optimization #1: Collect only types used by this specific namespace
      // First collect types from schemas
      let namespaceUsedTypes = this.collectUsedTypesForNamespace(operations);
      
      // Create namespace type alias
      const namespaceInterfaceName = `${this.naming.toTypeName(rootNamespace)}Operations`;
      
      // Create namespace implementation class
      const namespaceClassName = `${this.naming.toTypeName(rootNamespace)}Namespace`;
      const namespaceClass = namespaceFile.addClass({
        name: namespaceClassName,
        isExported: true,
      });

      namespaceClass.addProperty({
        name: 'client',
        type: 'AxiosInstance',
        isReadonly: true,
        scope: 'private' as any,
      });

      namespaceClass.addConstructor({
        parameters: [{
          name: 'client',
          type: 'AxiosInstance',
        }],
        statements: [
          'this.client = client;',
        ],
      });

      // OPTIMIZATION: Use pre-computed parts from metadata if available
      const hasNested = operations.some((op: any) => {
        const parts = op.metadata?.parts || op.operationId.split(separator);
        return parts.length > 2;
      });

      // Build namespace type with methods and properties
      const methodSignatures: string[] = [];
      const properties: string[] = [];

      if (hasNested) {
        // Handle nested namespaces
        const { methods, props } = this.buildNestedNamespaceTypeForSplit(namespaceClass, rootNamespace, operations, separator, namespaceFile);
        methodSignatures.push(...methods);
        properties.push(...props);
        
        // Update progress for each operation in nested namespace
        for (const op of operations) {
          const { path, method, operation } = op as any;
          processedOperations++;
          this.progress.update(processedOperations, operation.operationId || `${method.toUpperCase()} ${path}`);
        }
      } else {
        // Generate simple namespace with direct methods
        for (const op of operations) {
          const { path, method, operation, operationId, metadata } = op as any;
          // Build method signature string
          const methodSig = this.buildMethodSignatureString(namespaceFile, path, method, operation, operationId);
          methodSignatures.push(methodSig);
          
          // Generate implementation method - must be public to match type
          this.generateMethod(namespaceClass, path, method, operation, undefined, true, metadata);
          
          // Update progress for each operation
          processedOperations++;
          this.progress.update(processedOperations, operation.operationId || `${method.toUpperCase()} ${path}`);
        }
      }
      
      // After generating method signatures, extract types from them
      // This catches types that are referenced in method signatures but not in schemas
      const usedTypesSet = new Set(namespaceUsedTypes);
      
      // Collect parameter type names that are generated inline (not imported)
      const inlineParamTypes = new Set<string>();
      for (const op of operations) {
        const { operation, operationId } = op as any;
        const methodName = this.naming.toMethodName(operationId);
        const parameters = operation.parameters || [];
        if (parameters.length > 0) {
          inlineParamTypes.add(`${this.naming.toTypeName(methodName)}Params`);
        }
        if (operation.requestBody) {
          inlineParamTypes.add(`${this.naming.toTypeName(methodName)}Data`);
        }
      }
      
      for (const methodSig of methodSignatures) {
        this.extractTypeNamesFromTypeString(methodSig, usedTypesSet);
      }
      for (const prop of properties) {
        this.extractTypeNamesFromTypeString(prop, usedTypesSet);
      }
      
      // Remove inline parameter types and built-in types from the set
      // These are generated in the namespace file, not imported
      for (const inlineType of inlineParamTypes) {
        usedTypesSet.delete(inlineType);
      }
      
      // Extract types from the actual implementation methods to ensure we only import
      // types that are actually used in the code (not just in type signatures)
      // This is the source of truth - only types used in actual method implementations
      const actuallyUsedTypes = this.extractUsedTypesFromClassMethods(namespaceClass);
      
      // Use only types that appear in both method signatures AND actual implementations
      // This ensures we don't import types that are only referenced in type aliases
      const finalUsedTypes = new Set<string>();
      for (const typeName of actuallyUsedTypes) {
        // Skip inline parameter types
        if (inlineParamTypes.has(typeName)) {
          continue;
        }
        
        // Skip namespace class name and type alias name (these are defined in the namespace file)
        if (typeName === `${this.naming.toTypeName(rootNamespace)}Namespace` || 
            typeName === `${this.naming.toTypeName(rootNamespace)}Operations`) {
          continue;
        }
        
        // Only include if it was also in the method signatures (usedTypesSet)
        // This ensures we're importing types that are actually used
        if (usedTypesSet.has(typeName)) {
          finalUsedTypes.add(typeName);
        }
      }
      
      const allSchemas = (this.api?.components as any)?.schemas || (this.api as any)?.definitions || {};
      
      // Filter to only include types that exist in our schema (not built-ins or inline types)
      const importedTypes = new Set<string>();
      for (const typeName of finalUsedTypes) {
        // Skip inline parameter types
        if (inlineParamTypes.has(typeName)) {
          continue;
        }
        
        // Skip namespace class name and type alias name (these are defined in the namespace file)
        if (typeName === `${this.naming.toTypeName(rootNamespace)}Namespace` || 
            typeName === `${this.naming.toTypeName(rootNamespace)}Operations`) {
          continue;
        }
        
        // Check if this type exists in our schemas
        const schemaName = Object.keys(allSchemas).find(
          schemaName => this.naming.toTypeName(schemaName) === typeName
        );
        if (schemaName) {
          importedTypes.add(typeName);
        }
      }
      
      // Add imports only for types that are actually used
      if (importedTypes.size > 0) {
        namespaceFile.addImportDeclaration({
          moduleSpecifier: '../types.js',
          namedImports: Array.from(importedTypes).sort(),
          isTypeOnly: true,
        });
      }

      // Build object type literal
      const typeMembers: string[] = [...methodSignatures, ...properties];
      const typeString = `{ ${typeMembers.join('; ')} }`;
      const docComment = `${rootNamespace} namespace operations`;

      namespaceFile.addTypeAlias({
        name: namespaceInterfaceName,
        type: typeString,
        isExported: true,
        docs: [{ description: docComment }],
      });

      // Export factory function
      namespaceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{
          name: `create${this.naming.toTypeName(rootNamespace)}Namespace`,
          initializer: `(client: AxiosInstance) => new ${namespaceClassName}(client)`,
        }],
        isExported: true,
      });

      // Add namespace property to main client class
      // Use toValidIdentifier for property names to ensure TypeScript-safe identifiers (camelCase)
      const namespacePropertyName = this.naming.toValidIdentifier(rootNamespace);
      const namespaceTypeName = namespaceInterfaceName;

      // Import type separately as type-only
      mainFile.addImportDeclaration({
        moduleSpecifier: `./namespaces/${this.naming.toKebabCase(rootNamespace)}.js`,
        namedImports: [namespaceTypeName],
        isTypeOnly: true,
      });
      // Import factory function as value
      mainFile.addImportDeclaration({
        moduleSpecifier: `./namespaces/${this.naming.toKebabCase(rootNamespace)}.js`,
        namedImports: [`create${this.naming.toTypeName(rootNamespace)}Namespace`],
        isTypeOnly: false,
      });

      classDeclaration.addProperty({
        name: namespacePropertyName,
        type: namespaceTypeName,
        isReadonly: true,
        scope: 'public' as any,
        docs: [{ description: `${rootNamespace} namespace operations` }],
      });

      // Initialize namespace in constructor
      const constructor = classDeclaration.getConstructors()[0];
      if (constructor) {
        // Use the camelCase property name (already sanitized via toValidIdentifier)
        constructor.addStatements([`this.${namespacePropertyName} = create${this.naming.toTypeName(rootNamespace)}Namespace(this.client);`]);
      }

      // Progress is already updated per operation above, so we don't need to update here
    }

    if (totalOperations > 0) {
      this.progress.complete();
    }
  }

  private buildNestedNamespaceTypeForSplit(
    namespaceClass: any,
    rootNamespace: string,
    operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>,
    separator: string,
    file: SourceFile
  ): { methods: string[]; props: string[] } {
    // Similar to generateNestedNamespace but for split files
    // For now, generate flat structure - can be enhanced later
    
    // Pre-generate all request body types before building method signatures
    // This ensures ts-morph recognizes the types when serializing method signatures
    for (const { path, method, operation, operationId } of operations) {
      const requestBody = operation.requestBody;
      if (requestBody) {
        const contentType = Object.keys(requestBody.content || {})[0];
        const schema = requestBody.content?.[contentType]?.schema;
        if (schema && !schema.$ref) {
          const baseMethodName = this.naming.toMethodName(operationId);
          const typeName = `${this.naming.toTypeName(baseMethodName)}Data`;
          // Generate the type now if it doesn't exist
          const existingType = file.getTypeAlias(typeName);
          if (!existingType) {
            this.generateTypeFromSchema(file, typeName, schema);
          }
        }
      }
      // Also check for OpenAPI v2 body parameters
      const parameters = operation.parameters || [];
      const bodyParams = parameters.filter((param: any) => param.in === 'body');
      if (bodyParams.length > 0) {
        const bodyParam = bodyParams[0];
        const bodySchema = this.getParameterSchema(bodyParam);
        if (bodySchema && !bodySchema.$ref) {
          const baseMethodName = this.naming.toMethodName(operationId);
          const typeName = `${this.naming.toTypeName(baseMethodName)}Data`;
          // Generate the type now if it doesn't exist
          const existingType = file.getTypeAlias(typeName);
          if (!existingType) {
            this.generateTypeFromSchema(file, typeName, bodySchema);
          }
        }
      }
    }
    
    const methodSignatures: string[] = [];
    const properties: string[] = [];
    
    // Note: Progress updates are handled by the caller since we don't have access to processedOperations here
    for (const { path, method, operation, operationId, metadata } of operations) {
      // OPTIMIZATION: Use pre-computed method name from metadata if available
      const methodName = metadata?.methodName || this.naming.toMethodName(operationId);
      // Build method signature string
      const methodSig = this.buildMethodSignatureString(file, path, method, operation, operationId);
      methodSignatures.push(methodSig);
      // Methods must be public to match type
      this.generateMethod(namespaceClass, path, method, operation, methodName, true, metadata);
    }
    
    return { methods: methodSignatures, props: properties };
  }

  private generateNestedNamespaceForSplit(
    namespaceClass: any,
    namespaceInterface: any,
    rootNamespace: string,
    operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>,
    separator: string,
    file: SourceFile
  ): void {
    // Deprecated: Use buildNestedNamespaceTypeForSplit instead
    // This method is kept for backward compatibility but should not be used
    const { methods, props } = this.buildNestedNamespaceTypeForSplit(namespaceClass, rootNamespace, operations, separator, file);
    // The old interface-based approach is no longer used
  }

  private collectUsedTypes(): string[] {
    // Return cached result if available
    if (this.cachedUsedTypes !== null) {
      return this.cachedUsedTypes;
    }

    const usedTypes = new Set<string>();

    if (!this.api || !this.api.paths) {
      this.cachedUsedTypes = [];
      return [];
    }

    // Get all available schemas for reference resolution
    const allSchemas = (this.api.components as any)?.schemas || (this.api as any)?.definitions || {};

    // Use a shared visited set across all traversals to avoid reprocessing schemas
    const visited = new Set<string>();

    // Early filter: if operationIds are specified, only process matching operations
    const operationIdsSet = this.operationIds && this.operationIds.length > 0
      ? new Set(this.operationIds)
      : null;

    // Collect types from all operations
    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        if (item[method]) {
          const operation = item[method];
          const operationId = operation.operationId || `${method}_${path}`;

          // Skip if not in filter (optimization #2)
          if (operationIdsSet && !operationIdsSet.has(operationId)) {
            continue;
          }

          // Collect types from parameters
          const parameters = operation.parameters || [];
          for (const param of parameters) {
            const paramSchema = this.getParameterSchema(param);
            this.collectTypesFromSchema(paramSchema, usedTypes, allSchemas, visited);
          }

          // Collect types from request body
          if (operation.requestBody?.content) {
            for (const content of Object.values(operation.requestBody.content) as any[]) {
              if (content.schema) {
                this.collectTypesFromSchema(content.schema, usedTypes, allSchemas, visited);
              }
            }
          }

          // Collect types from success responses only (matching getResponseType logic)
          if (operation.responses) {
            const result = this.findBestResponseSchema(operation.responses);
            if (result && result.schema) {
              this.collectTypesFromSchema(result.schema, usedTypes, allSchemas, visited);
            }
          }
        }
      }
    }

    this.cachedUsedTypes = Array.from(usedTypes).sort();
    return this.cachedUsedTypes;
  }

  /**
   * Collects types used by a specific namespace's operations (optimization #1)
   * This allows namespace files to only import the types they actually use.
   */
  private collectUsedTypesForNamespace(operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>): string[] {
    if (operations.length === 0) {
      return [];
    }

    const usedTypes = new Set<string>();

    // Get all available schemas for reference resolution
    const allSchemas = (this.api?.components as any)?.schemas || (this.api as any)?.definitions || {};

    // Use a shared visited set across all traversals to avoid reprocessing schemas
    const visited = new Set<string>();

    // Collect types from this namespace's operations only
    for (const { operation } of operations) {
      // Collect types from parameters
      const parameters = operation.parameters || [];
      for (const param of parameters) {
        const paramSchema = this.getParameterSchema(param);
        this.collectTypesFromSchema(paramSchema, usedTypes, allSchemas, visited);
        // Also extract types from generated parameter type strings
        const paramType = this.getTypeString(paramSchema);
        if (paramType && paramType !== 'void' && paramType !== 'unknown') {
          this.extractTypeNamesFromTypeString(paramType, usedTypes);
        }
      }

      // Collect types from request body
      if (operation.requestBody?.content) {
        for (const content of Object.values(operation.requestBody.content) as any[]) {
          if (content.schema) {
            this.collectTypesFromSchema(content.schema, usedTypes, allSchemas, visited);
          }
        }
      }

      // Collect types from success responses only (matching getResponseType logic)
      if (operation.responses) {
        const result = this.findBestResponseSchema(operation.responses);
        if (result && result.schema) {
          this.collectTypesFromSchema(result.schema, usedTypes, allSchemas, visited);
        }
      }

      // Also collect types from generated type strings to catch any types that might be
      // referenced in complex type expressions (e.g., "Integration & { ... }")
      // This ensures we don't miss types that are part of allOf compositions
      const responseType = this.getResponseType(operation.responses);
      if (responseType && responseType !== 'void' && responseType !== 'unknown') {
        this.extractTypeNamesFromTypeString(responseType, usedTypes);
      }

      // Also check request body types
      if (operation.requestBody?.content) {
        for (const content of Object.values(operation.requestBody.content) as any[]) {
          if (content.schema) {
            const requestType = this.getTypeString(content.schema);
            if (requestType && requestType !== 'void' && requestType !== 'unknown') {
              this.extractTypeNamesFromTypeString(requestType, usedTypes);
            }
          }
        }
      }
    }

    return Array.from(usedTypes).sort();
  }

  private collectTypesFromSchema(schema: any, usedTypes: Set<string>, allSchemas: Record<string, any> = {}, visited: Set<string> = new Set()): void {
    if (!schema) return;

    // Handle $ref
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      if (refName) {
        const typeName = this.naming.toTypeName(refName);
        usedTypes.add(typeName);
        
        // Prevent infinite recursion by tracking visited schemas
        if (visited.has(schema.$ref)) {
          return;
        }
        visited.add(schema.$ref);
        
        // Resolve the referenced schema and continue traversal
        const referencedSchema = this.resolveSchemaReference(schema.$ref, allSchemas);
        if (referencedSchema) {
          this.collectTypesFromSchema(referencedSchema, usedTypes, allSchemas, visited);
        }
      }
      return;
    }

    // Handle composition schemas
    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const schemas = schema.anyOf || schema.oneOf || schema.allOf;
      for (const subSchema of schemas) {
        this.collectTypesFromSchema(subSchema, usedTypes, allSchemas, visited);
      }
      return;
    }

    // Handle arrays
    if (schema.type === 'array' && schema.items) {
      this.collectTypesFromSchema(schema.items, usedTypes, allSchemas, visited);
    }

    // Handle objects with properties
    if (schema.properties) {
      for (const propSchema of Object.values(schema.properties)) {
        this.collectTypesFromSchema(propSchema as any, usedTypes, allSchemas, visited);
      }
    }

    // Handle additional properties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      this.collectTypesFromSchema(schema.additionalProperties, usedTypes, allSchemas, visited);
    }
  }

  /**
   * Extracts TypeScript type names from a generated type string.
   * Handles complex type expressions like "Integration & { ... }", "Array<Type>", etc.
   * This ensures we don't miss types that are referenced in complex compositions.
   */
  private extractTypeNamesFromTypeString(typeString: string, usedTypes: Set<string>): void {
    if (!typeString || typeof typeString !== 'string') {
      return;
    }

    // Match TypeScript type names (valid identifiers)
    // This regex matches:
    // - Word boundaries followed by uppercase letters or underscore
    // - Followed by alphanumeric characters, underscores, and hyphens
    // - Excludes: primitive types (string, number, boolean, void, null, unknown, any)
    // - Excludes: keywords and utility types (Array, Record, Promise, etc.)
    const typeNamePattern = /\b([A-Z_][a-zA-Z0-9_]*)\b/g;
    const primitiveAndBuiltins = new Set([
      'string', 'number', 'boolean', 'void', 'null', 'unknown', 'any',
      'Array', 'Record', 'Promise', 'AxiosResponse', 'AxiosInstance', 'AxiosRequestConfig',
      'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract'
    ]);

    let match;
    while ((match = typeNamePattern.exec(typeString)) !== null) {
      const typeName = match[1];
      // Only add if it's not a primitive or built-in type
      if (!primitiveAndBuiltins.has(typeName)) {
        usedTypes.add(typeName);
      }
    }
  }

  private resolveSchemaReference(ref: string, allSchemas: Record<string, any>): any {
    // NOTE: After dereferencing the spec upfront, this method is rarely called since $ref
    // properties are resolved and inlined. This method is kept for backwards compatibility
    // and edge cases where references might still exist (e.g., external refs not dereferenced).
    if (!ref || !ref.startsWith('#')) {
      return null;
    }

    // Check cache first
    if (this.schemaRefCache.has(ref)) {
      return this.schemaRefCache.get(ref);
    }

    let result: any = null;

    // Handle OpenAPI 3.x references: #/components/schemas/SchemaName
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.split('/').pop();
      result = schemaName ? allSchemas[schemaName] : null;
    }
    // Handle OpenAPI 2.0 references: #/definitions/SchemaName
    else if (ref.startsWith('#/definitions/')) {
      const schemaName = ref.split('/').pop();
      result = schemaName ? allSchemas[schemaName] : null;
    }

    // Cache the result
    if (result !== null) {
      this.schemaRefCache.set(ref, result);
    }

    return result;
  }

  private resolveParameterReference(ref: string): any {
    // NOTE: After dereferencing the spec upfront, this method is rarely called since $ref
    // properties are resolved and inlined. This method is kept for backwards compatibility
    // and edge cases where references might still exist (e.g., external refs not dereferenced).
    if (!ref || !ref.startsWith('#')) {
      return null;
    }

    // Check cache first
    if (this.parameterRefCache.has(ref)) {
      return this.parameterRefCache.get(ref);
    }

    let result: any = null;

    // Handle OpenAPI 3.x references: #/components/parameters/ParameterName
    if (ref.startsWith('#/components/parameters/')) {
      const paramName = ref.split('/').pop();
      const allParameters = (this.api?.components as any)?.parameters || {};
      result = paramName ? allParameters[paramName] : null;
    }
    // Handle OpenAPI 2.0 references: #/parameters/ParameterName
    else if (ref.startsWith('#/parameters/')) {
      const paramName = ref.split('/').pop();
      const allParameters = (this.api as any)?.parameters || {};
      result = paramName ? allParameters[paramName] : null;
    }

    // Cache the result
    if (result !== null) {
      this.parameterRefCache.set(ref, result);
    }

    return result;
  }

  private groupPathsByTag(): Record<string, Array<{ path: string; method: string; operation: any }>> {
    const groups: Record<string, Array<{ path: string; method: string; operation: any }>> = {};

    if (!this.api || !this.api.paths) return groups;

    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        if (item[method]) {
          const operation = item[method];
          const tag = operation.tags?.[0] || 'default';
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push({ path, method, operation });
        }
      }
    }

    return groups;
  }

  private groupOperationsByNamespace(): Record<string, Array<{ path: string; method: string; operation: any; operationId: string; metadata: any }>> {
    const groups: Record<string, Array<{ path: string; method: string; operation: any; operationId: string; metadata: any }>> = {};
    const operationIdTracker = new Map<string, number>();

    if (!this.api || !this.api.paths) return groups;

    // Pre-compute HTTP methods array once
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      for (const method of httpMethods) {
        if (item[method]) {
          const operation = item[method];
          let operationId = operation.operationId || `${method}_${path}`;

          // Handle duplicate operationIds by appending a sequence number
          const originalOperationId = operationId;
          if (operationIdTracker.has(originalOperationId)) {
            const count = operationIdTracker.get(originalOperationId)! + 1;
            operationIdTracker.set(originalOperationId, count);
            operationId = `${originalOperationId}${count}`;
          } else {
            operationIdTracker.set(originalOperationId, 1);
          }

          // Extract namespace from operationId by splitting on '/' or '.' and creating full namespace path
          // OPTIMIZATION: Pre-compute namespace, separator, and method name to avoid repeated parsing
          let namespace = 'default';
          let separator: string | null = null;
          
          // HTTP method names that should not be treated as namespaces
          const httpMethodNames = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
          
          // Determine separator and namespace in one pass - cache the separator index
          const slashIndex = operationId.indexOf('/');
          const dotIndex = operationId.indexOf('.');
          
          let parts: string[] = [];
          if (slashIndex !== -1 && (dotIndex === -1 || slashIndex < dotIndex)) {
            separator = '/';
            parts = operationId.split('/');
            if (parts.length > 1) {
              const firstPart = parts[0];
              // Validate that the first part is a valid namespace:
              // - Must be alphanumeric (no underscores, hyphens, etc.)
              // - Must not be an HTTP method name
              // - Must not be empty
              if (firstPart && /^[a-zA-Z][a-zA-Z0-9]*$/.test(firstPart) && !httpMethodNames.has(firstPart.toLowerCase())) {
                namespace = parts.slice(0, -1).join('/');
              } else {
                // Invalid namespace, treat as default
                separator = null;
                parts = [];
              }
            }
          } else if (dotIndex !== -1) {
            separator = '.';
            parts = operationId.split('.');
            if (parts.length > 1) {
              const firstPart = parts[0];
              // Validate that the first part is a valid namespace:
              // - Must be alphanumeric (no underscores, hyphens, etc.)
              // - Must not be an HTTP method name
              // - Must not be empty
              if (firstPart && /^[a-zA-Z][a-zA-Z0-9]*$/.test(firstPart) && !httpMethodNames.has(firstPart.toLowerCase())) {
                namespace = parts.slice(0, -1).join('.');
              } else {
                // Invalid namespace, treat as default
                separator = null;
                parts = [];
              }
            }
          }

          // Pre-compute method name and type names to avoid repeated calls
          const baseMethodName = this.naming.toMethodName(operationId);
          const methodName = baseMethodName;
          const rootNamespace = separator ? parts[0] : null;

          // Pre-resolve all parameters once to avoid repeated resolution
          const parameters = operation.parameters || [];
          const resolvedParameters: any[] = [];
          const bodyParams: any[] = [];
          
          for (const param of parameters) {
            let resolvedParam = param;
            if (param.$ref) {
              resolvedParam = this.resolveParameterReference(param.$ref);
              if (!resolvedParam) continue;
            }
            resolvedParameters.push(resolvedParam);
            if (resolvedParam.in === 'body') {
              bodyParams.push(resolvedParam);
            }
          }

          // Pre-compute request body schema if exists
          let requestBodySchema: any = null;
          let requestBodyContentType: string | null = null;
          if (operation.requestBody) {
            requestBodyContentType = Object.keys(operation.requestBody.content || {})[0] || null;
            requestBodySchema = requestBodyContentType ? operation.requestBody.content?.[requestBodyContentType]?.schema : null;
          }

          // Store pre-computed metadata to avoid repeated computation
          const metadata = {
            baseMethodName,
            methodName,
            namespace,
            separator,
            rootNamespace,
            resolvedParameters,
            bodyParams,
            requestBodySchema,
            requestBodyContentType,
            parts,
          };

          if (!groups[namespace]) groups[namespace] = [];
          groups[namespace].push({ path, method, operation, operationId, metadata });
        }
      }
    }

    return groups;
  }

  private generateNamespaceProperty(classDeclaration: any, namespace: string, operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>): void {
    const file = classDeclaration.getSourceFile();

    // Create a type alias for the namespace methods
    const namespaceInterfaceName = `${this.naming.toTypeName(namespace)}Operations`;

    // Pre-generate all request body types before adding method signatures
    // This ensures ts-morph recognizes the types when serializing method signatures
    for (const { path, method, operation, operationId } of operations) {
      const requestBody = operation.requestBody;
      if (requestBody) {
        const contentType = Object.keys(requestBody.content || {})[0];
        const schema = requestBody.content?.[contentType]?.schema;
        if (schema && !schema.$ref) {
          const baseMethodName = this.naming.toMethodName(operationId);
          const typeName = `${this.naming.toTypeName(baseMethodName)}Data`;
          // Generate the type now if it doesn't exist
          const existingType = file.getTypeAlias(typeName);
          if (!existingType) {
            this.generateTypeFromSchema(file, typeName, schema);
          }
        }
      }
      // Also check for OpenAPI v2 body parameters
      const parameters = operation.parameters || [];
      const bodyParams = parameters.filter((param: any) => param.in === 'body');
      if (bodyParams.length > 0) {
        const bodyParam = bodyParams[0];
        const bodySchema = this.getParameterSchema(bodyParam);
        if (bodySchema && !bodySchema.$ref) {
          const baseMethodName = this.naming.toMethodName(operationId);
          const typeName = `${this.naming.toTypeName(baseMethodName)}Data`;
          // Generate the type now if it doesn't exist
          const existingType = file.getTypeAlias(typeName);
          if (!existingType) {
            this.generateTypeFromSchema(file, typeName, bodySchema);
          }
        }
      }
    }

    // Build method signature strings for the type alias
    const methodSignatures: string[] = [];
    for (const { path, method, operation, operationId, metadata } of operations) {
      // Build method signature string
      const methodSig = this.buildMethodSignatureString(file, path, method, operation, operationId);
      methodSignatures.push(methodSig);
    }

    // Build object type literal
    const typeString = `{ ${methodSignatures.join('; ')} }`;
    const docComment = `${namespace} namespace operations`;

    file.addTypeAlias({
      name: namespaceInterfaceName,
      type: typeString,
      isExported: true,
      docs: [{ description: docComment }],
    });

    // Sanitize namespace name for use as property identifier
    // Use toValidIdentifier for property names to ensure TypeScript-safe identifiers (camelCase)
    const sanitizedNamespace = this.naming.toValidIdentifier(namespace);
    const namespacePropertyName = sanitizedNamespace; // Use camelCase identifier for class properties

    // Add the namespace property to the main class
    classDeclaration.addProperty({
      name: namespacePropertyName,
      type: namespaceInterfaceName,
      isReadonly: true,
      scope: 'public' as any,
      docs: [{ description: `${namespace} namespace operations` }],
    });

    // Initialize the namespace property in the constructor
    const constructor = classDeclaration.getConstructors()[0];
    if (constructor) {
      const statements = constructor.getStatements();
      const initStatement = `this.${sanitizedNamespace} = {
${operations.map(({ operationId }) => {
        const methodName = this.naming.toMethodName(operationId);
        return `      ${methodName}: this.${sanitizedNamespace}_${methodName}.bind(this)`;
      }).join(',\n')}
    };`;

      constructor.addStatements([initStatement]);
    }

    // Generate the actual implementation methods as private methods
    for (const { path, method, operation, operationId, metadata } of operations) {
      // OPTIMIZATION: Use pre-computed method name from metadata if available
      const methodName = metadata?.methodName || this.naming.toMethodName(operationId);
      this.generateMethod(classDeclaration, path, method, operation, `${sanitizedNamespace}_${methodName}`, false, metadata);
    }
  }

  private generateNestedNamespace(classDeclaration: any, namespacePath: string, operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>): void {
    const file = classDeclaration.getSourceFile();
    
    // OPTIMIZATION: Use pre-computed separator and parts from metadata if available
    const firstOp = operations[0];
    const separator = firstOp?.metadata?.separator || (namespacePath.includes('/') ? '/' : '.');
    const namespaceParts = firstOp?.metadata?.parts ? firstOp.metadata.parts.slice(0, -1) : namespacePath.split(separator);

    // OPTIMIZATION: Use pre-computed root namespace from metadata
    const rootNamespace = namespaceParts[0];
    const allRootOperations = operations.filter(op => {
      // OPTIMIZATION: Use pre-computed root namespace if available
      const opRootNamespace = op.metadata?.rootNamespace;
      if (opRootNamespace) {
        return opRootNamespace === rootNamespace;
      }
      return op.operationId.startsWith(rootNamespace + separator);
    });

    // Build the nested namespace structure
    this.buildNestedNamespaceStructure(classDeclaration, namespaceParts, allRootOperations, separator);
  }

  private buildNestedNamespaceStructure(classDeclaration: any, namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string }>, separator: string = '/'): void {
    const file = classDeclaration.getSourceFile();
    
    // Create interfaces for each level of nesting
    this.createNestedInterfaces(file, namespaceParts, operations, separator);
    
    // Add the root namespace property to the main class if it doesn't exist
    const rootNamespace = namespaceParts[0];
    const sanitizedRootNamespace = this.naming.toValidIdentifier(rootNamespace);
    // Use toValidIdentifier for property names to ensure TypeScript-safe identifiers (camelCase)
    const rootNamespacePropertyName = this.naming.toValidIdentifier(rootNamespace);
    const rootInterfaceName = `${this.naming.toTypeName(rootNamespace)}Operations`;
    
    const existingProperty = classDeclaration.getProperty(rootNamespacePropertyName);
    if (!existingProperty) {
      classDeclaration.addProperty({
        name: rootNamespacePropertyName,
        type: rootInterfaceName,
        isReadonly: true,
        scope: 'public' as any,
        docs: [{ description: `${rootNamespace} namespace operations` }],
      });

      // Initialize in constructor
      const constructor = classDeclaration.getConstructors()[0];
      if (constructor) {
      // OPTIMIZATION: Use pre-computed root namespace from metadata
      const allRootOperations = operations.filter((op: any) => {
        const opRootNamespace = op.metadata?.rootNamespace;
        if (opRootNamespace) {
          return opRootNamespace === rootNamespace;
        }
        return op.operationId.startsWith(rootNamespace + separator);
      });
        const initStatement = this.buildNamespaceInitialization([sanitizedRootNamespace], allRootOperations, separator);
        constructor.addStatements([`this.${sanitizedRootNamespace} = ${initStatement};`]);
      }
    }

    // Generate the actual implementation methods as private methods
    for (const op of operations) {
      const { path, method, operation, operationId, metadata } = op as any;
      // OPTIMIZATION: Use pre-computed method name and parts from metadata if available
      const methodName = metadata?.methodName || this.naming.toMethodName(operationId);
      // Use the full operation namespace path, not just the initial namespaceParts
      // OPTIMIZATION: Use pre-computed parts from metadata if available
      const fullNamespacePath = metadata?.parts ? metadata.parts.slice(0, -1) : operationId.split(separator).slice(0, -1);
      const privateMethodName = this.getPrivateMethodName(fullNamespacePath, methodName);
      this.generateMethod(classDeclaration, path, method, operation, privateMethodName, false, metadata);
    }
  }

  private createNestedInterfaces(file: SourceFile, namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>, separator: string = '/'): void {
    // Find all unique namespace levels in the operations
    const allNamespaceLevels = new Set<string>();
    
    // OPTIMIZATION: Use pre-computed parts from metadata if available
    for (const operation of operations) {
      const opParts = operation.metadata?.parts || operation.operationId.split(separator);
      if (opParts.length > 1) {
        // Add all namespace levels for this operation
        for (let i = 1; i < opParts.length; i++) {
          const namespacePath = opParts.slice(0, i).join(separator);
          allNamespaceLevels.add(namespacePath);
        }
      }
    }

    // Convert to sorted array for consistent ordering
    const sortedLevels = Array.from(allNamespaceLevels).sort();

    // Create type aliases for each namespace level
    for (const namespacePath of sortedLevels) {
      const namespacePathParts = namespacePath.split(separator);
      const interfaceName = `${this.naming.toTypeName(namespacePathParts.join('_'))}Operations`;
      
      // Check if type already exists
      if (file.getTypeAlias(interfaceName)) {
        continue;
      }

      // OPTIMIZATION: Use pre-computed parts from metadata if available
      const directMethods = operations.filter(op => {
        const opParts = op.metadata?.parts || op.operationId.split(separator);
        return opParts.slice(0, -1).join(separator) === namespacePath;
      });

      // Build method signatures for direct methods
      const methodSignatures: string[] = [];
      for (const { path, method, operation, operationId } of directMethods) {
        const methodSig = this.buildMethodSignatureString(file, path, method, operation, operationId);
        methodSignatures.push(methodSig);
      }

      // OPTIMIZATION: Use pre-computed parts from metadata if available
      const subNamespaces = new Set<string>();
      for (const operation of operations) {
        const opParts = operation.metadata?.parts || operation.operationId.split(separator);
        if (opParts.length > namespacePathParts.length + 1) {
          const nextLevelParts = opParts.slice(0, namespacePathParts.length + 1);
          if (nextLevelParts.slice(0, namespacePathParts.length).join(separator) === namespacePath) {
            subNamespaces.add(nextLevelParts[namespacePathParts.length]);
          }
        }
      }

      // Build properties for sub-namespaces
      const properties: string[] = [];
      for (const subNamespace of subNamespaces) {
        const subNamespacePath = [...namespacePathParts, subNamespace];
        const subInterfaceName = `${this.naming.toTypeName(subNamespacePath.join('_'))}Operations`;
        // Use toValidIdentifier for property names to ensure consistency with class property names (camelCase)
        const subNamespacePropertyName = this.naming.toValidIdentifier(subNamespace);
        properties.push(`${subNamespacePropertyName}: ${subInterfaceName}`);
      }

      // Build object type literal
      const typeMembers: string[] = [...methodSignatures, ...properties];
      const typeString = `{ ${typeMembers.join('; ')} }`;
      const docComment = `${namespacePath} namespace operations`;

      file.addTypeAlias({
        name: interfaceName,
        type: typeString,
        isExported: true,
        docs: [{ description: docComment }],
      });
    }
  }

  private buildMethodSignatureString(file: SourceFile, path: string, method: string, operation: any, operationId: string): string {
    const methodName = this.naming.toMethodName(operationId);
    const parameters = operation.parameters || [];
    const requestBody = operation.requestBody;

    const methodParams: any[] = [];
    const allParams: any[] = [];

    // Collect all parameters
    for (const param of parameters) {
      // Resolve $ref if present
      let resolvedParam = param;
      if (param.$ref) {
        resolvedParam = this.resolveParameterReference(param.$ref);
        if (!resolvedParam) {
          continue; // Skip if reference cannot be resolved
        }
      }

      // Skip parameters with empty or undefined names
      if (!resolvedParam.name || resolvedParam.name.trim() === '') {
        continue;
      }

      const paramName = this.naming.toPropertyName(resolvedParam.name);
      const paramSchema = this.getParameterSchema(resolvedParam);
      const paramType = this.getTypeString(paramSchema);

      const paramInfo = {
        name: paramName,
        type: paramType,
        required: resolvedParam.required,
        description: resolvedParam.description,
        in: resolvedParam.in,
      };

      allParams.push(paramInfo);
    }

    // Create parameter type interface if there are any parameters
    const hasParams = allParams.length > 0;
    let paramsTypeName = '';

    if (hasParams) {
      paramsTypeName = `${this.naming.toTypeName(methodName)}Params`;
      this.generateParameterInterface(file, paramsTypeName, allParams);

      // The params parameter should be required if ANY parameter is required
      const hasRequiredParams = allParams.some(p => p.required);
      methodParams.push({
        name: 'params',
        type: paramsTypeName,
        hasQuestionToken: !hasRequiredParams,
      });
    }

    // Add request body as separate parameter
    if (requestBody) {
      const contentType = Object.keys(requestBody.content || {})[0];
      const schema = requestBody.content?.[contentType]?.schema;
      const dataTypeName = this.generateRequestBodyType(file, schema, methodName);
      methodParams.push({
        name: 'data',
        type: dataTypeName,
        hasQuestionToken: !requestBody.required,
      });
    }

    methodParams.push({
      name: 'config',
      type: 'AxiosRequestConfig',
      hasQuestionToken: true,
    });

    const responseType = this.getResponseType(operation.responses, file, methodName);

    // Build method signature string
    const paramStrings = methodParams.map(p => `${p.name}${p.hasQuestionToken ? '?' : ''}: ${p.type}`);
    return `${methodName}(${paramStrings.join(', ')}): Promise<AxiosResponse<${responseType}>>`;
  }

  private addMethodSignatureToInterface(interfaceDeclaration: any, path: string, method: string, operation: any, operationId: string): void {
    const file = interfaceDeclaration.getSourceFile();
    const methodSignature = this.buildMethodSignatureString(file, path, method, operation, operationId);
    const methodName = this.naming.toMethodName(operationId);
    
    // Parse the method signature to extract parameters and return type
    const match = methodSignature.match(/^(\w+)\((.*?)\):\s*(.+)$/);
    if (!match) {
      // Fallback: add method using the old approach
      const parameters = operation.parameters || [];
      const requestBody = operation.requestBody;
      const methodParams: any[] = [];
      const allParams: any[] = [];

      for (const param of parameters) {
        let resolvedParam = param;
        if (param.$ref) {
          resolvedParam = this.resolveParameterReference(param.$ref);
          if (!resolvedParam) continue;
        }
        if (!resolvedParam.name || resolvedParam.name.trim() === '') continue;

        const paramName = this.naming.toPropertyName(resolvedParam.name);
        const paramSchema = this.getParameterSchema(resolvedParam);
        const paramType = this.getTypeString(paramSchema);
        allParams.push({
          name: paramName,
          type: paramType,
          required: resolvedParam.required,
        });
      }

      const hasParams = allParams.length > 0;
      if (hasParams) {
        const paramsTypeName = `${this.naming.toTypeName(methodName)}Params`;
        this.generateParameterInterface(file, paramsTypeName, allParams);
        const hasRequiredParams = allParams.some(p => p.required);
        methodParams.push({
          name: 'params',
          type: paramsTypeName,
          hasQuestionToken: !hasRequiredParams,
        });
      }

      if (requestBody) {
        const contentType = Object.keys(requestBody.content || {})[0];
        const schema = requestBody.content?.[contentType]?.schema;
        const dataTypeName = this.generateRequestBodyType(file, schema, methodName);
        methodParams.push({
          name: 'data',
          type: dataTypeName,
          hasQuestionToken: !requestBody.required,
        });
      }

      methodParams.push({
        name: 'config',
        type: 'AxiosRequestConfig',
        hasQuestionToken: true,
      });

      const responseType = this.getResponseType(operation.responses, file, methodName);
      interfaceDeclaration.addMethod({
        name: methodName,
        parameters: methodParams,
        returnType: `Promise<AxiosResponse<${responseType}>>`,
        docs: operation.summary ? [{ description: operation.summary }] : undefined,
      });
      return;
    }

    // This method is deprecated - we should use buildMethodSignatureString instead
    // But keeping it for backward compatibility with existing code
    const [, , paramString, returnType] = match;
    const params = paramString ? paramString.split(',').map(p => {
      const [name, type] = p.split(':').map(s => s.trim());
      return {
        name: name.replace('?', ''),
        type: type,
        hasQuestionToken: name.includes('?'),
      };
    }) : [];

    interfaceDeclaration.addMethod({
      name: methodName,
      parameters: params,
      returnType: returnType,
      docs: operation.summary ? [{ description: operation.summary }] : undefined,
    });
  }

  private buildNamespaceInitialization(namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>, separator: string = '/'): string {
    // Build a tree structure for the namespace
    const tree = this.buildNamespaceTree(namespaceParts, operations, separator);
    const content = this.generateNamespaceObjectFromTree(tree);
    return `{\n${content}\n    }`;
  }

  private buildNamespaceTree(namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string; metadata?: any }>, separator: string = '/'): any {
    const tree: any = {};
    
    // Process all operations that start with our root namespace
    const rootNamespace = namespaceParts[0];
    
    for (const operation of operations) {
      // OPTIMIZATION: Use pre-computed parts from metadata if available
      const opParts = (operation as any).metadata?.parts || operation.operationId.split(separator);
      
      // Only process operations that start with our root namespace
      // OPTIMIZATION: Use pre-computed root namespace from metadata if available
      const opRootNamespace = (operation as any).metadata?.rootNamespace;
      if (opRootNamespace) {
        if (opRootNamespace !== rootNamespace) continue;
      } else if (!operation.operationId.startsWith(rootNamespace + separator)) {
        continue;
      }
      
      // Navigate/create the tree structure starting from the root
      let current = tree;
      const pathFromRoot = opParts.slice(1); // Remove the root namespace part (already handled)
      
      // Navigate/create intermediate levels
      for (let i = 0; i < pathFromRoot.length - 1; i++) {
        const part = pathFromRoot[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Add the method at the final level
      const methodName = this.naming.toMethodName(operation.operationId);
      const fullNamespacePath = opParts.slice(0, -1); // All parts except method name
      const privateMethodName = this.getPrivateMethodName(fullNamespacePath, methodName);
      
      if (!current._methods) {
        current._methods = [];
      }
      current._methods.push({
        name: methodName,
        privateMethod: privateMethodName
      });
    }
    
    return tree;
  }

  private generateNamespaceObjectFromTree(tree: any, indent: string = '    '): string {
    const parts: string[] = [];
    
    // Add methods at this level
    if (tree._methods) {
      for (const method of tree._methods) {
        parts.push(`${indent}  ${method.name}: this.${method.privateMethod}.bind(this)`);
      }
    }
    
    // Add sub-namespaces
    for (const [key, value] of Object.entries(tree)) {
      if (key === '_methods') continue;
      
      const subNamespace = this.generateNamespaceObjectFromTree(value, indent + '  ');
      parts.push(`${indent}  ${key}: {\n${subNamespace}\n${indent}  }`);
    }
    
    if (parts.length === 0) {
      return '';
    }
    
    return parts.join(',\n');
  }

  private getPrivateMethodName(namespaceParts: string[], methodName: string): string {
    return `${namespaceParts.join('_')}_${methodName}`;
  }

  private generateMethod(classDeclaration: any, path: string, method: string, operation: any, customMethodName?: string, forcePublic: boolean = false, metadata?: any): void {
    // OPTIMIZATION: Use pre-computed metadata if available, otherwise compute on demand
    const baseMethodName = metadata?.baseMethodName || this.naming.toMethodName(operation.operationId || `${method}_${path}`);
    const methodName = customMethodName || baseMethodName;
    
    // OPTIMIZATION: Use pre-resolved parameters if available
    const resolvedParameters = metadata?.resolvedParameters || (() => {
      const parameters = operation.parameters || [];
      const resolved: any[] = [];
      for (const param of parameters) {
        let resolvedParam = param;
        if (param.$ref) {
          resolvedParam = this.resolveParameterReference(param.$ref);
          if (!resolvedParam) continue;
        }
        resolved.push(resolvedParam);
      }
      return resolved;
    })();
    
    // OPTIMIZATION: Use pre-computed body params if available
    const bodyParams = metadata?.bodyParams || resolvedParameters.filter((param: any) => param.in === 'body');
    const requestBody = operation.requestBody;
    const requestBodySchema = metadata?.requestBodySchema || (requestBody ? (() => {
      const contentType = Object.keys(requestBody.content || {})[0];
      return requestBody.content?.[contentType]?.schema;
    })() : null);

    const methodParams: any[] = [];
    const pathParams: string[] = [];
    const queryParams: string[] = [];
    const headerParams: string[] = [];
    const allParams: any[] = [];

    // OPTIMIZATION: Use pre-resolved parameters, eliminating redundant $ref resolution
    for (const resolvedParam of resolvedParameters) {
      // Skip parameters with empty or undefined names
      if (!resolvedParam.name || resolvedParam.name.trim() === '') {
        continue;
      }

      const paramName = this.naming.toPropertyName(resolvedParam.name);
      const paramSchema = this.getParameterSchema(resolvedParam);
      const paramType = this.getTypeString(paramSchema);
      const paramIn = resolvedParam.in;

      // Only add non-body parameters to allParams
      if (paramIn !== 'body') {
        allParams.push({
          name: paramName,
          type: paramType,
          required: resolvedParam.required,
          description: resolvedParam.description,
          in: paramIn,
        });
      }

      // Categorize parameters efficiently
      if (paramIn === 'path') {
        pathParams.push(paramName);
      } else if (paramIn === 'query') {
        queryParams.push(paramName);
      } else if (paramIn === 'header') {
        headerParams.push(paramName);
      }
    }

    // Create parameter type interface if there are any parameters (excluding request body)
    const hasParams = allParams.length > 0;
    let paramsTypeName = '';

    // OPTIMIZATION: Use pre-computed bodyParams instead of re-filtering
    const hasRequestBody = requestBody || bodyParams.length > 0;
    const bodyRequired = requestBody ? requestBody.required : (bodyParams.length > 0 ? bodyParams[0].required : false);

    // Determine if data will be required
    const dataRequired = (requestBody && requestBody.required) || (bodyParams.length > 0 && bodyParams[0].required);

    if (hasParams) {
      paramsTypeName = `${this.naming.toTypeName(baseMethodName)}Params`;
      this.generateParameterInterface(classDeclaration.getSourceFile(), paramsTypeName, allParams);

      // The params parameter should be required if ANY parameter is required OR if data is required
      // (to maintain valid TypeScript parameter ordering)
      const hasRequiredParams = allParams.some(p => p.required);
      const paramsRequired = hasRequiredParams || dataRequired;
      
      methodParams.push({
        name: 'params',
        type: paramsTypeName,
        hasQuestionToken: !paramsRequired,
      });
    }

    // Add request body as separate parameter (OpenAPI v3)
    // OPTIMIZATION: Use pre-computed requestBodySchema if available
    if (requestBody) {
      const schema = requestBodySchema || (() => {
        const contentType = Object.keys(requestBody.content || {})[0];
        return requestBody.content?.[contentType]?.schema;
      })();
      const dataTypeName = this.generateRequestBodyType(classDeclaration.getSourceFile(), schema, baseMethodName);
      methodParams.push({
        name: 'data',
        type: dataTypeName,
        hasQuestionToken: !requestBody.required,
      });
    }

    // Add OpenAPI v2 body parameters as separate parameter
    // OPTIMIZATION: bodyParams already resolved, no need to re-filter
    if (bodyParams.length > 0) {
      // For OpenAPI v2, we expect only one body parameter
      const bodyParam = bodyParams[0];
      const bodySchema = this.getParameterSchema(bodyParam);
      const dataTypeName = this.generateRequestBodyType(classDeclaration.getSourceFile(), bodySchema, baseMethodName);
      methodParams.push({
        name: 'data',
        type: dataTypeName,
        hasQuestionToken: !bodyParam.required,
      });
    }

    methodParams.push({
      name: 'config',
      type: 'AxiosRequestConfig',
      hasQuestionToken: true,
    });

    const responseType = this.getResponseType(operation.responses, classDeclaration.getSourceFile(), baseMethodName);

    const methodDeclaration = classDeclaration.addMethod({
      name: methodName,
      isAsync: true,
      parameters: methodParams,
      returnType: `Promise<AxiosResponse<${responseType}>>`,
      scope: forcePublic || !customMethodName ? 'public' as any : 'private' as any,
    });

    // Generate JSDoc for the method (simplified for performance)
    const operationId = operation.operationId || `${method}_${path}`;
    
    // Only generate JSDoc if there's meaningful content
    if (operation.summary || operation.description) {
      const jsdocParts: string[] = [];
      
      // Main description
      if (operation.summary) {
        jsdocParts.push(operation.summary);
      }
      if (operation.description && operation.description !== operation.summary) {
        if (jsdocParts.length > 0) jsdocParts.push('');
        jsdocParts.push(operation.description);
      }

      // Add operationId for reference
      if (jsdocParts.length > 0) jsdocParts.push('');
      jsdocParts.push(`@operationId ${operationId}`);

      // Response documentation (most useful)
      const result = operation.responses ? this.findBestResponseSchema(operation.responses) : null;
      if (result?.description) {
        if (jsdocParts.length > 0) jsdocParts.push('');
        jsdocParts.push(`@returns ${result.description}`);
      }

      methodDeclaration.addJsDoc({
        description: jsdocParts.join('\n'),
      });
    }

    // OPTIMIZATION: Use Set for O(1) lookup instead of Array.includes() O(n)
    const pathParamsSet = new Set(pathParams);
    const pathParamRegex = /\{([^}]+)\}/g;
    const urlTemplate = pathParams.length > 0
      ? path.replace(pathParamRegex, (match, paramName) => {
          const normalizedParamName = this.naming.toPropertyName(paramName);
          if (pathParamsSet.has(normalizedParamName)) {
            // Use bracket notation for quoted property names, dot notation otherwise
            const accessor = normalizedParamName.startsWith("'") || normalizedParamName.startsWith('"')
              ? `params[${normalizedParamName}]`
              : `params.${normalizedParamName}`;
            return `\${${accessor}}`;
          }
          return match;
        })
      : path;

    const statements: string[] = [];

    // Extract parameters from params object if it exists
    if (hasParams) {
      // OPTIMIZATION: Cache the required check result
      const hasRequiredParams = allParams.some(p => p.required);
      const paramsIsOptional = !hasRequiredParams;

      // OPTIMIZATION: Create lookup map for faster param finding, reusing normalized names
      const paramMap = new Map<string, typeof allParams[0]>();
      for (const param of allParams) {
        // We already normalized param.name in the loop above, but need to normalize again for consistency
        // However, since toPropertyName is cached, this is still fast
        const normalizedName = this.naming.toPropertyName(param.name);
        paramMap.set(normalizedName, param);
      }

      if (queryParams.length > 0) {
        // OPTIMIZATION: Pre-compute accessors to avoid repeated conditionals
        const queryParamsList = queryParams.map(p => {
          const param = paramMap.get(p);
          const isRequired = param?.required;
          // OPTIMIZATION: Compute accessor once instead of in template string
          const accessor = (paramsIsOptional || !isRequired) ? `params?.${p}` : `params.${p}`;
          return `${p}: ${accessor}`;
        }).join(', ');
        statements.push(`const queryParams = { ${queryParamsList} };`);
      }

      if (headerParams.length > 0) {
        // OPTIMIZATION: Pre-compute accessors to avoid repeated conditionals
        const headerParamsList = headerParams.map(p => {
          const param = paramMap.get(p);
          const isRequired = param?.required;
          // OPTIMIZATION: Compute accessor once instead of in template string
          const accessor = (paramsIsOptional || !isRequired) ? `params?.${p}` : `params.${p}`;
          return `${p}: ${accessor}`;
        }).join(', ');
        statements.push(`const headers = { ${headerParamsList} };`);
      }
    }

    let axiosCall = `this.client.${method}(\`${urlTemplate}\``;

    if (method === 'get' || method === 'delete' || method === 'head' || method === 'options') {
      // For DELETE, handle request body if present (unusual but valid)
      const hasRequestBody = (method === 'delete') && (requestBody || bodyParams.length > 0);
      if (queryParams.length > 0 || headerParams.length > 0 || hasRequestBody) {
        const configParts: string[] = [];
        if (queryParams.length > 0) configParts.push('params: queryParams');
        if (headerParams.length > 0) configParts.push('headers');
        if (hasRequestBody) configParts.push('data: data');
        configParts.push('...config');
        axiosCall += `, { ${configParts.join(', ')} }`;
      } else if (methodParams.some(p => p.name === 'config')) {
        axiosCall += ', config';
      } else if (hasRequestBody) {
        axiosCall += ', { data: data, ...config }';
      }
    } else {
      if (requestBody || bodyParams.length > 0) {
        axiosCall += ', data';
      } else {
        axiosCall += ', undefined';
      }

      if (queryParams.length > 0 || headerParams.length > 0) {
        const configParts: string[] = [];
        if (queryParams.length > 0) configParts.push('params: queryParams');
        if (headerParams.length > 0) configParts.push('headers');
        configParts.push('...config');
        axiosCall += `, { ${configParts.join(', ')} }`;
      } else if (methodParams.some(p => p.name === 'config')) {
        axiosCall += ', config';
      }
    }

    axiosCall += ')';

    statements.push(`return ${axiosCall};`);

    methodDeclaration.addStatements(statements);
  }

  private generateParameterInterface(file: SourceFile, typeName: string, allParams: any[]): void {
    // Check if type already exists to avoid duplicates
    const existingType = file.getTypeAlias(typeName);
    if (existingType) {
      return;
    }

    // Build object type literal with JSDoc comments on properties
    const propStrings: string[] = [];
    for (const param of allParams) {
      // Skip parameters with empty or undefined names
      if (!param.name || param.name.trim() === '') {
        continue;
      }

      const propName = this.naming.toPropertyName(param.name);
      const optional = !param.required;
      
      // Build JSDoc comment for this parameter
      let docComment = param.description || '';
      if (param.in === 'path') {
        docComment = docComment ? `${docComment} (path parameter)` : 'Path parameter';
      } else if (param.in === 'query') {
        docComment = docComment ? `${docComment} (query parameter)` : 'Query parameter';
      } else if (param.in === 'header') {
        docComment = docComment ? `${docComment} (header parameter)` : 'Header parameter';
      }
      
      if (docComment) {
        // Format with JSDoc comment above the property (no indentation - ts-morph will add it)
        propStrings.push(`/** ${this.jsdoc.escapeBackticks(docComment)} */`);
      }
      
      // Add property with proper formatting (no indentation - ts-morph will add it)
      propStrings.push(`${propName}${optional ? '?' : ''}: ${param.type};`);
    }

    // Build type string with proper 2-space indentation
    // Format properties with 2 spaces indentation
    const formattedProps = propStrings.map(prop => `  ${prop}`);
    const typeString = `{\n${formattedProps.join('\n')}\n}`;

    // Add type alias - ts-morph will add base indentation
    const typeAlias = file.addTypeAlias({
      name: typeName,
      type: typeString,
      isExported: true,
    });
    
    // Fix indentation: ts-morph adds 4 spaces, we want 2 spaces total
    const currentType = typeAlias.getTypeNode();
    if (currentType) {
      const currentText = currentType.getText();
      // Replace 6 spaces with 2 spaces, 4 spaces with 0 spaces (for closing brace)
      const fixedText = currentText
        .replace(/^      /gm, '  ')  // 6 spaces -> 2 spaces
        .replace(/^    }/gm, '}');   // 4 spaces before closing brace -> 0 spaces
      currentType.replaceWithText(fixedText);
    }
  }

  /**
   * Generates a named type for request body schema with comments.
   * If schema is a reference, returns the referenced type name.
   * If schema is inline, generates a new type interface with comments.
   */
  private generateRequestBodyType(file: SourceFile, schema: any, baseMethodName: string): string {
    if (!schema) {
      return 'unknown';
    }

    // If schema is a reference, use the referenced type name (which already has comments)
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return this.naming.toTypeName(refName);
    }

    // For inline schemas, generate a named type with comments
    const typeName = `${this.naming.toTypeName(baseMethodName)}Data`;
    
    // Check if type already exists to avoid duplicates
    const existingType = file.getTypeAlias(typeName);
    if (existingType) {
      return typeName;
    }

    // Generate the type with comments
    this.generateTypeFromSchema(file, typeName, schema);
    
    return typeName;
  }

  /**
   * Generates a named type for response schema with comments.
   * If schema is a reference, returns the referenced type name.
   * If schema is inline, generates a new type interface with comments.
   */
  private generateResponseType(file: SourceFile, schema: any, baseMethodName: string, responseDescription?: string): string {
    if (!schema) {
      return 'unknown';
    }

    // If schema is a reference, use the referenced type name (which already has comments)
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return this.naming.toTypeName(refName);
    }

    // For inline schemas, generate a named type with comments
    const typeName = `${this.naming.toTypeName(baseMethodName)}Response`;
    
    // Check if type already exists to avoid duplicates
    const existingType = file.getTypeAlias(typeName);
    if (existingType) {
      return typeName;
    }

    // Add response description to schema if available
    const schemaWithDescription = responseDescription 
      ? { ...schema, description: responseDescription }
      : schema;

    // Generate the type with comments
    this.generateTypeFromSchema(file, typeName, schemaWithDescription);
    
    return typeName;
  }

  public getResponseType(responses: any, file?: SourceFile, baseMethodName?: string): string {
    // Optimization #3: Create efficient cache key instead of JSON.stringify
    // Include method name in cache key when generating types to avoid conflicts
    const baseCacheKey = this.getResponseTypeCacheKey(responses);
    const cacheKey = file && baseMethodName ? `${baseCacheKey}:${baseMethodName}` : baseCacheKey;
    
    if (this.responseTypeCache.has(cacheKey)) {
      return this.responseTypeCache.get(cacheKey)!;
    }

    // Find the best response schema (handles all success codes, ranges, and default)
    const result = this.findBestResponseSchema(responses);
    if (!result || !result.schema) {
      this.responseTypeCache.set(cacheKey, 'unknown');
      return 'unknown';
    }

    const { schema, description: responseDescription } = result;

    // If we have a file and method name, and the schema is inline (not a reference),
    // generate a named type with JSDoc
    let typeResult: string;
    if (file && baseMethodName && schema && !schema.$ref) {
      typeResult = this.generateResponseType(file, schema, baseMethodName, responseDescription);
    } else {
      // Fall back to inline type string for references or when file/method name not available
      typeResult = this.getTypeString(schema);
    }

    this.responseTypeCache.set(cacheKey, typeResult);
    return typeResult;
  }

  /**
   * Finds the best response schema from OpenAPI responses.
   * Checks for specific success codes, range responses (2XX), and default responses.
   * Returns the response object and extracted schema.
   */
  private findBestResponseSchema(responses: any): { response: any; schema: any; description?: string } | null {
    if (!responses) return null;

    // Priority order:
    // 1. Specific success codes (200, 201, 202, 204, etc.)
    // 2. Range responses (2XX for any 2xx status)
    // 3. Default response

    // Check specific success codes (2xx range)
    const successCodes = ['200', '201', '202', '204', '206'];
    for (const code of successCodes) {
      const response = responses[code];
      if (response) {
        const schema = this.extractSchemaFromResponse(response);
        if (schema !== null) {
          return { response, schema, description: response.description };
        }
      }
    }

    // Check for range responses (2XX, 3XX, etc.)
    for (const key in responses) {
      if (key.match(/^[23]XX$/)) {
        const response = responses[key];
        if (response) {
          const schema = this.extractSchemaFromResponse(response);
          if (schema !== null) {
            return { response, schema, description: response.description };
          }
        }
      }
    }

    // Check default response
    if (responses.default) {
      const response = responses.default;
      const schema = this.extractSchemaFromResponse(response);
      if (schema !== null) {
        return { response, schema, description: response.description };
      }
    }

    // Fallback: check any response with a schema
    for (const key in responses) {
      const response = responses[key];
      if (response) {
        const schema = this.extractSchemaFromResponse(response);
        if (schema !== null) {
          return { response, schema, description: response.description };
        }
      }
    }

    return null;
  }

  /**
   * Extracts schema from a response object (handles both OpenAPI v3 and v2 formats).
   */
  private extractSchemaFromResponse(response: any): any {
    if (!response) return null;

    // OpenAPI v3 format: responses have content property
    if (response.content) {
      // Try to find the first content type with a schema
      for (const contentType in response.content) {
        const content = response.content[contentType];
        if (content?.schema) {
          return content.schema;
        }
      }
      return null;
    }

    // OpenAPI v2 (Swagger 2.0) format: responses have schema property directly
    if (response.schema) {
      return response.schema;
    }

    return null;
  }

  /**
   * Creates an efficient cache key for response types (optimization #3)
   * Instead of JSON.stringify, we only serialize the relevant parts.
   */
  private getResponseTypeCacheKey(responses: any): string {
    if (!responses) return 'no-responses';

    const result = this.findBestResponseSchema(responses);
    if (!result) return 'no-success';

    const { schema } = result;

    // Check if response has content (OpenAPI v3) or schema (v2)
    const response = result.response;
    if (response.content) {
      const contentType = Object.keys(response.content)[0];
      if (schema?.$ref) {
        return `content:${contentType}:ref:${schema.$ref}`;
      }
      // For inline schemas, use a minimal cache key
      return `content:${contentType}:${this.getSchemaCacheKey(schema) || 'inline'}`;
    }

    // OpenAPI v2 format
    if (schema?.$ref) {
      return `schema:ref:${schema.$ref}`;
    }
    return `schema:${this.getSchemaCacheKey(schema) || 'inline'}`;
  }

  private async generateIndex(): Promise<void> {
    const file = this.project.createSourceFile(
      path.join(this.options.outputDir, 'index.ts'),
      undefined,
      { overwrite: true }
    );

    file.addImportDeclaration({
      moduleSpecifier: 'axios',
      namedImports: ['AxiosRequestConfig'],
      isTypeOnly: true,
    });

    file.addExportDeclaration({
      moduleSpecifier: './types.js',
    });

    file.addExportDeclaration({
      moduleSpecifier: './client.js',
      namedExports: [`${this.namespace}Client`],
    });

    file.addImportDeclaration({
      moduleSpecifier: './client.js',
      namedImports: [`${this.namespace}Client`],
    });

    file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'createClient',
          initializer: `(baseURL: string, config?: AxiosRequestConfig) => new ${this.namespace}Client(baseURL, config)`,
        },
      ],
      isExported: true,
    });
  }


  private getParameterSchema(param: any): any {
    // OpenAPI v3 has schema property, v2 has type directly on parameter
    if (param.schema) {
      return param.schema;
    }

    // Create a cache key for OpenAPI v2 parameters
    if (param.type) {
      const cacheKey = JSON.stringify({
        type: param.type,
        format: param.format,
        enum: param.enum,
        items: param.items,
        // Don't include description as it doesn't affect type
      });
      
      if (this.parameterSchemaCache.has(cacheKey)) {
        return this.parameterSchemaCache.get(cacheKey);
      }

      const schema: any = {
        type: param.type
      };

      // Copy relevant properties from OpenAPI v2 parameter to schema
      if (param.format) schema.format = param.format;
      if (param.enum) schema.enum = param.enum;
      if (param.minimum !== undefined) schema.minimum = param.minimum;
      if (param.maximum !== undefined) schema.maximum = param.maximum;
      if (param.minLength !== undefined) schema.minLength = param.minLength;
      if (param.maxLength !== undefined) schema.maxLength = param.maxLength;
      if (param.pattern) schema.pattern = param.pattern;
      if (param.minItems !== undefined) schema.minItems = param.minItems;
      if (param.maxItems !== undefined) schema.maxItems = param.maxItems;
      if (param.uniqueItems !== undefined) schema.uniqueItems = param.uniqueItems;
      if (param.default !== undefined) schema.default = param.default;
      if (param.example !== undefined) schema.example = param.example;
      if (param.description) schema.description = param.description;

      // Handle array items for OpenAPI v2
      if (param.type === 'array' && param.items) {
        schema.items = param.items;
      }

      this.parameterSchemaCache.set(cacheKey, schema);
      return schema;
    }

    // Fallback for parameters without type information
    return { type: 'string' };
  }

  /**
   * Sanitizes text for JSDoc comments to prevent TypeScript parsing errors.
   * Removes backticks, escapes comment delimiters, and handles special characters.
   */

  // Configuration file handling methods
  public static async loadConfig(configPath: string = '.ott.json'): Promise<OTTConfig | null> {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent) as OTTConfig;
      
      // Resolve environment variables in headers for each API
      if (config.apis) {
        for (const api of config.apis) {
          if (api.headers) {
            api.headers = resolveHeadersEnvironmentVariables(api.headers);
          }
        }
      }
      
      return config;
    } catch (error) {
      return null;
    }
  }

  public static async saveConfig(config: OTTConfig, configPath: string = '.ott.json'): Promise<void> {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  public static async generateConfigFromSpec(
    spec: string, 
    outputDir: string = './generated',
    configPath: string = '.ott.json',
    headers?: Record<string, string>
  ): Promise<OTTConfig> {
    // Resolve environment variables in headers
    const resolvedHeaders = headers ? resolveHeadersEnvironmentVariables(headers) : undefined;
    
    // Parse the OpenAPI spec to extract operationIds
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    let specInput: string | object = spec;

    // If spec is a URL, fetch it
    if (spec.startsWith('http://') || spec.startsWith('https://')) {
      const generator = new OpenAPIGenerator({ spec, outputDir: '' });
      specInput = await generator.fetchFromUrl(spec, resolvedHeaders);
    }

    const api = await SwaggerParser.parse(specInput as any) as any;
    
    // Extract all operationIds
    const operationIds: string[] = [];
    if (api.paths) {
      for (const [, pathItem] of Object.entries(api.paths)) {
        const item = pathItem as any;
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          if (item[method] && item[method].operationId) {
            operationIds.push(item[method].operationId);
          }
        }
      }
    }

    // Create default config
    const config: OTTConfig = {
      apis: [
        {
          name: api.info?.title || 'API',
          spec,
          output: outputDir,
          namespace: api.info?.title || 'API',
          axiosInstance: 'apiClient',
          typeOutput: 'single-file',
          headers: Object.keys(resolvedHeaders || {}).length > 0 ? resolvedHeaders : undefined,
          operationIds: operationIds.sort()
        }
      ]
    };

    // Save the config file
    await this.saveConfig(config, configPath);
    
    return config;
  }

  public static async loadOrGenerateConfig(
    spec: string,
    outputDir: string = './generated',
    configPath: string = '.ott.json'
  ): Promise<OTTConfig> {
    // Try to load existing config
    let config = await this.loadConfig(configPath);
    
    if (!config) {
      // Generate new config if none exists
      config = await this.generateConfigFromSpec(spec, outputDir, configPath);
    }
    
    return config;
  }

  // Filter operations based on operationIds in config
  private filterOperationsByConfig(): void {
    if (!this.api || !this.api.paths || !this.operationIds || this.operationIds.length === 0) {
      return;
    }

    // Convert to Set for O(1) lookups
    const operationIdsSet = new Set(this.operationIds);
    const filteredPaths: any = {};
    
    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      const filteredItem: any = {};
      let hasOperations = false;

      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        if (item[method]) {
          const operation = item[method];
          const operationId = operation.operationId || `${method}_${path}`;
          
          if (operationIdsSet.has(operationId)) {
            filteredItem[method] = operation;
            hasOperations = true;
          }
        }
      }

      if (hasOperations) {
        filteredPaths[path] = filteredItem;
      }
    }

    this.api.paths = filteredPaths;
  }

  /**
   * Extracts type names that are actually used in a generated source file
   * by analyzing the generated code (excluding import statements)
   */
  private extractUsedTypesFromFile(file: SourceFile): Set<string> {
    const usedTypes = new Set<string>();
    const fileText = file.getFullText();
    
    // Get import statement ranges to exclude them from analysis
    const importDeclarations = file.getImportDeclarations();
    const importRanges: Array<{ start: number; end: number }> = [];
    
    for (const importDecl of importDeclarations) {
      const start = importDecl.getStart();
      const end = importDecl.getEnd();
      importRanges.push({ start, end });
    }
    
    // Extract type names from the file text, excluding import statements
    // Match TypeScript type names (valid identifiers starting with uppercase)
    const typeNamePattern = /\b([A-Z_][a-zA-Z0-9_]*)\b/g;
    const primitiveAndBuiltins = new Set([
      'string', 'number', 'boolean', 'void', 'null', 'unknown', 'any',
      'Array', 'Record', 'Promise', 'AxiosResponse', 'AxiosInstance', 'AxiosRequestConfig',
      'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
      'Set', 'Map', 'Date', 'Error', 'Object', 'Function'
    ]);
    
    let match;
    while ((match = typeNamePattern.exec(fileText)) !== null) {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;
      const typeName = match[1];
      
      // Skip if it's in an import statement
      const isInImport = importRanges.some(range => 
        matchStart >= range.start && matchEnd <= range.end
      );
      
      if (isInImport) {
        continue;
      }
      
      // Skip primitives and built-ins
      if (primitiveAndBuiltins.has(typeName)) {
        continue;
      }
      
      usedTypes.add(typeName);
    }
    
    return usedTypes;
  }

  /**
   * Extracts type names that are actually used in class methods
   * by analyzing only the method implementations (not type aliases)
   */
  private extractUsedTypesFromClassMethods(classDeclaration: any): Set<string> {
    const usedTypes = new Set<string>();
    
    // Get all methods from the class
    const methods = classDeclaration.getMethods();
    
    for (const method of methods) {
      const methodText = method.getText();
      
      // Extract type names from method signatures and implementations
      const typeNamePattern = /\b([A-Z_][a-zA-Z0-9_]*)\b/g;
      const primitiveAndBuiltins = new Set([
        'string', 'number', 'boolean', 'void', 'null', 'unknown', 'any',
        'Array', 'Record', 'Promise', 'AxiosResponse', 'AxiosInstance', 'AxiosRequestConfig',
        'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
        'Set', 'Map', 'Date', 'Error', 'Object', 'Function'
      ]);
      
      let match;
      while ((match = typeNamePattern.exec(methodText)) !== null) {
        const typeName = match[1];
        
        // Skip primitives and built-ins
        if (primitiveAndBuiltins.has(typeName)) {
          continue;
        }
        
        usedTypes.add(typeName);
      }
    }
    
    return usedTypes;
  }
}