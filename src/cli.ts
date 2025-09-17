#!/usr/bin/env node

import { Command } from 'commander';
import { generateFromSpec, TypeOutputMode } from './index.js';
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
  .command('generate')
  .description('Generate TypeScript client from OpenAPI spec')
  .argument('<spec>', 'Path to OpenAPI specification file (YAML or JSON) or URL')
  .option('-o, --output <dir>', 'Output directory for generated files', './generated')
  .option('-n, --namespace <name>', 'Namespace for the generated client', 'API')
  .option('-a, --axios-instance <name>', 'Name for the Axios instance', 'apiClient')
  .option('-t, --type-output <mode>', 'Type output mode: single-file, file-per-type, or group-by-tag', 'single-file')
  .option('-H, --header <header>', 'Add header for URL requests (format: "Name: Value")', [])
  .option('--dry-run', 'Show what would be generated without writing files')
  .action(async (spec: string, options) => {
    try {
      console.log('🚀 OpenAPI TypeScript Generator');
      console.log('================================\n');

      // Check if spec is a URL or file path
      const isUrl = spec.startsWith('http://') || spec.startsWith('https://');

      if (!isUrl) {
        // Validate input file exists
        if (!fs.existsSync(spec)) {
          console.error(`❌ Error: OpenAPI spec file not found: ${spec}`);
          process.exit(1);
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
      const typeOutputMode = typeOutputModeMap[options.typeOutput];

      // Get absolute paths
      const inputSpec = isUrl ? spec : path.resolve(spec);
      const outputDir = path.resolve(options.output);

      console.log(`📄 Input spec: ${inputSpec}`);
      if (isUrl && Object.keys(headers).length > 0) {
        console.log(`🔑 Headers: ${Object.keys(headers).join(', ')} (${Object.keys(headers).length} header(s))`);
      }
      console.log(`📁 Output directory: ${outputDir}`);
      console.log(`🏷️  Namespace: ${options.namespace}`);
      console.log(`⚙️  Axios instance: ${options.axiosInstance}`);
      console.log(`📦 Type output mode: ${options.typeOutput}\n`);

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no files will be written\n');
        console.log('Would generate:');

        switch (options.typeOutput) {
          case 'file-per-type':
            console.log(`  ${outputDir}/types.ts - Re-exports all types`);
            console.log(`  ${outputDir}/types/*.ts - Individual type files`);
            break;
          case 'group-by-tag':
            console.log(`  ${outputDir}/types.ts - Re-exports all types`);
            console.log(`  ${outputDir}/types/*.ts - Types grouped by tag/category`);
            break;
          default:
            console.log(`  ${outputDir}/types.ts - All TypeScript interfaces`);
            break;
        }

        console.log(`  ${outputDir}/client.ts - Axios client class`);
        console.log(`  ${outputDir}/index.ts - Exports and factory function`);
        return;
      }

      // Generate the client
      await generateFromSpec({
        inputSpec,
        outputDir,
        namespace: options.namespace,
        axiosInstanceName: options.axiosInstance,
        typeOutputMode,
        headers: Object.keys(headers).length > 0 ? headers : undefined
      });

      console.log('✅ Generation completed successfully!\n');
      console.log('Generated files:');

      switch (options.typeOutput) {
        case 'file-per-type':
          console.log(`  📄 ${path.relative(process.cwd(), outputDir)}/types.ts (re-exports)`);
          console.log(`  📁 ${path.relative(process.cwd(), outputDir)}/types/*.ts (individual type files)`);
          break;
        case 'group-by-tag':
          console.log(`  📄 ${path.relative(process.cwd(), outputDir)}/types.ts (re-exports)`);
          console.log(`  📁 ${path.relative(process.cwd(), outputDir)}/types/*.ts (grouped type files)`);
          break;
        default:
          console.log(`  📄 ${path.relative(process.cwd(), outputDir)}/types.ts`);
          break;
      }

      console.log(`  📄 ${path.relative(process.cwd(), outputDir)}/client.ts`);
      console.log(`  📄 ${path.relative(process.cwd(), outputDir)}/index.ts\n`);

      console.log('Usage:');
      console.log('```typescript');
      console.log(`import { createClient } from '${path.relative(process.cwd(), outputDir)}';`);
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
        const generator = new OpenAPIGenerator({ inputSpec: spec, outputDir: '', headers });
        const generatorInstance = generator as any;
        specInput = await generatorInstance.fetchFromUrl(spec, headers);
      }

      const api = await SwaggerParser.parse(specInput as any) as any;

      console.log('📋 OpenAPI Specification Info');
      console.log('=============================\n');

      console.log(`📄 Title: ${api.info.title}`);
      console.log(`🔢 Version: ${api.info.version}`);
      console.log(`📝 Description: ${api.info.description || 'None'}`);
      console.log(`🌐 OpenAPI Version: ${api.openapi}\n`);

      if (api.servers && api.servers.length > 0) {
        console.log('🖥️  Servers:');
        api.servers.forEach((server: any, index: number) => {
          console.log(`   ${index + 1}. ${server.url}${server.description ? ` - ${server.description}` : ''}`);
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

      const schemas = Object.keys((api.components as any)?.schemas || {});
      console.log(`🏗️  Schemas: ${schemas.length} components`);
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