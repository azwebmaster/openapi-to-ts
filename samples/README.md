# OpenAPI to TypeScript Samples

This directory contains comprehensive samples for both OpenAPI v3 and Swagger v2 (OpenAPI v2) specifications, demonstrating different complexity levels and use cases.

## Directory Structure

```
samples/
├── openapi-v3-simple/          # Simple OpenAPI v3 specification
├── openapi-v3-medium/          # Medium complexity OpenAPI v3 specification
├── openapi-v3-comprehensive/   # Comprehensive OpenAPI v3 specification
├── swagger-v2-simple/          # Simple Swagger v2 specification
├── swagger-v2-medium/          # Medium complexity Swagger v2 specification
└── generated/                  # Legacy generated output (from old structure)
```

## Sample Categories

### OpenAPI v3 Samples

#### 1. Simple (`openapi-v3-simple/`)
- **Purpose**: Basic CRUD operations demonstration
- **Features**: Users resource, simple validation, standard HTTP methods
- **Output Mode**: `single-file`
- **Best for**: Learning the basics, simple APIs

#### 2. Medium (`openapi-v3-medium/`)
- **Purpose**: Real-world API complexity
- **Features**: Multiple resources, authentication, file uploads, pagination, search
- **Output Mode**: `file-per-type`
- **Best for**: Production APIs, team development

#### 3. Comprehensive (`openapi-v3-comprehensive/`)
- **Purpose**: Full feature demonstration
- **Features**: All OpenAPI v3 features, complex schemas, polymorphic responses, webhooks
- **Output Mode**: `group-by-tag`
- **Best for**: Complex enterprise APIs, testing all generator features

### Swagger v2 Samples

#### 1. Simple (`swagger-v2-simple/`)
- **Purpose**: Basic Swagger v2 operations
- **Features**: Users resource, simple validation, standard HTTP methods
- **Output Mode**: `single-file`
- **Best for**: Legacy API migration, simple Swagger v2 APIs

#### 2. Medium (`swagger-v2-medium/`)
- **Purpose**: Real-world Swagger v2 complexity
- **Features**: Multiple resources, authentication, file uploads, pagination, search
- **Output Mode**: `file-per-type`
- **Best for**: Production Swagger v2 APIs, team development

## Quick Start

1. **Choose a sample** based on your needs
2. **Navigate to the directory**:
   ```bash
   cd samples/openapi-v3-simple  # or your chosen sample
   ```
3. **Run the generation script**:
   ```bash
   # Unix/Linux/macOS
   ./generate.sh
   
   # Windows
   generate.bat
   ```
4. **Check the generated files** in the `generated/` directory

## Generation Scripts

Each sample directory contains:
- **`generate.sh`** - Unix/Linux/macOS generation script
- **`generate.bat`** - Windows generation script
- **`README.md`** - Detailed documentation for that sample

### Script Features

- **Automatic path resolution** - Works from any location
- **Error checking** - Validates spec files exist
- **Cross-platform** - Both Unix and Windows support
- **Configurable output** - Different output modes for different use cases
- **Clear feedback** - Shows progress and results

## Output Modes

### Single File (`single-file`)
- All types in one `types.ts` file
- Best for simple APIs
- Easier to navigate for small projects

### File Per Type (`file-per-type`)
- Each schema gets its own TypeScript file
- Best for medium complexity APIs
- Better for team development and code organization

### Group By Tag (`group-by-tag`)
- Types grouped by API tags
- Best for complex APIs with many resources
- Mirrors API organization structure

## Usage Examples

### Basic Usage
```typescript
import { createAPIClient } from './generated';

const client = createAPIClient({
  baseURL: 'https://api.example.com/v1'
});

const users = await client.getUsers();
```

### With Authentication
```typescript
const client = createAPIClient({
  baseURL: 'https://api.example.com/v1',
  headers: {
    'Authorization': 'Bearer your-token',
    'X-API-Key': 'your-api-key'
  }
});
```

### File Upload
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('description', 'Upload description');

const result = await client.uploadFile(formData);
```

## Testing the Generator

These samples are perfect for:
- **Testing new features** - Use comprehensive sample
- **Performance testing** - Use medium complexity samples
- **Regression testing** - Use simple samples for quick validation
- **Documentation examples** - All samples have detailed READMEs
- **CI/CD integration** - Scripts can be run in automated environments

## Contributing

When adding new samples:
1. Create a new directory with descriptive name
2. Add the OpenAPI/Swagger specification file
3. Create both `generate.sh` and `generate.bat` scripts
4. Add a comprehensive `README.md`
5. Test the generation scripts work correctly
6. Update this main README with the new sample

## Troubleshooting

### Common Issues

1. **Script not executable** (Unix/Linux/macOS):
   ```bash
   chmod +x generate.sh
   ```

2. **Spec file not found**:
   - Ensure you're running the script from the correct directory
   - Check the spec file name matches the script

3. **Generation fails**:
   - Check the OpenAPI/Swagger spec is valid
   - Ensure the project is built (`npm run build` or `bun run build`)
   - Check Node.js/npm is available

4. **Windows script issues**:
   - Ensure you're using Command Prompt or PowerShell
   - Check the script file has `.bat` extension
