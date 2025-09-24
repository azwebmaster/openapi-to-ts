#!/usr/bin/env node

import { Command } from 'commander';
import { generateFromSpec, TypeOutputMode, OpenAPIGenerator, OTTConfig, APIConfig } from './index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version info
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const program = new Command();

program
  .name('openapi-gen')
  .description('Generate TypeScript clients from OpenAPI specifications')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize .ott.json configuration file from OpenAPI spec')
  .argument('<spec>', 'Path to OpenAPI specification file (YAML or JSON) or URL')
  .option('-o, --output <dir>', 'Output directory for generated files', './generated')
  .option('-c, --config <file>', 'Configuration file path', '.ott.json')
  .action(async (spec: string, options) => {
    try {
      console.log('🔧 Initializing OpenAPI TypeScript Generator Configuration');
      console.log('======================================================\n');

      // Check if spec is a URL or file path
      const isUrl = spec.startsWith('http://') || spec.startsWith('https://');

      if (!isUrl) {
        if (!fs.existsSync(spec)) {
          console.error(`❌ Error: OpenAPI spec file not found: ${spec}`);
          process.exit(1);
        }
      }

      console.log(`📄 Input spec: ${spec}`);
      console.log(`📁 Output directory: ${path.resolve(options.output)}`);
      console.log(`⚙️  Config file: ${options.config}\n`);

      const config = await OpenAPIGenerator.generateConfigFromSpec(
        spec,
        options.output,
        options.config
      );

      console.log('✅ Configuration file created successfully!');
      console.log(`📋 Found ${config.apis[0].operationIds?.length || 0} operations`);
      console.log(`📝 Edit ${options.config} to customize which operations to include\n`);

      console.log('Next steps:');
      console.log('1. Edit the operationIds array in .ott.json to select which operations to generate');
      console.log('2. Run: openapi-gen generate --config to generate the client');

    } catch (error: any) {
      console.error('\n❌ Failed to initialize configuration:');
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available operations from configuration file')
  .option('-c, --config <file>', 'Configuration file path', '.ott.json')
  .option('--api <name>', 'API name to list operations for (if multiple APIs in config)')
  .action(async (options) => {
    try {
      console.log('📋 Available Operations');
      console.log('======================\n');

      const config = await OpenAPIGenerator.loadConfig(options.config);
      if (!config) {
        console.error(`❌ Error: Configuration file not found: ${options.config}`);
        console.error('   Run "openapi-gen init <spec>" to create a configuration file first.');
        process.exit(1);
      }

      // Validate config structure
      if (!config.apis || !Array.isArray(config.apis)) {
        console.error(`❌ Error: Invalid configuration file format. Missing or invalid 'apis' array.`);
        console.error('   Run "openapi-gen init <spec>" to create a new configuration file.');
        process.exit(1);
      }

      if (config.apis.length === 0) {
        console.error(`❌ Error: No APIs found in configuration file.`);
        console.error('   Run "openapi-gen init <spec>" to create a new configuration file.');
        process.exit(1);
      }

      let apiConfig: APIConfig | null = null;

      if (options.api) {
        apiConfig = config.apis.find(api => api.name === options.api) || null;
        if (!apiConfig) {
          console.error(`❌ Error: API "${options.api}" not found in configuration file.`);
          console.error(`   Available APIs: ${config.apis.map(api => api.name).join(', ')}`);
          process.exit(1);
        }
      } else if (config.apis.length === 1) {
        apiConfig = config.apis[0];
      } else {
        console.error(`❌ Error: Multiple APIs found in configuration file. Use --api <name> to specify which one.`);
        console.error(`   Available APIs: ${config.apis.map(api => api.name).join(', ')}`);
        process.exit(1);
      }

      console.log(`🏷️  API: ${apiConfig.name}`);
      console.log(`📄 Spec: ${apiConfig.spec}`);
      console.log(`📁 Output: ${apiConfig.output || './generated'}`);
      console.log(`🏷️  Namespace: ${apiConfig.namespace || 'API'}`);
      console.log(`⚙️  Axios instance: ${apiConfig.axiosInstance || 'apiClient'}`);
      console.log(`📦 Type output: ${apiConfig.typeOutput || 'single-file'}`);
      console.log(`🎯 Selected operations: ${apiConfig.operationIds?.length || 'all'}\n`);

      if (apiConfig.operationIds && apiConfig.operationIds.length > 0) {
        console.log('Selected operations:');
        apiConfig.operationIds.forEach((operationId, index) => {
          console.log(`  ${index + 1}. ${operationId}`);
        });
      } else {
        console.log('All operations will be generated (no filtering applied)');
      }

    } catch (error: any) {
      console.error('\n❌ Failed to list operations:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('Generate TypeScript client from OpenAPI spec')
  .argument('[spec]', 'Path to OpenAPI specification file (YAML or JSON) or URL (optional if config file found)')
  .option('-o, --output <dir>', 'Output directory for generated files', './generated')
  .option('-n, --namespace <name>', 'Namespace for the generated client', 'API')
  .option('-a, --axios-instance <name>', 'Name for the Axios instance', 'apiClient')
  .option('-t, --type-output <mode>', 'Type output mode: single-file, file-per-type, or group-by-tag', 'single-file')
  .option('-H, --header <header>', 'Add header for URL requests (format: "Name: Value")', [])
  .option('-c, --config <file>', 'Use custom configuration file (default: auto-detect .ott.json)')
  .option('--api <name>', 'API name to generate from config (if multiple APIs in config)')
  .option('--operation-ids <ids>', 'Comma-separated list of operation IDs to include', [])
  .option('--dry-run', 'Show what would be generated without writing files')
  .action(async (spec: string, options) => {
    try {
      console.log('🚀 OpenAPI TypeScript Generator');
      console.log('================================\n');

      let apiConfig: APIConfig | null = null;

      // Parse operation IDs early
      const cliOperationIds: string[] = [];
      const operationIdsOptions = Array.isArray(options.operationIds) ? options.operationIds : (options.operationIds ? [options.operationIds] : []);
      if (operationIdsOptions.length > 0) {
        for (const operationIdsString of operationIdsOptions) {
          const ids = operationIdsString.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
          cliOperationIds.push(...ids);
        }
      }

      // Determine whether the user provided generation options explicitly
      // We inspect argv to distinguish defaults from explicit flags
      const argv = process.argv.slice(2);
      const generationFlags = new Set([
        '-o', '--output',
        '-n', '--namespace',
        '-a', '--axios-instance',
        '-t', '--type-output',
        '-H', '--header',
        '--operation-ids',
        '--dry-run',
      ]);
      const hasExplicitGenFlags = argv.some(a => generationFlags.has(a));

      // Determine config file path
      let configPath: string | null = null;
      if (options.config) {
        // Use explicitly specified config file
        configPath = options.config;
      } else if (!hasExplicitGenFlags && !spec) {
        // Auto-detect default config file only when no other options are provided
        const defaultConfigPath = path.resolve(process.cwd(), '.ott.json');
        if (fs.existsSync(defaultConfigPath)) {
          configPath = defaultConfigPath;
        }
      }

      // Handle configuration file mode
      if (configPath) {
        const config = await OpenAPIGenerator.loadConfig(configPath);
        if (!config) {
          console.error(`❌ Error: Configuration file not found: ${configPath}`);
          console.error('   Run "openapi-gen init <spec>" to create a configuration file first.');
          process.exit(1);
        }

        // Validate config structure
        if (!config.apis || !Array.isArray(config.apis)) {
          console.error(`❌ Error: Invalid configuration file format. Missing or invalid 'apis' array.`);
          console.error('   Run "openapi-gen init <spec>" to create a new configuration file.');
          process.exit(1);
        }

        if (config.apis.length === 0) {
          console.error(`❌ Error: No APIs found in configuration file.`);
          console.error('   Run "openapi-gen init <spec>" to create a new configuration file.');
          process.exit(1);
        }

        if (options.api) {
          apiConfig = config.apis.find(api => api.name === options.api) || null;
          if (!apiConfig) {
            console.error(`❌ Error: API "${options.api}" not found in configuration file.`);
            console.error(`   Available APIs: ${config.apis.map(api => api.name).join(', ')}`);
            process.exit(1);
          }
        } else if (config.apis.length === 1) {
          apiConfig = config.apis[0];
        } else {
          console.error(`❌ Error: Multiple APIs found in configuration file. Use --api <name> to specify which one.`);
          console.error(`   Available APIs: ${config.apis.map(api => api.name).join(', ')}`);
          process.exit(1);
        }

        if (options.config) {
          console.log(`📋 Using configuration: ${configPath}`);
        } else {
          console.log(`📋 Using default configuration from cwd: ${configPath}`);
        }
        console.log(`🏷️  API: ${apiConfig.name}`);
        console.log(`📄 Input spec: ${apiConfig.spec}`);
        console.log(`📁 Output directory: ${path.resolve(apiConfig.output || './generated')}`);
        console.log(`🏷️  Namespace: ${apiConfig.namespace || 'API'}`);
        console.log(`⚙️  Axios instance: ${apiConfig.axiosInstance || 'apiClient'}`);
        console.log(`📦 Type output mode: ${apiConfig.typeOutput || 'single-file'}`);
        if (cliOperationIds.length > 0) {
          console.log(`🎯 Operations: ${cliOperationIds.length} selected from CLI (${cliOperationIds.join(', ')})`);
        } else {
          console.log(`🎯 Operations: ${apiConfig.operationIds?.length || 'all'} selected`);
        }
        console.log('');
      } else {
        // Traditional mode - validate spec
        if (!spec) {
          console.error('❌ Error: No spec provided and no configuration file found.');
          console.error('   Use: openapi-gen generate <spec> or create a .ott.json configuration file');
          process.exit(1);
        }

        const isUrl = spec.startsWith('http://') || spec.startsWith('https://');

        if (!isUrl) {
          // Validate input file exists
          if (!fs.existsSync(spec)) {
            console.error(`❌ Error: OpenAPI spec file not found: ${spec}`);
            process.exit(1);
          }
        }
      }

      // Parse headers
      const headers: Record<string, string> = {};
      const headerOptions = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
      if (headerOptions.length > 0) {
        for (const header of headerOptions) {
          const colonIndex = header.indexOf(':');
          if (colonIndex === -1) {
            console.error(`❌ Error: Invalid header format "${header}". Use "Name: Value" format.`);
            process.exit(1);
          }
          const name = header.substring(0, colonIndex).trim();
          const value = header.substring(colonIndex + 1).trim();
          headers[name] = value;
        }
      }


      // Determine final configuration values
      let finalSpec: string;
      let finalOutputDir: string;
      let finalNamespace: string;
      let finalAxiosInstance: string;
      let finalTypeOutputMode: TypeOutputMode;
      let finalHeaders: Record<string, string>;
      let finalOperationIds: string[] | undefined;

      if (apiConfig) {
        // Use configuration file values
        finalSpec = apiConfig.spec;
        finalOutputDir = path.resolve(apiConfig.output || './generated');
        finalNamespace = apiConfig.namespace || 'API';
        finalAxiosInstance = apiConfig.axiosInstance || 'apiClient';
        
        // Map typeOutput string to TypeOutputMode enum
        const typeOutputModeMap: Record<string, TypeOutputMode> = {
          'single-file': TypeOutputMode.SingleFile,
          'file-per-type': TypeOutputMode.FilePerType,
          'group-by-tag': TypeOutputMode.GroupByTag,
        };
        finalTypeOutputMode = typeOutputModeMap[apiConfig.typeOutput || 'single-file'];
        
        finalHeaders = { ...apiConfig.headers, ...headers }; // CLI headers override config headers
        finalOperationIds = cliOperationIds.length > 0 ? cliOperationIds : apiConfig.operationIds;
      } else {
        // Use CLI options
        const isUrl = spec.startsWith('http://') || spec.startsWith('https://');
        
        // Validate type output mode
        const validModes = ['single-file', 'file-per-type', 'group-by-tag'];
        if (!validModes.includes(options.typeOutput)) {
          console.error(`❌ Error: Invalid type output mode "${options.typeOutput}". Valid modes are: ${validModes.join(', ')}`);
          process.exit(1);
        }

        // Map string to enum value
        const typeOutputModeMap: Record<string, TypeOutputMode> = {
          'single-file': TypeOutputMode.SingleFile,
          'file-per-type': TypeOutputMode.FilePerType,
          'group-by-tag': TypeOutputMode.GroupByTag,
        };

        finalSpec = isUrl ? spec : path.resolve(spec);
        finalOutputDir = path.resolve(options.output);
        finalNamespace = options.namespace;
        finalAxiosInstance = options.axiosInstance;
        finalTypeOutputMode = typeOutputModeMap[options.typeOutput];
        finalHeaders = headers;
        finalOperationIds = cliOperationIds.length > 0 ? cliOperationIds : undefined;

        console.log(`📄 Input spec: ${finalSpec}`);
        if (isUrl && Object.keys(headers).length > 0) {
          console.log(`🔑 Headers: ${Object.keys(headers).join(', ')} (${Object.keys(headers).length} header(s))`);
        }
        console.log(`📁 Output directory: ${finalOutputDir}`);
        console.log(`🏷️  Namespace: ${finalNamespace}`);
        console.log(`⚙️  Axios instance: ${finalAxiosInstance}`);
        console.log(`📦 Type output mode: ${options.typeOutput}`);
        if (cliOperationIds.length > 0) {
          console.log(`🎯 Operations: ${cliOperationIds.length} selected from CLI (${cliOperationIds.join(', ')})`);
        } else {
          console.log(`🎯 Operations: all`);
        }
        console.log('');
      }

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no files will be written\n');
        console.log('Would generate:');

        switch (finalTypeOutputMode) {
          case TypeOutputMode.FilePerType:
            console.log(`  ${finalOutputDir}/types.ts - Re-exports all types`);
            console.log(`  ${finalOutputDir}/types/*.ts - Individual type files`);
            break;
          case TypeOutputMode.GroupByTag:
            console.log(`  ${finalOutputDir}/types.ts - Re-exports all types`);
            console.log(`  ${finalOutputDir}/types/*.ts - Types grouped by tag/category`);
            break;
          default:
            console.log(`  ${finalOutputDir}/types.ts - All TypeScript interfaces`);
            break;
        }

        console.log(`  ${finalOutputDir}/client.ts - Axios client class`);
        console.log(`  ${finalOutputDir}/index.ts - Exports and factory function`);
        return;
      }

      // Generate the client
      await generateFromSpec({
        spec: finalSpec,
        outputDir: finalOutputDir,
        namespace: finalNamespace,
        axiosInstanceName: finalAxiosInstance,
        typeOutputMode: finalTypeOutputMode,
        headers: Object.keys(finalHeaders).length > 0 ? finalHeaders : undefined,
        operationIds: finalOperationIds
      });

      console.log('✅ Generation completed successfully!\n');
      console.log('Generated files:');

      switch (finalTypeOutputMode) {
        case TypeOutputMode.FilePerType:
          console.log(`  📄 ${path.relative(process.cwd(), finalOutputDir)}/types.ts (re-exports)`);
          console.log(`  📁 ${path.relative(process.cwd(), finalOutputDir)}/types/*.ts (individual type files)`);
          break;
        case TypeOutputMode.GroupByTag:
          console.log(`  📄 ${path.relative(process.cwd(), finalOutputDir)}/types.ts (re-exports)`);
          console.log(`  📁 ${path.relative(process.cwd(), finalOutputDir)}/types/*.ts (grouped type files)`);
          break;
        default:
          console.log(`  📄 ${path.relative(process.cwd(), finalOutputDir)}/types.ts`);
          break;
      }

      console.log(`  📄 ${path.relative(process.cwd(), finalOutputDir)}/client.ts`);
      console.log(`  📄 ${path.relative(process.cwd(), finalOutputDir)}/index.ts\n`);

      console.log('Usage:');
      console.log('```typescript');
      console.log(`import { createClient } from '${path.relative(process.cwd(), finalOutputDir)}';`);
      console.log('');
      console.log('const client = createClient("https://api.example.com");');
      console.log('const response = await client.someMethod();');
      console.log('```');

    } catch (error: any) {
      console.error('\n❌ Generation failed:');
      console.error(`   ${error.message}\n`);

      if (error.stack) {
        console.error('Stack trace:');
        console.error(error.stack);
      }

      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show information about an OpenAPI specification')
  .argument('<spec>', 'Path to OpenAPI specification file or URL')
  .option('-H, --header <header>', 'Add header for URL requests (format: "Name: Value")', [])
  .action(async (spec: string, options) => {
    try {
      // Check if spec is a URL or file path
      const isUrl = spec.startsWith('http://') || spec.startsWith('https://');

      if (!isUrl && !fs.existsSync(spec)) {
        console.error(`❌ Error: OpenAPI spec file not found: ${spec}`);
        process.exit(1);
      }

      // Parse headers for URL requests
      const headers: Record<string, string> = {};
      if (isUrl) {
        const headerOptions = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
        if (headerOptions.length > 0) {
          for (const header of headerOptions) {
            const colonIndex = header.indexOf(':');
            if (colonIndex === -1) {
              console.error(`❌ Error: Invalid header format "${header}". Use "Name: Value" format.`);
              process.exit(1);
            }
            const name = header.substring(0, colonIndex).trim();
            const value = header.substring(colonIndex + 1).trim();
            headers[name] = value;
          }
        }
      }

      // Import swagger parser dynamically to analyze the spec
      const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;

      let specInput: string | object = spec;
      if (isUrl) {
        // Use the same fetch logic as in generator
        const { OpenAPIGenerator } = await import('./generator.js');
        const generator = new OpenAPIGenerator({ spec, outputDir: '', headers });
        const generatorInstance = generator as any;
        specInput = await generatorInstance.fetchFromUrl(spec, headers);
      }

      const api = await SwaggerParser.parse(specInput as any) as any;

      console.log('📋 OpenAPI Specification Info');
      console.log('=============================\n');

      console.log(`📄 Title: ${api.info.title}`);
      console.log(`🔢 Version: ${api.info.version}`);
      console.log(`📝 Description: ${api.info.description || 'None'}`);
      
      // Handle both OpenAPI v3 and v2 version detection
      const openApiVersion = api.openapi || api.swagger;
      const versionType = api.openapi ? 'OpenAPI' : 'Swagger';
      console.log(`🌐 ${versionType} Version: ${openApiVersion}\n`);

      // Handle servers (OpenAPI v3) vs host/basePath/schemes (OpenAPI v2)
      if (api.servers && api.servers.length > 0) {
        console.log('🖥️  Servers:');
        api.servers.forEach((server: any, index: number) => {
          console.log(`   ${index + 1}. ${server.url}${server.description ? ` - ${server.description}` : ''}`);
        });
        console.log('');
      } else if (api.host || api.basePath || api.schemes) {
        console.log('🖥️  Server:');
        const schemes = api.schemes && api.schemes.length > 0 ? api.schemes : ['https'];
        const host = api.host || 'localhost';
        const basePath = api.basePath || '';
        schemes.forEach((scheme: string) => {
          console.log(`   ${scheme}://${host}${basePath}`);
        });
        console.log('');
      }

      const paths = Object.keys(api.paths || {});
      console.log(`🛣️  Endpoints: ${paths.length} paths`);
      if (paths.length > 0 && paths.length <= 10) {
        paths.forEach(path => {
          const methods = Object.keys(api.paths[path]).filter(m =>
            ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(m)
          );
          console.log(`   ${path} (${methods.join(', ').toUpperCase()})`);
        });
      } else if (paths.length > 10) {
        console.log(`   ${paths.slice(0, 5).join(', ')} ... and ${paths.length - 5} more`);
      }
      console.log('');

      // Handle schemas (OpenAPI v3) vs definitions (OpenAPI v2)
      const schemas = Object.keys((api.components as any)?.schemas || api.definitions || {});
      const schemaType = api.components?.schemas ? 'components' : 'definitions';
      console.log(`🏗️  ${schemaType.charAt(0).toUpperCase() + schemaType.slice(1)}: ${schemas.length} schemas`);
      if (schemas.length > 0 && schemas.length <= 15) {
        console.log(`   ${schemas.join(', ')}`);
      } else if (schemas.length > 15) {
        console.log(`   ${schemas.slice(0, 10).join(', ')} ... and ${schemas.length - 10} more`);
      }

    } catch (error: any) {
      console.error('\n❌ Failed to analyze specification:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log('📚 OpenAPI Generator Examples');
    console.log('=============================\n');

    console.log('🔧 Basic generation:');
    console.log('   openapi-gen generate ./api.yaml\n');

    console.log('🌐 Generate from URL:');
    console.log('   openapi-gen generate https://api.example.com/openapi.json\n');

    console.log('🔐 Generate from URL with authentication:');
    console.log('   openapi-gen generate https://api.example.com/openapi.json \\');
    console.log('     -H "Authorization: Bearer your-token" \\');
    console.log('     -H "X-API-Key: your-api-key"\n');

    console.log('🎯 Custom output directory:');
    console.log('   openapi-gen generate ./api.yaml -o ./src/api\n');

    console.log('🏷️  Custom namespace:');
    console.log('   openapi-gen generate ./api.yaml -n MyAPI\n');

    console.log('📦 Type output modes:');
    console.log('   # Single file (default):');
    console.log('   openapi-gen generate ./api.yaml\n');
    console.log('   # One file per type:');
    console.log('   openapi-gen generate ./api.yaml -t file-per-type\n');
    console.log('   # Group by tag/category:');
    console.log('   openapi-gen generate ./api.yaml -t group-by-tag\n');

    console.log('⚙️  All options:');
    console.log('   openapi-gen generate ./api.yaml \\');
    console.log('     --output ./src/generated \\');
    console.log('     --namespace GitHubAPI \\');
    console.log('     --axios-instance githubClient \\');
    console.log('     --type-output file-per-type\n');

    console.log('🔍 Dry run (preview):');
    console.log('   openapi-gen generate ./api.yaml --dry-run\n');

    console.log('📋 Spec information:');
    console.log('   openapi-gen info ./api.yaml');
    console.log('   openapi-gen info https://api.example.com/openapi.json\n');

    console.log('💡 Tips:');
    console.log('   • Supports both YAML and JSON OpenAPI specs');
    console.log('   • Works with OpenAPI 3.0+ specifications');
    console.log('   • Generates fully typed Axios clients');
    console.log('   • Supports anyOf, oneOf, allOf, discriminators');
    console.log('   • Handles nullable types and const values');
  });

// Parse command line arguments
program.parse();