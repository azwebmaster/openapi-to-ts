# OpenAPI to TypeScript

> 🚀 **Generate fully-typed TypeScript clients from OpenAPI specs in seconds**

Transform your OpenAPI 3.0+ specifications into production-ready TypeScript clients with full type safety, IntelliSense support, and zero configuration.

[![npm version](https://img.shields.io/npm/v/@azwebmaster/openapi-to-ts.svg)](https://www.npmjs.com/package/@azwebmaster/openapi-to-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Why This Generator?

- **🎯 Zero Config**: Works out of the box with any OpenAPI 3.0+ spec
- **🔒 Type Safe**: Full TypeScript support with discriminated unions, nullable types, and schema composition
- **⚡ Fast**: Built with ts-morph for lightning-fast code generation
- **🛠️ Developer Friendly**: Rich JSDoc comments, IntelliSense, and error-free generated code
- **📦 Modern**: Uses Axios with modern TypeScript patterns and ES modules

## 🚀 Quick Start

### Install

```bash
# For CLI usage (recommended)
npm install -g @azwebmaster/openapi-to-ts

# Or using bun
bun install -g @azwebmaster/openapi-to-ts

# For programmatic usage in your project
npm install @azwebmaster/openapi-to-ts
# or
bun add @azwebmaster/openapi-to-ts
```

### CLI Usage (Recommended)

The CLI is the easiest way to generate TypeScript clients:

```bash
# Basic generation
openapi-to-ts generate ./api.yaml

# Generate from URL
openapi-to-ts generate https://api.example.com/openapi.json

# With custom options
openapi-to-ts generate ./api.yaml \
  --output ./src/api \
  --namespace MyAPI \
  --type-output file-per-type

# Preview what will be generated (dry run)
openapi-to-ts generate ./api.yaml --dry-run

# Show API information
openapi-to-ts info ./api.yaml
```

### Programmatic Usage

For integration into build scripts or custom tooling:

```typescript
import { generateFromSpec } from '@azwebmaster/openapi-to-ts';

await generateFromSpec({
  inputSpec: './api.yaml',
  outputDir: './generated/api',
  namespace: 'MyAPI',
  typeOutputMode: 'single-file'
});
```

### Use Your Generated Client

```typescript
import { createClient } from './generated/api';

const api = createClient('https://api.example.com', {
  headers: { Authorization: 'Bearer YOUR_TOKEN' }
});

// Fully typed with IntelliSense! 🎉
const users = await api.getUsers({ page: 1, limit: 10 });
const newUser = await api.createUser({
  email: 'user@example.com',
  name: 'John Doe'
});
```

## 📖 What You Get

### Generated Files

```
generated/
├── types.ts      # All TypeScript interfaces
├── client.ts     # Axios-based API client
└── index.ts      # Exports and factory function
```

### Example Generated Types

```typescript
// types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  preferences?: UserPreferences;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  age?: number;
}
```

### Example Generated Client

```typescript
// client.ts
export class MyAPIClient {
  constructor(baseURL: string, config?: AxiosRequestConfig) {
    this.client = axios.create({ baseURL, ...config });
  }

  async getUsers(params?: GetUsersParams): Promise<AxiosResponse<User[]>> {
    return this.client.get('/users', { params });
  }

  async createUser(data: CreateUserRequest): Promise<AxiosResponse<User>> {
    return this.client.post('/users', data);
  }
}
```

## 🎯 Advanced Features

### Schema Composition Support

```yaml
# OpenAPI spec
components:
  schemas:
    Pet:
      oneOf:
        - $ref: '#/components/schemas/Dog'
        - $ref: '#/components/schemas/Cat'
      discriminator:
        propertyName: petType
    Dog:
      allOf:
        - $ref: '#/components/schemas/BasePet'
        - type: object
          properties:
            breed: { type: string }
```

```typescript
// Generated TypeScript
export type Pet = Dog | Cat;

export interface Dog extends BasePet {
  petType: "dog";
  breed: string;
}

// TypeScript narrows the type automatically! 🎉
pets.forEach(pet => {
  if (pet.petType === "dog") {
    console.log(pet.breed); // TypeScript knows this is a Dog
  }
});
```

### Nullable Types & Union Types

```typescript
// OpenAPI 3.0 nullable
avatar?: string | null;

// OpenAPI 3.1 type arrays
status: "active" | "inactive" | "pending";

// Complex unions with anyOf
vehicle: Car | Truck | Motorcycle;
```

### Namespace Organization

```typescript
// Organized by operationId namespaces
const api = createClient('https://api.example.com');

// Direct methods
await api.getUsers();
await api.createUser(data);

// Namespaced methods
await api.users.getProfile();
await api.users.updateSettings(data);
await api.admin.getSystemStats();
```

## 🛠️ CLI Reference

### Commands

```bash
# Generate TypeScript client
openapi-to-ts generate <spec> [options]

# Show API specification info
openapi-to-ts info <spec>

# Show usage examples and tips
openapi-to-ts examples
```

### Generate Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory for generated files | `./generated` |
| `-n, --namespace <name>` | Namespace for the generated client class | `API` |
| `-a, --axios-instance <name>` | Name for the Axios instance variable | `apiClient` |
| `-t, --type-output <mode>` | Type organization: `single-file`, `file-per-type`, `group-by-tag` | `single-file` |
| `-H, --header <header>` | Add header for URL requests (format: "Name: Value") | - |
| `--dry-run` | Preview generation without writing files | `false` |

### CLI Examples

```bash
# Basic generation from local file
openapi-to-ts generate api.yaml

# Generate from remote URL
openapi-to-ts generate https://api.example.com/openapi.json

# Generate with authentication headers
openapi-to-ts generate https://api.example.com/openapi.json \
  -H "Authorization: Bearer your-token" \
  -H "X-API-Key: your-api-key"

# Custom output directory and namespace
openapi-to-ts generate api.yaml -o ./src/api -n GitHubAPI

# Different type organization modes
openapi-to-ts generate api.yaml -t file-per-type    # One file per type
openapi-to-ts generate api.yaml -t group-by-tag     # Group by OpenAPI tags

# Preview what will be generated
openapi-to-ts generate api.yaml --dry-run

# Show API specification information
openapi-to-ts info api.yaml
openapi-to-ts info https://api.example.com/openapi.json

# Get help and examples
openapi-to-ts examples
openapi-to-ts --help
```

### Type Output Modes

- **`single-file`** (default): All types in one `types.ts` file
- **`file-per-type`**: Each type in its own file under `types/` directory
- **`group-by-tag`**: Types grouped by OpenAPI tags/categories

## 🔧 Programmatic Usage

For integration into build scripts, CI/CD pipelines, or custom tooling:

```typescript
import { generateFromSpec, TypeOutputMode } from '@azwebmaster/openapi-to-ts';

// Basic usage
await generateFromSpec({
  inputSpec: './api.yaml',
  outputDir: './generated/api',
  namespace: 'MyAPI'
});

// Advanced usage with all options
await generateFromSpec({
  inputSpec: 'https://api.example.com/openapi.json',
  outputDir: './src/generated',
  namespace: 'GitHubAPI',
  typeOutputMode: TypeOutputMode.FilePerType,
  headers: {
    'Authorization': 'Bearer your-token',
    'X-API-Key': 'your-api-key'
  }
});
```

### Generator Options

```typescript
interface GeneratorOptions {
  inputSpec: string;                    // Path to OpenAPI spec file or URL
  outputDir: string;                    // Output directory for generated files
  namespace?: string;                   // Client namespace (default: 'API')
  headers?: Record<string, string>;     // HTTP headers for remote specs
  typeOutputMode?: TypeOutputMode;      // How to organize generated types
}

enum TypeOutputMode {
  SingleFile = 'single-file',           // All types in one file
  FilePerType = 'file-per-type',        // One file per type
  GroupByTag = 'group-by-tag'           // Group by OpenAPI tags
}
```

### Build Script Integration

```typescript
// scripts/generate-api.ts
import { generateFromSpec } from '@azwebmaster/openapi-to-ts';

async function generateAPI() {
  try {
    await generateFromSpec({
      inputSpec: './api/openapi.yaml',
      outputDir: './src/api/generated',
      namespace: 'MyAPI',
      typeOutputMode: 'single-file'
    });
    console.log('✅ API client generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate API client:', error);
    process.exit(1);
  }
}

generateAPI();
```

```json
// package.json
{
  "scripts": {
    "generate:api": "tsx scripts/generate-api.ts",
    "build": "npm run generate:api && tsc"
  }
}
```

## 🎨 Supported OpenAPI Features

### ✅ Schema Features
- **Composition**: `anyOf`, `oneOf`, `allOf`
- **Discriminated Unions**: With proper TypeScript narrowing
- **Nullable Types**: OpenAPI 3.0 `nullable` and 3.1 `type` arrays
- **Const Values**: Literal types
- **Enums**: String and numeric unions
- **Inheritance**: Schema extension with `allOf`

### ✅ Type System
- **Primitives**: `string`, `number`, `boolean`, `integer`
- **Arrays**: `Array<T>` with typed items
- **Objects**: Interfaces with required/optional properties
- **References**: `$ref` resolution across components
- **Additional Properties**: `Record<string, T>`

### ✅ API Features
- **All HTTP Methods**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Parameters**: Path, query, header parameters
- **Request Bodies**: Typed request data
- **Responses**: Full response typing
- **Authentication**: Header-based auth support

## 🎯 Real-World Example

Let's generate a client for a user management API:

```bash
# Generate the client
openapi-to-ts generate user-api.yaml -o ./src/api -n UserAPI
```

```typescript
// Use the generated client
import { createClient } from './src/api';

const userAPI = createClient('https://api.myapp.com', {
  headers: { Authorization: `Bearer ${token}` }
});

// Get users with pagination
const { data } = await userAPI.getUsers({
  page: 1,
  limit: 20,
  sort: 'created_at',
  order: 'desc'
});

// Create a new user
const newUser = await userAPI.createUser({
  email: 'john@example.com',
  name: 'John Doe',
  password: 'secure123',
  preferences: {
    theme: 'dark',
    notifications: { email: true, push: false }
  }
});

// Update user with partial data
await userAPI.patchUser({
  name: 'John Smith',
  preferences: { theme: 'light' }
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/azwebmaster/openapi-to-ts.git
cd openapi-to-ts

# Install dependencies
bun install

# Run tests
bun test

# Build the project
bun run build
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [ts-morph](https://ts-morph.com/) for powerful TypeScript manipulation
- Uses [@apidevtools/swagger-parser](https://github.com/APIDevTools/swagger-parser) for OpenAPI parsing
- Inspired by the TypeScript community's need for better API client generation

---

**Made with ❤️ for the TypeScript community**

[Report an issue](https://github.com/azwebmaster/openapi-to-ts/issues) • [Request a feature](https://github.com/azwebmaster/openapi-to-ts/issues) • [View on GitHub](https://github.com/azwebmaster/openapi-to-ts)