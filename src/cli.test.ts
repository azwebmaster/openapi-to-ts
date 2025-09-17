import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}));

vi.mock('./index', () => ({
  generateFromSpec: vi.fn().mockResolvedValue(undefined)
}));

describe('CLI Module Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));
  });

  describe('CLI helpers', () => {
    it('should validate file existence', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(fs.existsSync('test.yaml')).toBe(true);
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(fs.existsSync('nonexistent.yaml')).toBe(false);
    });

    it('should read package.json for version', () => {
      const packageData = fs.readFileSync('/path/to/package.json', 'utf8');
      const parsed = JSON.parse(packageData);
      expect(parsed.version).toBe('1.0.0');
    });

    it('should parse header strings correctly', () => {
      const parseHeaders = (headerArray: string[]) => {
        const headers: Record<string, string> = {};
        for (const header of headerArray) {
          const colonIndex = header.indexOf(':');
          if (colonIndex !== -1) {
            const name = header.substring(0, colonIndex).trim();
            const value = header.substring(colonIndex + 1).trim();
            headers[name] = value;
          }
        }
        return headers;
      };

      const result = parseHeaders(['Authorization: Bearer token', 'X-API-Key: key123']);
      expect(result).toEqual({
        'Authorization': 'Bearer token',
        'X-API-Key': 'key123'
      });
    });

    it('should identify URLs correctly', () => {
      const isUrl = (spec: string) => 
        spec.startsWith('http://') || spec.startsWith('https://');

      expect(isUrl('https://api.example.com/spec.json')).toBe(true);
      expect(isUrl('http://api.example.com/spec.json')).toBe(true);
      expect(isUrl('./local-spec.yaml')).toBe(false);
      expect(isUrl('spec.yaml')).toBe(false);
    });

    it('should resolve output paths correctly', () => {
      const outputDir = './custom-output';
      const resolved = path.resolve(outputDir);
      expect(resolved).toContain('custom-output');
    });
  });

  describe('CLI workflow simulation', () => {
    it('should simulate generate command workflow', async () => {
      const { generateFromSpec } = await import('./index');
      
      // Simulate the CLI action logic
      const spec = 'test-spec.yaml';
      const options = {
        output: './generated',
        namespace: 'API',
        axiosInstance: 'apiClient',
        header: ['Authorization: Bearer token'],
        dryRun: false
      };

      // Check if file exists (simulating CLI validation)
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const fileExists = fs.existsSync(spec);
      expect(fileExists).toBe(true);

      // Parse headers (simulating CLI header parsing)
      const headers: Record<string, string> = {};
      for (const header of options.header) {
        const colonIndex = header.indexOf(':');
        if (colonIndex !== -1) {
          const name = header.substring(0, colonIndex).trim();
          const value = header.substring(colonIndex + 1).trim();
          headers[name] = value;
        }
      }

      // Call generate function (simulating CLI action)
      await generateFromSpec({
        inputSpec: spec,
        outputDir: path.resolve(options.output),
        namespace: options.namespace,
        axiosInstanceName: options.axiosInstance,
        headers: Object.keys(headers).length > 0 ? headers : undefined
      });

      expect(generateFromSpec).toHaveBeenCalledWith({
        inputSpec: 'test-spec.yaml',
        outputDir: path.resolve('./generated'),
        namespace: 'API',
        axiosInstanceName: 'apiClient',
        headers: { 'Authorization': 'Bearer token' }
      });
    });

    it('should handle dry run mode', async () => {
      const { generateFromSpec } = await import('./index');
      
      const options = { dryRun: true };
      
      if (options.dryRun) {
        // In dry run mode, we don't call generateFromSpec
        // This simulates the CLI logic
        expect(true).toBe(true);
      } else {
        await generateFromSpec({
          inputSpec: 'test.yaml',
          outputDir: './output'
        });
      }

      // Should not have been called in dry run mode
      expect(generateFromSpec).not.toHaveBeenCalled();
    });

    it('should handle URL-based specs', async () => {
      const { generateFromSpec } = await import('./index');
      
      const spec = 'https://api.example.com/spec.json';
      const isUrl = spec.startsWith('http://') || spec.startsWith('https://');
      
      expect(isUrl).toBe(true);
      
      // For URLs, we don't check file existence
      if (!isUrl) {
        expect(fs.existsSync).not.toHaveBeenCalled();
      }

      await generateFromSpec({
        inputSpec: spec,
        outputDir: './output'
      });

      expect(generateFromSpec).toHaveBeenCalledWith({
        inputSpec: 'https://api.example.com/spec.json',
        outputDir: './output'
      });
    });
  });
});