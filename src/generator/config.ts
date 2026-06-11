import * as fs from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OTTConfig, resolveHeadersEnvironmentVariables } from '../types.js';

export class ConfigManager {
  static async loadConfig(configPath: string = '.ott.json'): Promise<OTTConfig | null> {
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

  static async saveConfig(config: OTTConfig, configPath: string = '.ott.json'): Promise<void> {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  static async generateConfigFromSpec(
    spec: string, 
    outputDir: string = './generated',
    configPath: string = '.ott.json',
    headers?: Record<string, string>,
    fetchFromUrl?: (url: string, headers?: Record<string, string>) => Promise<object>
  ): Promise<OTTConfig> {
    // Resolve environment variables in headers
    const resolvedHeaders = headers ? resolveHeadersEnvironmentVariables(headers) : undefined;
    
    let specInput: string | object = spec;

    // If spec is a URL, fetch it
    if (spec.startsWith('http://') || spec.startsWith('https://')) {
      if (fetchFromUrl) {
        specInput = await fetchFromUrl(spec, resolvedHeaders);
      } else {
        // For config generation without fetch function, just store the URL
        specInput = spec;
      }
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

  static async loadOrGenerateConfig(
    spec: string,
    outputDir: string = './generated',
    configPath: string = '.ott.json',
    headers?: Record<string, string>,
    fetchFromUrl?: (url: string, headers?: Record<string, string>) => Promise<object>
  ): Promise<OTTConfig> {
    // Try to load existing config
    let config = await this.loadConfig(configPath);
    
    if (!config) {
      // Generate new config if none exists
      config = await this.generateConfigFromSpec(spec, outputDir, configPath, headers, fetchFromUrl);
    }
    
    return config;
  }
}

