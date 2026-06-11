import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TypeOutputMode, OpenAPIDocument } from '../types.js';
import { NamingUtils } from '../utils/naming.js';
import { JSDocUtils } from '../utils/jsdoc.js';
import { ProgressIndicator } from '../utils/progress.js';

export interface TypeGeneratorContext {
  project: Project;
  api: OpenAPIDocument | null;
  typeOutputMode: TypeOutputMode;
  outputDir: string;
  operationIds?: string[];
  naming: NamingUtils;
  jsdoc: JSDocUtils;
  progress: ProgressIndicator;
  getTypeString: (schema: any) => string;
  getTypeStringWithNestedJSDoc: (schema: any, visited?: Set<any>) => string;
  generateInlineObjectTypeWithJSDoc: (schema: any, visited?: Set<any>) => string;
  collectUsedTypes: () => string[];
  extractUsedTypesFromFile: (file: SourceFile) => Set<string>;
  getBaseTypeString: (schema: any) => string;
  getPrimitiveType: (type: string, schema: any) => string;
  generateDiscriminatedUnion: (schema: any, types: string[]) => string;
  handleConst: (schema: any) => string;
}

export class TypeGenerator {
  constructor(private ctx: TypeGeneratorContext) {}

  async generateTypes(): Promise<void> {
    if (!this.ctx.api) return;

    // Support both OpenAPI 3.x (components.schemas) and OpenAPI 2.0 (definitions)
    const allSchemas = (this.ctx.api.components as any)?.schemas || (this.ctx.api as any)?.definitions || {};

    // Filter schemas to only include those used by the specified operations
    const usedTypeNames = this.ctx.collectUsedTypes();
    const filteredSchemas: Record<string, any> = {};

    // If no operationIds are specified, generate all types
    if (!this.ctx.operationIds || this.ctx.operationIds.length === 0) {
      Object.assign(filteredSchemas, allSchemas);
    } else {
      // Convert to Set for O(1) lookups instead of O(n) Array.includes()
      const usedTypeNamesSet = new Set(usedTypeNames);
      
      // Only include schemas that are referenced by the specified operations
      for (const [schemaName, schema] of Object.entries(allSchemas)) {
        const typeName = this.ctx.naming.toTypeName(schemaName);
        if (usedTypeNamesSet.has(typeName)) {
          filteredSchemas[schemaName] = schema;
        }
      }
    }

    switch (this.ctx.typeOutputMode) {
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
    const file = this.ctx.project.createSourceFile(
      path.join(this.ctx.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    const schemaEntries = Object.entries(schemas);
    this.ctx.progress.start(schemaEntries.length, '📝 Generating types');
    
    for (let i = 0; i < schemaEntries.length; i++) {
      const [name, schema] = schemaEntries[i];
      this.generateTypeFromSchema(file, name, schema);
      this.ctx.progress.update(i + 1, this.ctx.naming.toTypeName(name));
    }
    
    this.ctx.progress.complete();
  }

  private async generateTypesInSeparateFiles(schemas: Record<string, any>): Promise<void> {
    const typesDir = path.join(this.ctx.outputDir, 'types');
    await fs.mkdir(typesDir, { recursive: true });

    // Create an index file that re-exports all types
    const indexFile = this.ctx.project.createSourceFile(
      path.join(this.ctx.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    const schemaEntries = Object.entries(schemas);
    this.ctx.progress.start(schemaEntries.length, '📝 Generating type files');

    for (let i = 0; i < schemaEntries.length; i++) {
      const [name, schema] = schemaEntries[i];
      const fileName = this.ctx.naming.toKebabCase(name) + '.ts';
      const file = this.ctx.project.createSourceFile(
        path.join(typesDir, fileName),
        undefined,
        { overwrite: true }
      );

      // Generate the type first
      this.generateTypeFromSchema(file, name, schema);
      
      // Then extract only the types that are actually used in the generated code
      const usedTypes = this.ctx.extractUsedTypesFromFile(file);
      const allSchemas = (this.ctx.api?.components as any)?.schemas || (this.ctx.api as any)?.definitions || {};
      
      // Get the type name being defined in this file (exclude it from imports)
      const currentTypeName = this.ctx.naming.toTypeName(name);
      
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
          schemaName => this.ctx.naming.toTypeName(schemaName) === typeName
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
            schemaName => this.ctx.naming.toTypeName(schemaName) === typeName
          );
          if (schemaName) {
            const fileName = this.ctx.naming.toKebabCase(schemaName);
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
        moduleSpecifier: `./types/${this.ctx.naming.toKebabCase(name)}.js`,
        namedExports: [this.ctx.naming.toTypeName(name)],
      });

      this.ctx.progress.update(i + 1, this.ctx.naming.toTypeName(name));
    }

    this.ctx.progress.complete();
  }

  private async generateTypesGroupedByTag(schemas: Record<string, any>): Promise<void> {
    const typesDir = path.join(this.ctx.outputDir, 'types');
    await fs.mkdir(typesDir, { recursive: true });

    // Group schemas by their tags (if available) or create a default group
    const schemaGroups = this.groupSchemasByTag(schemas);

    // Create an index file that re-exports all types
    const indexFile = this.ctx.project.createSourceFile(
      path.join(this.ctx.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    const groupEntries = Object.entries(schemaGroups);
    const totalTypes = Object.values(schemaGroups).reduce((sum, group) => sum + Object.keys(group).length, 0);
    let processedTypes = 0;
    
    this.ctx.progress.start(totalTypes, '📝 Generating grouped types');

    for (const [groupName, groupSchemas] of groupEntries) {
      const fileName = this.ctx.naming.toKebabCase(groupName) + '.ts';
      const file = this.ctx.project.createSourceFile(
        path.join(typesDir, fileName),
        undefined,
        { overwrite: true }
      );

      // Generate all types in this group first
      for (const [typeName, schema] of Object.entries(groupSchemas)) {
        this.generateTypeFromSchema(file, typeName, schema);
        processedTypes++;
        this.ctx.progress.update(processedTypes, this.ctx.naming.toTypeName(typeName));
      }

      // Then extract only the types that are actually used in the generated code
      const usedTypes = this.ctx.extractUsedTypesFromFile(file);
      const allSchemas = (this.ctx.api?.components as any)?.schemas || (this.ctx.api as any)?.definitions || {};
      
      // Get the type names defined in this group (exclude them from imports)
      const currentGroupTypeNames = new Set(
        Object.keys(groupSchemas).map(schemaName => this.ctx.naming.toTypeName(schemaName))
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
          schemaName => this.ctx.naming.toTypeName(schemaName) === typeName
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
          moduleSpecifier: `./${this.ctx.naming.toKebabCase(depGroup)}.js`,
          namedImports: Array.from(types).sort(),
          isTypeOnly: true,
        });
      }

      // Add re-export to index file
      indexFile.addExportDeclaration({
        moduleSpecifier: `./types/${this.ctx.naming.toKebabCase(groupName)}.js`,
      });
    }
    
    this.ctx.progress.complete();
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

  private generateTypeFromSchema(file: SourceFile, name: string, schema: any): void {
    // Handle composition schemas first
    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const typeString = this.ctx.getTypeString(schema);
      // For types, use description directly from schema
      const docComment = schema.description 
        ? this.ctx.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.ctx.naming.toTypeName(name),
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
      const typeString = this.ctx.getTypeString(schema);
      // For types, use description directly from schema
      const docComment = schema.description 
        ? this.ctx.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.ctx.naming.toTypeName(name),
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
      const typeName = this.ctx.naming.toTypeName(name);
      // For types, use description directly from schema, don't add "property" suffix
      const docComment = schema.description 
        ? this.ctx.jsdoc.escapeBackticks(schema.description)
        : undefined;

      // Build object type literal with JSDoc comments on properties
      const properties = schema.properties || {};
      const required = schema.required || [];
      const requiredSet = new Set(required);

      const propStrings: string[] = [];
      for (const [propName, propSchema] of Object.entries(properties)) {
        const prop = propSchema as any;
        const propType = this.ctx.getTypeStringWithNestedJSDoc(prop);
        const propNameFormatted = this.ctx.naming.toPropertyName(propName);
        const optional = !requiredSet.has(propName);
        
        // Get JSDoc comment for this property
        const propDocComment = this.ctx.jsdoc.generateJSDocComment(prop, propName);
        
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
          .map((s: any) => this.ctx.getTypeString(s));

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
        ? this.ctx.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.ctx.naming.toTypeName(name),
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
        ? this.ctx.jsdoc.escapeBackticks(schema.description)
        : undefined;

      const typeAlias = file.addTypeAlias({
        name: this.ctx.naming.toTypeName(name),
        type: this.ctx.getTypeString(schema),
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
}

