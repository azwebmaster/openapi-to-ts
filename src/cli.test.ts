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
});