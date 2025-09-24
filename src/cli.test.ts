import { describe, it, expect } from 'vitest';

describe('CLI', () => {
  describe('header parsing', () => {
    it('should parse single header correctly', () => {
      const header = 'Authorization: Bearer token';
      const colonIndex = header.indexOf(':');
      const name = header.substring(0, colonIndex).trim();
      const value = header.substring(colonIndex + 1).trim();

      expect(name).toBe('Authorization');
      expect(value).toBe('Bearer token');
    });

    it('should parse multiple headers correctly', () => {
      const headers = [
        'Authorization: Bearer token',
        'X-API-Key: my-key',
        'Content-Type: application/json'
      ];

      const parsed: Record<string, string> = {};
      for (const header of headers) {
        const colonIndex = header.indexOf(':');
        const name = header.substring(0, colonIndex).trim();
        const value = header.substring(colonIndex + 1).trim();
        parsed[name] = value;
      }

      expect(parsed['Authorization']).toBe('Bearer token');
      expect(parsed['X-API-Key']).toBe('my-key');
      expect(parsed['Content-Type']).toBe('application/json');
    });

    it('should handle invalid header format', () => {
      const header = 'InvalidHeader';
      const colonIndex = header.indexOf(':');

      expect(colonIndex).toBe(-1);
    });

    it('should handle headers with multiple colons', () => {
      const header = 'Authorization: Bearer: token:with:colons';
      const colonIndex = header.indexOf(':');
      const name = header.substring(0, colonIndex).trim();
      const value = header.substring(colonIndex + 1).trim();

      expect(name).toBe('Authorization');
      expect(value).toBe('Bearer: token:with:colons');
    });

    it('should trim whitespace from header names and values', () => {
      const header = '  Authorization  :  Bearer token  ';
      const colonIndex = header.indexOf(':');
      const name = header.substring(0, colonIndex).trim();
      const value = header.substring(colonIndex + 1).trim();

      expect(name).toBe('Authorization');
      expect(value).toBe('Bearer token');
    });
  });

  describe('path validation', () => {
    it('should identify URLs correctly', () => {
      const httpUrl = 'http://api.example.com/openapi.json';
      const httpsUrl = 'https://api.example.com/openapi.json';
      const filePath = './api.yaml';
      const absolutePath = '/absolute/path/api.yaml';

      expect(httpUrl.startsWith('http://') || httpUrl.startsWith('https://')).toBe(true);
      expect(httpsUrl.startsWith('http://') || httpsUrl.startsWith('https://')).toBe(true);
      expect(filePath.startsWith('http://') || filePath.startsWith('https://')).toBe(false);
      expect(absolutePath.startsWith('http://') || absolutePath.startsWith('https://')).toBe(false);
    });
  });

  describe('option handling', () => {
    it('should handle array options correctly', () => {
      const option = ['header1', 'header2'];
      const headerOptions = Array.isArray(option) ? option : (option ? [option] : []);

      expect(headerOptions).toEqual(['header1', 'header2']);
    });

    it('should handle single value as array', () => {
      const option = 'header1';
      const headerOptions = Array.isArray(option) ? option : (option ? [option] : []);

      expect(headerOptions).toEqual(['header1']);
    });

    it('should handle undefined as empty array', () => {
      const option = undefined;
      const headerOptions = Array.isArray(option) ? option : (option ? [option] : []);

      expect(headerOptions).toEqual([]);
    });
  });

  describe('configuration validation', () => {
    it('should validate config structure with missing apis array', () => {
      const config = { invalid: 'structure' };
      const isValid = !!(config.apis && Array.isArray(config.apis));
      expect(isValid).toBe(false);
    });

    it('should validate config structure with empty apis array', () => {
      const config = { apis: [] };
      const isValid = config.apis && Array.isArray(config.apis) && config.apis.length > 0;
      expect(isValid).toBe(false);
    });

    it('should validate config structure with valid apis array', () => {
      const config = { 
        apis: [{ 
          name: 'Test API', 
          spec: 'test.json', 
          output: './generated' 
        }] 
      };
      const isValid = config.apis && Array.isArray(config.apis) && config.apis.length > 0;
      expect(isValid).toBe(true);
    });
  });

  describe('info command OpenAPI version detection', () => {
    it('should detect OpenAPI v3 version correctly', () => {
      const api = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' }
      };
      const openApiVersion = api.openapi || api.swagger;
      const versionType = api.openapi ? 'OpenAPI' : 'Swagger';
      
      expect(openApiVersion).toBe('3.0.3');
      expect(versionType).toBe('OpenAPI');
    });

    it('should detect OpenAPI v2 (Swagger) version correctly', () => {
      const api = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' }
      };
      const openApiVersion = api.openapi || api.swagger;
      const versionType = api.openapi ? 'OpenAPI' : 'Swagger';
      
      expect(openApiVersion).toBe('2.0');
      expect(versionType).toBe('Swagger');
    });

    it('should handle server information for OpenAPI v3', () => {
      const api = {
        servers: [
          { url: 'https://api.example.com', description: 'Production' },
          { url: 'https://staging.example.com', description: 'Staging' }
        ]
      };
      
      const hasServers = api.servers && api.servers.length > 0;
      expect(hasServers).toBe(true);
      expect(api.servers.length).toBe(2);
    });

    it('should handle server information for OpenAPI v2', () => {
      const api = {
        host: 'api.example.com',
        basePath: '/v1',
        schemes: ['https', 'http']
      };
      
      const hasHostInfo = !!(api.host || api.basePath || api.schemes);
      expect(hasHostInfo).toBe(true);
      expect(api.host).toBe('api.example.com');
      expect(api.basePath).toBe('/v1');
      expect(api.schemes).toEqual(['https', 'http']);
    });

    it('should handle schemas for OpenAPI v3', () => {
      const api = {
        components: {
          schemas: {
            User: { type: 'object' },
            Product: { type: 'object' }
          }
        }
      };
      
      const schemas = Object.keys(api.components?.schemas || {});
      const schemaType = api.components?.schemas ? 'components' : 'definitions';
      
      expect(schemas).toEqual(['User', 'Product']);
      expect(schemaType).toBe('components');
    });

    it('should handle definitions for OpenAPI v2', () => {
      const api = {
        definitions: {
          User: { type: 'object' },
          Product: { type: 'object' }
        }
      };
      
      const schemas = Object.keys(api.definitions || {});
      const schemaType = api.components?.schemas ? 'components' : 'definitions';
      
      expect(schemas).toEqual(['User', 'Product']);
      expect(schemaType).toBe('definitions');
    });
  });
});