import SwaggerParser from '@apidevtools/swagger-parser';
import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import * as https from 'https';
import * as http from 'http';

export enum TypeOutputMode {
  SingleFile = 'single-file',
  FilePerType = 'file-per-type',
  GroupByTag = 'group-by-tag'
}

export interface APIConfig {
  name: string;
  spec: string;
  output?: string;  // matches --output
  namespace?: string;  // matches --namespace
  axiosInstance?: string;  // matches --axios-instance
  typeOutput?: string;  // matches --type-output
  headers?: Record<string, string>;  // matches --header
  operationIds?: string[];
}

export interface OTTConfig {
  apis: APIConfig[];
}

export interface GeneratorOptions {
  spec: string;
  outputDir: string;
  axiosInstanceName?: string;
  namespace?: string;
  headers?: Record<string, string>;
  typeOutputMode?: TypeOutputMode;
  operationIds?: string[];
}

type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

export class OpenAPIGenerator {
  private project: Project;
  private api: OpenAPIDocument | null = null;
  private namespace: string;
  private typeOutputMode: TypeOutputMode;
  private operationIds: string[] | undefined;

  constructor(private options: GeneratorOptions) {
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
    this.operationIds = options.operationIds;
  }

  async generate(): Promise<void> {
    let specInput: string | object = this.options.spec;

    // If spec is a URL, fetch it
    if (this.options.spec.startsWith('http://') || this.options.spec.startsWith('https://')) {
      specInput = await this.fetchFromUrl(this.options.spec, this.options.headers);
    }

    this.api = await SwaggerParser.parse(specInput as any) as OpenAPIDocument;

    // Filter operations based on configuration
    this.filterOperationsByConfig();

    await fs.mkdir(this.options.outputDir, { recursive: true });

    await this.generateTypes();
    await this.generateClient();
    await this.generateIndex();

    await this.project.save();
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
      // Only include schemas that are referenced by the specified operations
      for (const [schemaName, schema] of Object.entries(allSchemas)) {
        const typeName = this.toTypeName(schemaName);
        if (usedTypeNames.includes(typeName)) {
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

    for (const [name, schema] of Object.entries(schemas)) {
      this.generateTypeFromSchema(file, name, schema);
    }
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

    for (const [name, schema] of Object.entries(schemas)) {
      const fileName = this.toKebabCase(name) + '.ts';
      const file = this.project.createSourceFile(
        path.join(typesDir, fileName),
        undefined,
        { overwrite: true }
      );

      // Check if this type depends on other types
      const dependencies = this.extractDependencies(schema);
      if (dependencies.length > 0) {
        // Add imports for dependencies
        for (const dep of dependencies) {
          file.addImportDeclaration({
            moduleSpecifier: `./${this.toKebabCase(dep)}.js`,
            namedImports: [this.toTypeName(dep)],
            isTypeOnly: true,
          });
        }
      }

      this.generateTypeFromSchema(file, name, schema);

      // Add re-export to index file
      indexFile.addExportDeclaration({
        moduleSpecifier: `./types/${this.toKebabCase(name)}.js`,
        namedExports: [this.toTypeName(name)],
      });
    }
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

    for (const [groupName, groupSchemas] of Object.entries(schemaGroups)) {
      const fileName = this.toKebabCase(groupName) + '.ts';
      const file = this.project.createSourceFile(
        path.join(typesDir, fileName),
        undefined,
        { overwrite: true }
      );

      // Collect all dependencies for this group
      const groupDependencies = new Set<string>();
      for (const [name, schema] of Object.entries(groupSchemas)) {
        const deps = this.extractDependencies(schema);
        deps.forEach(dep => {
          // Only add as dependency if it's not in the same group
          if (!groupSchemas[dep]) {
            groupDependencies.add(dep);
          }
        });
      }

      // Add imports for external dependencies
      if (groupDependencies.size > 0) {
        for (const dep of groupDependencies) {
          const depGroup = this.findSchemaGroup(dep, schemaGroups);
          if (depGroup && depGroup !== groupName) {
            file.addImportDeclaration({
              moduleSpecifier: `./${this.toKebabCase(depGroup)}.js`,
              namedImports: [this.toTypeName(dep)],
              isTypeOnly: true,
            });
          }
        }
      }

      // Generate all types in this group
      for (const [typeName, schema] of Object.entries(groupSchemas)) {
        this.generateTypeFromSchema(file, typeName, schema);
      }

      // Add re-export to index file
      indexFile.addExportDeclaration({
        moduleSpecifier: `./types/${this.toKebabCase(groupName)}.js`,
      });
    }
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

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private generateTypeFromSchema(file: SourceFile, name: string, schema: any): void {
    // Handle composition schemas first
    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const typeString = this.getTypeString(schema);
      const docComment = this.generateJSDocComment(schema, name) || `${name} type`;

      file.addTypeAlias({
        name: this.toTypeName(name),
        type: typeString,
        isExported: true,
        docs: [{ description: docComment }],
      });
      return;
    }

    // Handle discriminated unions
    if (schema.discriminator) {
      const typeString = this.getTypeString(schema);
      const docComment = this.generateJSDocComment(schema, name) || `${name} discriminated union`;

      file.addTypeAlias({
        name: this.toTypeName(name),
        type: typeString,
        isExported: true,
        docs: [{ description: docComment }],
      });
      return;
    }

    if (schema.type === 'object' || schema.properties) {
      const interfaceDeclaration = file.addInterface({
        name: this.toTypeName(name),
        isExported: true,
      });

      const interfaceDocComment = this.generateJSDocComment(schema, name) || `${name} interface`;
      interfaceDeclaration.addJsDoc({
        description: interfaceDocComment,
      });

      // Handle allOf inheritance
      if (schema.allOf) {
        const inheritanceTypes = schema.allOf
          .filter((s: any) => s.$ref)
          .map((s: any) => this.getTypeString(s));

        if (inheritanceTypes.length > 0) {
          (interfaceDeclaration as any).setExtends(inheritanceTypes);
        }
      }

      const properties = schema.properties || {};
      const required = schema.required || [];

      for (const [propName, propSchema] of Object.entries(properties)) {
        const prop = propSchema as any;
        const docComment = this.generateJSDocComment(prop, propName) || `${propName} property`;

        interfaceDeclaration.addProperty({
          name: this.toPropertyName(propName),
          type: this.getTypeString(prop),
          hasQuestionToken: !required.includes(propName),
          docs: [{ description: docComment }],
        });
      }
    } else if (schema.enum) {
      const docComment = this.generateJSDocComment(schema, name) || `${name} enum values`;

      file.addTypeAlias({
        name: this.toTypeName(name),
        type: schema.enum.map((v: any) => JSON.stringify(v)).join(' | '),
        isExported: true,
        docs: [{ description: docComment }],
      });
    } else {
      const docComment = this.generateJSDocComment(schema, name) || `${name} type`;

      file.addTypeAlias({
        name: this.toTypeName(name),
        type: this.getTypeString(schema),
        isExported: true,
        docs: [{ description: docComment }],
      });
    }
  }

  public getTypeString(schema: any): string {
    if (!schema) return 'unknown';

    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return this.toTypeName(refName);
    }

    // Handle composition schemas
    if (schema.anyOf) {
      const types = schema.anyOf.map((s: any) => this.getTypeString(s));
      return `(${types.join(' | ')})`;
    }

    if (schema.oneOf) {
      const types = schema.oneOf.map((s: any) => this.getTypeString(s));
      // Handle discriminated unions
      if (schema.discriminator) {
        return this.generateDiscriminatedUnion(schema, types);
      }
      return `(${types.join(' | ')})`;
    }

    if (schema.allOf) {
      const types = schema.allOf.map((s: any) => this.getTypeString(s));
      return `(${types.join(' & ')})`;
    }

    // Handle nullable types (OpenAPI 3.1)
    if (schema.type && Array.isArray(schema.type)) {
      const types = schema.type.map((t: string) => {
        if (t === 'null') return 'null';
        return this.getPrimitiveType(t, schema);
      });
      return types.join(' | ');
    }

    // Handle const values (OpenAPI 3.1)
    if (schema.const !== undefined) {
      return this.handleConst(schema);
    }

    // Handle nullable flag (OpenAPI 3.0)
    const baseType = this.getBaseTypeString(schema);
    if (schema.nullable === true) {
      return `(${baseType} | null)`;
    }

    return baseType;
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
          const props = Object.entries(schema.properties || {}).map(([key, prop]: [string, any]) => {
            const optional = !(schema.required || []).includes(key);
            const propType = this.getTypeString(prop);
            return `${this.toPropertyName(key)}${optional ? '?' : ''}: ${propType}`;
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
          typeName = this.toTypeName(refName || '');
        } else {
          typeName = this.toTypeName(key);
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
      isTypeOnly: false,
    });

    file.addImportDeclaration({
      moduleSpecifier: 'axios',
      defaultImport: 'axios',
    });

    // Collect all type names used in the client
    const usedTypes = this.collectUsedTypes();

    if (usedTypes.length > 0) {
      file.addImportDeclaration({
        moduleSpecifier: './types.js',
        namedImports: usedTypes,
        isTypeOnly: true,
      });
    }

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
      ],
    });

    if (!this.api || !this.api.paths) return;

    // Group operations by namespace (from operationId) and generate namespace properties
    const namespacedOperations = this.groupOperationsByNamespace();

    // Collect root namespaces and generate them with all their sub-operations
    const rootNamespaces = new Set<string>();
    const allOperations = Array.from(Object.values(namespacedOperations)).flat();

    for (const [namespace, operations] of Object.entries(namespacedOperations)) {
      if (namespace === 'default') {
        // Add methods directly to the main class for operations without namespace
        for (const { path, method, operation } of operations) {
          this.generateMethod(classDeclaration, path, method, operation);
        }
      } else {
        const rootNamespace = namespace.split('/')[0];
        rootNamespaces.add(rootNamespace);
      }
    }

    // Generate each root namespace with all its sub-operations
    for (const rootNamespace of rootNamespaces) {
      const allRootOperations = allOperations.filter(op => 
        op.operationId.startsWith(rootNamespace + '/')
      );
      
      if (rootNamespace.includes('/')) {
        // This should not happen since we're taking only the first part
        this.generateNestedNamespace(classDeclaration, rootNamespace, allRootOperations);
      } else {
        // Check if it has nested operations
        const hasNested = allRootOperations.some(op => 
          op.operationId.split('/').length > 2
        );
        
        if (hasNested) {
          this.generateNestedNamespace(classDeclaration, rootNamespace, allRootOperations);
        } else {
          this.generateNamespaceProperty(classDeclaration, rootNamespace, allRootOperations);
        }
      }
    }
  }

  private collectUsedTypes(): string[] {
    const usedTypes = new Set<string>();

    if (!this.api || !this.api.paths) return [];

    // Get all available schemas for reference resolution
    const allSchemas = (this.api.components as any)?.schemas || (this.api as any)?.definitions || {};

    // Collect types from all operations
    for (const [, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        if (item[method]) {
          const operation = item[method];

          // Collect types from parameters
          const parameters = operation.parameters || [];
          for (const param of parameters) {
            const paramSchema = this.getParameterSchema(param);
            this.collectTypesFromSchema(paramSchema, usedTypes, allSchemas, new Set());
          }

          // Collect types from request body
          if (operation.requestBody?.content) {
            for (const content of Object.values(operation.requestBody.content) as any[]) {
              if (content.schema) {
                this.collectTypesFromSchema(content.schema, usedTypes, allSchemas, new Set());
              }
            }
          }

          // Collect types from success responses only (matching getResponseType logic)
          if (operation.responses) {
            const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204'];
            if (successResponse) {
              // OpenAPI v3 format: responses have content property
              if (successResponse.content) {
                for (const content of Object.values(successResponse.content) as any[]) {
                  if (content.schema) {
                    this.collectTypesFromSchema(content.schema, usedTypes, allSchemas, new Set());
                  }
                }
              }
              // OpenAPI v2 (Swagger 2.0) format: responses have schema property directly
              else if (successResponse.schema) {
                this.collectTypesFromSchema(successResponse.schema, usedTypes, allSchemas, new Set());
              }
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
        const typeName = this.toTypeName(refName);
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

  private resolveSchemaReference(ref: string, allSchemas: Record<string, any>): any {
    if (!ref || !ref.startsWith('#')) {
      return null;
    }

    // Handle OpenAPI 3.x references: #/components/schemas/SchemaName
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.split('/').pop();
      return schemaName ? allSchemas[schemaName] : null;
    }

    // Handle OpenAPI 2.0 references: #/definitions/SchemaName
    if (ref.startsWith('#/definitions/')) {
      const schemaName = ref.split('/').pop();
      return schemaName ? allSchemas[schemaName] : null;
    }

    return null;
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

  private groupOperationsByNamespace(): Record<string, Array<{ path: string; method: string; operation: any; operationId: string }>> {
    const groups: Record<string, Array<{ path: string; method: string; operation: any; operationId: string }>> = {};
    const operationIdTracker = new Map<string, number>();

    if (!this.api || !this.api.paths) return groups;

    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
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

          // Extract namespace from operationId by splitting on '/' and creating full namespace path
          let namespace = 'default';
          if (operationId.includes('/')) {
            const parts = operationId.split('/');
            // Take all parts except the last one as namespace (support nested namespaces)
            if (parts.length > 1) {
              namespace = parts.slice(0, -1).join('/');
            }
          }

          if (!groups[namespace]) groups[namespace] = [];
          groups[namespace].push({ path, method, operation, operationId });
        }
      }
    }

    return groups;
  }

  private generateNamespaceProperty(classDeclaration: any, namespace: string, operations: Array<{ path: string; method: string; operation: any; operationId: string }>): void {
    const file = classDeclaration.getSourceFile();

    // Create an interface for the namespace methods
    const namespaceInterfaceName = `${this.toTypeName(namespace)}Operations`;
    const namespaceInterface = file.addInterface({
      name: namespaceInterfaceName,
      isExported: true,
    });

    // Add JSDoc for the namespace interface
    namespaceInterface.addJsDoc({
      description: `${namespace} namespace operations`,
    });

    // Generate method signatures for the interface
    for (const { path, method, operation, operationId } of operations) {
      const methodName = this.toMethodName(operationId);
      const parameters = operation.parameters || [];
      const requestBody = operation.requestBody;

      const methodParams: any[] = [];
      const allParams: any[] = [];

      // Collect all parameters
      for (const param of parameters) {
        const paramName = this.toPropertyName(param.name);
        const paramSchema = this.getParameterSchema(param);
        const paramType = this.getTypeString(paramSchema);

        const paramInfo = {
          name: paramName,
          type: paramType,
          required: param.required,
          description: param.description,
          in: param.in,
        };

        allParams.push(paramInfo);
      }

      // Create parameter type interface if there are any parameters
      const hasParams = allParams.length > 0;
      let paramsTypeName = '';

      if (hasParams) {
        paramsTypeName = `${this.toTypeName(methodName)}Params`;
        this.generateParameterInterface(file, paramsTypeName, allParams);

        const allRequired = allParams.filter(p => p.required).length > 0;
        methodParams.push({
          name: 'params',
          type: paramsTypeName,
          hasQuestionToken: !allRequired,
        });
      }

      // Add request body as separate parameter
      if (requestBody) {
        const contentType = Object.keys(requestBody.content || {})[0];
        const schema = requestBody.content?.[contentType]?.schema;
        methodParams.push({
          name: 'data',
          type: this.getTypeString(schema),
          hasQuestionToken: !requestBody.required,
        });
      }

      methodParams.push({
        name: 'config',
        type: 'AxiosRequestConfig',
        hasQuestionToken: true,
      });

      const responseType = this.getResponseType(operation.responses);

      // Add method signature to interface
      namespaceInterface.addMethod({
        name: methodName,
        parameters: methodParams,
        returnType: `Promise<AxiosResponse<${responseType}>>`,
        docs: operation.summary ? [{ description: operation.summary }] : undefined,
      });
    }

    // Add the namespace property to the main class
    classDeclaration.addProperty({
      name: namespace,
      type: namespaceInterfaceName,
      isReadonly: true,
      scope: 'public' as any,
      docs: [{ description: `${namespace} namespace operations` }],
    });

    // Initialize the namespace property in the constructor
    const constructor = classDeclaration.getConstructors()[0];
    if (constructor) {
      const statements = constructor.getStatements();
      const initStatement = `this.${namespace} = {
${operations.map(({ operationId }) => {
        const methodName = this.toMethodName(operationId);
        return `      ${methodName}: this.${namespace}_${methodName}.bind(this)`;
      }).join(',\n')}
    };`;

      constructor.addStatements([initStatement]);
    }

    // Generate the actual implementation methods as private methods
    for (const { path, method, operation, operationId } of operations) {
      const methodName = this.toMethodName(operationId);
      this.generateMethod(classDeclaration, path, method, operation, `${namespace}_${methodName}`);
    }
  }

  private generateNestedNamespace(classDeclaration: any, namespacePath: string, operations: Array<{ path: string; method: string; operation: any; operationId: string }>): void {
    const file = classDeclaration.getSourceFile();
    const namespaceParts = namespacePath.split('/');

    // Collect ALL operations that start with the root namespace, not just the exact path
    const rootNamespace = namespaceParts[0];
    const allRootOperations = operations.filter(op => 
      op.operationId.startsWith(rootNamespace + '/')
    );

    // Build the nested namespace structure
    this.buildNestedNamespaceStructure(classDeclaration, namespaceParts, allRootOperations);
  }

  private buildNestedNamespaceStructure(classDeclaration: any, namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string }>): void {
    const file = classDeclaration.getSourceFile();
    
    // Create interfaces for each level of nesting
    this.createNestedInterfaces(file, namespaceParts, operations);
    
    // Add the root namespace property to the main class if it doesn't exist
    const rootNamespace = namespaceParts[0];
    const rootInterfaceName = `${this.toTypeName(rootNamespace)}Operations`;
    
    const existingProperty = classDeclaration.getProperty(rootNamespace);
    if (!existingProperty) {
      classDeclaration.addProperty({
        name: rootNamespace,
        type: rootInterfaceName,
        isReadonly: true,
        scope: 'public' as any,
        docs: [{ description: `${rootNamespace} namespace operations` }],
      });

      // Initialize in constructor
      const constructor = classDeclaration.getConstructors()[0];
      if (constructor) {
        // Collect all operations that start with this root namespace
        const allRootOperations = operations.filter(op => 
          op.operationId.startsWith(rootNamespace + '/')
        );
        const initStatement = this.buildNamespaceInitialization([rootNamespace], allRootOperations);
        constructor.addStatements([`this.${rootNamespace} = ${initStatement};`]);
      }
    }

    // Generate the actual implementation methods as private methods
    for (const { path, method, operation, operationId } of operations) {
      const methodName = this.toMethodName(operationId);
      // Use the full operation namespace path, not just the initial namespaceParts
      const fullNamespacePath = operationId.split('/').slice(0, -1); // All parts except method name
      const privateMethodName = this.getPrivateMethodName(fullNamespacePath, methodName);
      this.generateMethod(classDeclaration, path, method, operation, privateMethodName);
    }
  }

  private createNestedInterfaces(file: SourceFile, namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string }>): void {
    // Find all unique namespace levels in the operations
    const allNamespaceLevels = new Set<string>();
    
    for (const operation of operations) {
      const opParts = operation.operationId.split('/');
      if (opParts.length > 1) {
        // Add all namespace levels for this operation
        for (let i = 1; i < opParts.length; i++) {
          const namespacePath = opParts.slice(0, i).join('/');
          allNamespaceLevels.add(namespacePath);
        }
      }
    }

    // Convert to sorted array for consistent ordering
    const sortedLevels = Array.from(allNamespaceLevels).sort();

    // Create interfaces for each namespace level
    for (const namespacePath of sortedLevels) {
      const namespacePathParts = namespacePath.split('/');
      const interfaceName = `${this.toTypeName(namespacePathParts.join('_'))}Operations`;
      
      // Check if interface already exists
      if (file.getInterface(interfaceName)) {
        continue;
      }

      const interfaceDeclaration = file.addInterface({
        name: interfaceName,
        isExported: true,
      });

      interfaceDeclaration.addJsDoc({
        description: `${namespacePath} namespace operations`,
      });

      // Find direct methods at this level (not in sub-namespaces)
      const directMethods = operations.filter(op => {
        const opParts = op.operationId.split('/');
        return opParts.slice(0, -1).join('/') === namespacePath;
      });

      // Add method signatures for direct methods
      for (const { path, method, operation, operationId } of directMethods) {
        this.addMethodSignatureToInterface(interfaceDeclaration, path, method, operation, operationId);
      }

      // Find sub-namespaces at this level
      const subNamespaces = new Set<string>();
      for (const operation of operations) {
        const opParts = operation.operationId.split('/');
        if (opParts.length > namespacePathParts.length + 1) {
          const nextLevelParts = opParts.slice(0, namespacePathParts.length + 1);
          if (nextLevelParts.slice(0, namespacePathParts.length).join('/') === namespacePath) {
            subNamespaces.add(nextLevelParts[namespacePathParts.length]);
          }
        }
      }

      // Add properties for sub-namespaces
      for (const subNamespace of subNamespaces) {
        const subNamespacePath = [...namespacePathParts, subNamespace];
        const subInterfaceName = `${this.toTypeName(subNamespacePath.join('_'))}Operations`;
        
        interfaceDeclaration.addProperty({
          name: subNamespace,
          type: subInterfaceName,
          isReadonly: true,
          docs: [{ description: `${subNamespace} sub-namespace` }],
        });
      }
    }
  }

  private addMethodSignatureToInterface(interfaceDeclaration: any, path: string, method: string, operation: any, operationId: string): void {
    const methodName = this.toMethodName(operationId);
    const parameters = operation.parameters || [];
    const requestBody = operation.requestBody;

    const methodParams: any[] = [];
    const allParams: any[] = [];

    // Collect all parameters
    for (const param of parameters) {
      const paramName = this.toPropertyName(param.name);
      const paramSchema = this.getParameterSchema(param);
      const paramType = this.getTypeString(paramSchema);

      const paramInfo = {
        name: paramName,
        type: paramType,
        required: param.required,
        description: param.description,
        in: param.in,
      };

      allParams.push(paramInfo);
    }

    // Create parameter type interface if there are any parameters
    const hasParams = allParams.length > 0;
    let paramsTypeName = '';

    if (hasParams) {
      paramsTypeName = `${this.toTypeName(methodName)}Params`;
      this.generateParameterInterface(interfaceDeclaration.getSourceFile(), paramsTypeName, allParams);

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
      methodParams.push({
        name: 'data',
        type: this.getTypeString(schema),
        hasQuestionToken: !requestBody.required,
      });
    }

    methodParams.push({
      name: 'config',
      type: 'AxiosRequestConfig',
      hasQuestionToken: true,
    });

    const responseType = this.getResponseType(operation.responses);

    // Add method signature to interface
    interfaceDeclaration.addMethod({
      name: methodName,
      parameters: methodParams,
      returnType: `Promise<AxiosResponse<${responseType}>>`,
      docs: operation.summary ? [{ description: operation.summary }] : undefined,
    });
  }

  private buildNamespaceInitialization(namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string }>): string {
    // Build a tree structure for the namespace
    const tree = this.buildNamespaceTree(namespaceParts, operations);
    const content = this.generateNamespaceObjectFromTree(tree);
    return `{\n${content}\n    }`;
  }

  private buildNamespaceTree(namespaceParts: string[], operations: Array<{ path: string; method: string; operation: any; operationId: string }>): any {
    const tree: any = {};
    
    // Process all operations that start with our root namespace
    const rootNamespace = namespaceParts[0];
    
    for (const operation of operations) {
      const opParts = operation.operationId.split('/');
      
      // Only process operations that start with our root namespace
      if (!operation.operationId.startsWith(rootNamespace + '/')) continue;
      
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
      const methodName = this.toMethodName(operation.operationId);
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

  private generateMethod(classDeclaration: any, path: string, method: string, operation: any, customMethodName?: string): void {
    const baseMethodName = this.toMethodName(operation.operationId || `${method}_${path}`);
    const methodName = customMethodName || baseMethodName;
    const parameters = operation.parameters || [];
    const requestBody = operation.requestBody;

    const methodParams: any[] = [];
    const pathParams: string[] = [];
    const queryParams: string[] = [];
    const headerParams: string[] = [];
    const allParams: any[] = [];

    // Collect all parameters
    for (const param of parameters) {
      const paramName = this.toPropertyName(param.name);
      const paramSchema = this.getParameterSchema(param);
      const paramType = this.getTypeString(paramSchema);

      const paramInfo = {
        name: paramName,
        type: paramType,
        required: param.required,
        description: param.description,
        in: param.in,
      };

      // Only add non-body parameters to allParams
      if (param.in !== 'body') {
        allParams.push(paramInfo);
      }

      if (param.in === 'path') {
        pathParams.push(paramName);
      } else if (param.in === 'query') {
        queryParams.push(paramName);
      } else if (param.in === 'header') {
        headerParams.push(paramName);
      }
    }

    // Create parameter type interface if there are any parameters (excluding request body)
    const hasParams = allParams.length > 0;
    let paramsTypeName = '';

    // Check if we have body parameters (OpenAPI v2 or v3)
    const bodyParams = parameters.filter((param: any) => param.in === 'body');
    const hasRequestBody = requestBody || bodyParams.length > 0;
    const bodyRequired = requestBody ? requestBody.required : (bodyParams.length > 0 ? bodyParams[0].required : false);

    // Determine if data will be required
    const dataRequired = (requestBody && requestBody.required) || (bodyParams.length > 0 && bodyParams[0].required);

    if (hasParams) {
      paramsTypeName = `${this.toTypeName(baseMethodName)}Params`;
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
    if (requestBody) {
      const contentType = Object.keys(requestBody.content || {})[0];
      const schema = requestBody.content?.[contentType]?.schema;
      methodParams.push({
        name: 'data',
        type: this.getTypeString(schema),
        hasQuestionToken: !requestBody.required,
      });
    }

    // Add OpenAPI v2 body parameters as separate parameter
    if (bodyParams.length > 0) {
      // For OpenAPI v2, we expect only one body parameter
      const bodyParam = bodyParams[0];
      const bodySchema = this.getParameterSchema(bodyParam);
      methodParams.push({
        name: 'data',
        type: this.getTypeString(bodySchema),
        hasQuestionToken: !bodyParam.required,
      });
    }

    methodParams.push({
      name: 'config',
      type: 'AxiosRequestConfig',
      hasQuestionToken: true,
    });

    const responseType = this.getResponseType(operation.responses);

    const methodDeclaration = classDeclaration.addMethod({
      name: methodName,
      isAsync: true,
      parameters: methodParams,
      returnType: `Promise<AxiosResponse<${responseType}>>`,
      scope: customMethodName ? 'private' as any : 'public' as any,
    });

    // Generate comprehensive JSDoc for the method
    const jsdocParts: string[] = [];

    // Main description
    if (operation.summary) {
      jsdocParts.push(operation.summary);
    }
    if (operation.description && operation.description !== operation.summary) {
      if (jsdocParts.length > 0) jsdocParts.push('');
      jsdocParts.push(operation.description);
    }

    // Add operationId
    const operationId = operation.operationId || `${method}_${path}`;
    if (jsdocParts.length > 0) jsdocParts.push('');
    jsdocParts.push(`@operationId ${operationId}`);

    // Parameters documentation
    const paramDocs: string[] = [];

    // Document params object if it exists
    if (hasParams) {
      let paramsDoc = `@param params Parameters object containing`;
      const paramTypes: string[] = [];
      if (pathParams.length > 0) paramTypes.push('path parameters');
      if (queryParams.length > 0) paramTypes.push('query parameters');
      if (headerParams.length > 0) paramTypes.push('headers');
      paramsDoc += ` ${paramTypes.join(', ')}`;
      paramDocs.push(paramsDoc);
    }

    // Request body documentation
    if (requestBody) {
      let bodyDoc = '@param data Request body';
      if (requestBody.description) {
        bodyDoc += ` - ${requestBody.description}`;
      }
      paramDocs.push(bodyDoc);
    }

    // Config parameter
    paramDocs.push('@param config Optional axios request configuration');

    // Response documentation
    let responseDoc = '@returns Promise with response data';
    const successResponse = operation.responses?.['200'] || operation.responses?.['201'] || operation.responses?.['204'];
    if (successResponse?.description) {
      responseDoc += ` - ${successResponse.description}`;
    }

    // Combine all documentation
    if (paramDocs.length > 0 || responseDoc) {
      if (jsdocParts.length > 0) jsdocParts.push('');
      jsdocParts.push(...paramDocs);
      jsdocParts.push(responseDoc);
    }

    if (jsdocParts.length > 0) {
      methodDeclaration.addJsDoc({
        description: jsdocParts.join('\n'),
      });
    }

    let urlTemplate = path;
    for (const param of pathParams) {
      urlTemplate = urlTemplate.replace(`{${param}}`, `\${params.${param}}`);
    }

    const statements: string[] = [];

    // Extract parameters from params object if it exists
    if (hasParams) {
      const allRequired = allParams.filter(p => p.required).length > 0;
      const paramsIsOptional = !allRequired;

      if (queryParams.length > 0) {
        const queryParamsList = queryParams.map(p => {
          const param = allParams.find(ap => this.toPropertyName(ap.name) === p);
          const isRequired = param?.required;
          const accessor = (paramsIsOptional || !isRequired) ? `params?.${p}` : `params.${p}`;
          return `${p}: ${accessor}`;
        }).join(', ');
        statements.push(`const queryParams = { ${queryParamsList} };`);
      }

      if (headerParams.length > 0) {
        const headerParamsList = headerParams.map(p => {
          const param = allParams.find(ap => this.toPropertyName(ap.name) === p);
          const isRequired = param?.required;
          const accessor = (paramsIsOptional || !isRequired) ? `params?.${p}` : `params.${p}`;
          return `${p}: ${accessor}`;
        }).join(', ');
        statements.push(`const headers = { ${headerParamsList} };`);
      }
    }

    let axiosCall = `this.client.${method}(\`${urlTemplate}\``;

    if (method === 'get' || method === 'delete' || method === 'head' || method === 'options') {
      if (queryParams.length > 0 || headerParams.length > 0) {
        const configParts: string[] = [];
        if (queryParams.length > 0) configParts.push('params: queryParams');
        if (headerParams.length > 0) configParts.push('headers');
        configParts.push('...config');
        axiosCall += `, { ${configParts.join(', ')} }`;
      } else if (methodParams.some(p => p.name === 'config')) {
        axiosCall += ', config';
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
    // Check if interface already exists to avoid duplicates
    const existingInterface = file.getInterface(typeName);
    if (existingInterface) {
      return;
    }

    const interfaceDeclaration = file.addInterface({
      name: typeName,
      isExported: true,
    });

    // Add all parameters (path, query, header) - excluding request body
    for (const param of allParams) {
      let description = param.description || '';
      if (param.in === 'path') {
        description = description ? `${description} (path parameter)` : 'Path parameter';
      } else if (param.in === 'query') {
        description = description ? `${description} (query parameter)` : 'Query parameter';
      } else if (param.in === 'header') {
        description = description ? `${description} (header parameter)` : 'Header parameter';
      }

      interfaceDeclaration.addProperty({
        name: this.toPropertyName(param.name),
        type: param.type,
        hasQuestionToken: !param.required,
        docs: description ? [{ description }] : undefined,
      });
    }
  }

  public getResponseType(responses: any): string {
    const successResponse = responses['200'] || responses['201'] || responses['204'];
    if (!successResponse) return 'unknown';

    // OpenAPI v3 format: responses have content property
    if (successResponse.content) {
      const content = successResponse.content;
      const contentType = Object.keys(content)[0];
      const schema = content[contentType]?.schema;
      return this.getTypeString(schema);
    }

    // OpenAPI v2 (Swagger 2.0) format: responses have schema property directly
    if (successResponse.schema) {
      return this.getTypeString(successResponse.schema);
    }

    // No schema/content found
    return 'void';
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

  public toTypeName(name: string): string {
    return name.replace(/[-_]([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/^./, c => c.toUpperCase());
  }

  public toPropertyName(name: string): string {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      return name;
    }
    return `'${name}'`;
  }

  public toMethodName(operationId: string): string {
    // Handle namespace patterns: if operationId looks like clean namespace/method pattern,
    // take everything after the first '/'. Otherwise, treat the whole thing as method name.
    let methodPart = operationId;
    if (operationId.includes('/')) {
      const parts = operationId.split('/');
      // If first part looks like a clean namespace (alphanumeric), use everything after first slash
      if (parts[0] && /^[a-zA-Z][a-zA-Z0-9]*$/.test(parts[0])) {
        methodPart = parts.slice(1).join('/');
      }
      // Otherwise treat the whole operationId as the method name
    }

    return methodPart
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .replace(/_([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/^./, c => c.toLowerCase());
  }

  private getParameterSchema(param: any): any {
    // OpenAPI v3 has schema property, v2 has type directly on parameter
    if (param.schema) {
      return param.schema;
    }

    // For OpenAPI v2, create a schema object from the parameter properties
    if (param.type) {
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

      return schema;
    }

    // Fallback for parameters without type information
    return { type: 'string' };
  }

  public generateJSDocComment(schema: any, propertyName?: string): string | undefined {
    const parts: string[] = [];

    // Main description
    if (schema.description) {
      parts.push(schema.description);
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

    // Enum values
    if (schema.enum && schema.enum.length > 0) {
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
      constraints.push(`Pattern: ${schema.pattern}`);
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

  // Configuration file handling methods
  public static async loadConfig(configPath: string = '.ott.json'): Promise<OTTConfig | null> {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent) as OTTConfig;
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
    configPath: string = '.ott.json'
  ): Promise<OTTConfig> {
    // Parse the OpenAPI spec to extract operationIds
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    let specInput: string | object = spec;

    // If spec is a URL, fetch it
    if (spec.startsWith('http://') || spec.startsWith('https://')) {
      const generator = new OpenAPIGenerator({ spec, outputDir: '' });
      specInput = await generator.fetchFromUrl(spec);
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

    const filteredPaths: any = {};
    
    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      const filteredItem: any = {};
      let hasOperations = false;

      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        if (item[method]) {
          const operation = item[method];
          const operationId = operation.operationId || `${method}_${path}`;
          
          if (this.operationIds.includes(operationId)) {
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
}