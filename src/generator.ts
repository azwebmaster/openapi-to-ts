import SwaggerParser from '@apidevtools/swagger-parser';
import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import * as https from 'https';
import * as http from 'http';

export interface GeneratorOptions {
  inputSpec: string;
  outputDir: string;
  axiosInstanceName?: string;
  namespace?: string;
  headers?: Record<string, string>;
}

type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

export class OpenAPIGenerator {
  private project: Project;
  private api: OpenAPIDocument | null = null;
  private namespace: string;

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
  }

  async generate(): Promise<void> {
    let specInput: string | object = this.options.inputSpec;

    // If inputSpec is a URL, fetch it
    if (this.options.inputSpec.startsWith('http://') || this.options.inputSpec.startsWith('https://')) {
      specInput = await this.fetchFromUrl(this.options.inputSpec, this.options.headers);
    }

    this.api = await SwaggerParser.parse(specInput as any) as OpenAPIDocument;

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
    const file = this.project.createSourceFile(
      path.join(this.options.outputDir, 'types.ts'),
      undefined,
      { overwrite: true }
    );

    if (!this.api) return;

    const schemas = (this.api.components as any)?.schemas || {};

    for (const [name, schema] of Object.entries(schemas)) {
      this.generateTypeFromSchema(file, name, schema as any);
    }
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
    if (!schema) return 'any';

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
        return `Array<${this.getTypeString(schema.items)}>`;
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
            return 'Record<string, any>';
          }
          return `Record<string, ${this.getTypeString(schema.additionalProperties)}>`;
        }
        return 'Record<string, any>';
      default:
        return 'any';
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
        return `Array<${this.getTypeString(schema.items)}>`;
      case 'object':
        return 'Record<string, any>';
      default:
        return 'any';
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
    return 'any';
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

    const pathGroups = this.groupPathsByTag();

    for (const [, paths] of Object.entries(pathGroups)) {
      for (const { path, method, operation } of paths) {
        this.generateMethod(classDeclaration, path, method, operation);
      }
    }
  }

  private collectUsedTypes(): string[] {
    const usedTypes = new Set<string>();

    if (!this.api || !this.api.paths) return [];

    // Collect types from all operations
    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      const item = pathItem as any;
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        if (item[method]) {
          const operation = item[method];

          // Collect types from parameters
          const parameters = operation.parameters || [];
          for (const param of parameters) {
            if (param.schema) {
              this.collectTypesFromSchema(param.schema, usedTypes);
            }
          }

          // Collect types from request body
          if (operation.requestBody?.content) {
            for (const content of Object.values(operation.requestBody.content) as any[]) {
              if (content.schema) {
                this.collectTypesFromSchema(content.schema, usedTypes);
              }
            }
          }

          // Collect types from responses
          if (operation.responses) {
            for (const response of Object.values(operation.responses) as any[]) {
              if (response.content) {
                for (const content of Object.values(response.content) as any[]) {
                  if (content.schema) {
                    this.collectTypesFromSchema(content.schema, usedTypes);
                  }
                }
              }
            }
          }
        }
      }
    }

    return Array.from(usedTypes).sort();
  }

  private collectTypesFromSchema(schema: any, usedTypes: Set<string>): void {
    if (!schema) return;

    // Handle $ref
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      if (refName) {
        usedTypes.add(this.toTypeName(refName));
      }
      return;
    }

    // Handle composition schemas
    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const schemas = schema.anyOf || schema.oneOf || schema.allOf;
      for (const subSchema of schemas) {
        this.collectTypesFromSchema(subSchema, usedTypes);
      }
      return;
    }

    // Handle arrays
    if (schema.type === 'array' && schema.items) {
      this.collectTypesFromSchema(schema.items, usedTypes);
    }

    // Handle objects with properties
    if (schema.properties) {
      for (const propSchema of Object.values(schema.properties)) {
        this.collectTypesFromSchema(propSchema as any, usedTypes);
      }
    }

    // Handle additional properties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      this.collectTypesFromSchema(schema.additionalProperties, usedTypes);
    }
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

  private generateMethod(classDeclaration: any, path: string, method: string, operation: any): void {
    const methodName = this.toMethodName(operation.operationId || `${method}_${path}`);
    const parameters = operation.parameters || [];
    const requestBody = operation.requestBody;

    const methodParams: any[] = [];
    const pathParams: string[] = [];
    const queryParams: string[] = [];
    const headerParams: string[] = [];

    for (const param of parameters) {
      const paramName = this.toPropertyName(param.name);
      const paramType = this.getTypeString(param.schema);

      methodParams.push({
        name: paramName,
        type: paramType,
        hasQuestionToken: !param.required,
      });

      if (param.in === 'path') {
        pathParams.push(paramName);
      } else if (param.in === 'query') {
        queryParams.push(paramName);
      } else if (param.in === 'header') {
        headerParams.push(paramName);
      }
    }

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

    const methodDeclaration = classDeclaration.addMethod({
      name: methodName,
      isAsync: true,
      parameters: methodParams,
      returnType: `Promise<AxiosResponse<${responseType}>>`,
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

    // Parameters documentation
    const paramDocs: string[] = [];
    for (const param of parameters) {
      const paramName = this.toPropertyName(param.name);
      let paramDoc = `@param ${paramName}`;

      if (param.description) {
        paramDoc += ` ${param.description}`;
      }

      // Add parameter constraints
      const constraints: string[] = [];
      if (param.schema) {
        if (param.schema.format) constraints.push(`Format: ${param.schema.format}`);
        if (param.schema.minimum !== undefined) constraints.push(`Min: ${param.schema.minimum}`);
        if (param.schema.maximum !== undefined) constraints.push(`Max: ${param.schema.maximum}`);
        if (param.schema.enum) constraints.push(`Values: ${param.schema.enum.join(', ')}`);
        if (param.schema.example !== undefined) constraints.push(`Example: ${param.schema.example}`);
      }

      if (constraints.length > 0) {
        paramDoc += ` (${constraints.join(', ')})`;
      }

      paramDocs.push(paramDoc);
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
      urlTemplate = urlTemplate.replace(`{${param}}`, `\${${param}}`);
    }

    const statements: string[] = [];

    if (queryParams.length > 0) {
      statements.push(`const params = { ${queryParams.join(', ')} };`);
    }

    if (headerParams.length > 0) {
      statements.push(`const headers = { ${headerParams.join(', ')} };`);
    }

    let axiosCall = `this.client.${method}(\`${urlTemplate}\``;

    if (method === 'get' || method === 'delete' || method === 'head' || method === 'options') {
      if (queryParams.length > 0 || headerParams.length > 0) {
        const configParts: string[] = [];
        if (queryParams.length > 0) configParts.push('params');
        if (headerParams.length > 0) configParts.push('headers');
        configParts.push('...config');
        axiosCall += `, { ${configParts.join(', ')} }`;
      } else if (methodParams.some(p => p.name === 'config')) {
        axiosCall += ', config';
      }
    } else {
      if (requestBody) {
        axiosCall += ', data';
      } else {
        axiosCall += ', undefined';
      }

      if (queryParams.length > 0 || headerParams.length > 0) {
        const configParts: string[] = [];
        if (queryParams.length > 0) configParts.push('params');
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

  public getResponseType(responses: any): string {
    const successResponse = responses['200'] || responses['201'] || responses['204'];
    if (!successResponse) return 'any';

    const content = successResponse.content;
    if (!content) return 'void';

    const contentType = Object.keys(content)[0];
    const schema = content[contentType]?.schema;

    return this.getTypeString(schema);
  }

  private async generateIndex(): Promise<void> {
    const file = this.project.createSourceFile(
      path.join(this.options.outputDir, 'index.ts'),
      undefined,
      { overwrite: true }
    );

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
          initializer: `(baseURL: string, config?: any) => new ${this.namespace}Client(baseURL, config)`,
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
    return operationId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .replace(/_([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/^./, c => c.toLowerCase());
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
}