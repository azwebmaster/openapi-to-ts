# OpenAPI to TypeScript

> 🚀 **Generate fully-typed TypeScript clients from OpenAPI specs in seconds**

Transform your OpenAPI 3.0+ specifications into production-ready TypeScript clients with full type safety, IntelliSense support, and zero configuration.

[![npm version](https://img.shields.io/npm/v/@azwebmaster/openapi-to-ts.svg)](https://www.npmjs.com/package/@azwebmaster/openapi-to-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **🎯 Zero Config**: Works out of the box with any OpenAPI 3.0+ or Swagger 2.0 spec
- **🔒 Type Safe**: Full TypeScript support with discriminated unions, nullable types, and schema composition
- **⚡ Fast**: Built with ts-morph for lightning-fast code generation
- **🛠️ Developer Friendly**: Rich JSDoc comments, IntelliSense, and error-free generated code
- **📦 Modern**: Uses Axios with modern TypeScript patterns and ES modules

## 🚀 Quick Start

### Installation

```bash
# For CLI usage (recommended)
npm install -g @azwebmaster/openapi-to-ts

# Or using pnpm
pnpm add -g @azwebmaster/openapi-to-ts

# For programmatic usage in your project
npm install @azwebmaster/openapi-to-ts
# or
pnpm add @azwebmaster/openapi-to-ts
```

### CLI Usage (Recommended)

The CLI is available as `openapi-to-ts` or the shorter alias `ott`:

```bash
openapi-to-ts generate ./api.yaml
# or
ott generate ./api.yaml
```

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
  spec: './api.yaml',
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
├── types.ts          # All TypeScript types (or re-exports when using file-per-type / group-by-tag)
├── types/            # Individual type files (file-per-type or group-by-tag modes only)
├── client.ts         # Axios-based API client class
├── namespaces/       # Namespace modules (when operationIds use dot notation, e.g. users.getProfile)
└── index.ts          # Exports and createClient factory
```

See the [samples directory](samples/README.md) for working examples across OpenAPI v3 and Swagger v2 specs.

### Example Generated Types

```typescript
// types.ts
export type User = {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  preferences?: UserPreferences;
};

export type CreateUserRequest = {
  email: string;
  name: string;
  password: string;
  age?: number;
};

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

export type Dog = BasePet & {
  petType: "dog";
  breed: string;
};

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

When operationIds use dot notation (e.g. `users.getProfile`, `admin.getSystemStats`), the generator creates namespace properties on the client:

```typescript
const api = createClient('https://api.example.com');

// Flat operationIds (e.g. getUsers, createUser)
await api.getUsers();
await api.createUser(data);

// Dot-separated operationIds become namespaces
await api.users.getProfile();
await api.users.updateSettings(data);
await api.admin.getSystemStats();
```

## ⚙️ Configuration File System

For complex projects or when you need to generate multiple API clients, use `.ott.json` configuration files. The CLI auto-detects `.ott.json` in the current directory — you do not need a `--config` flag unless using a custom path.

### Initialize Configuration

```bash
# Create configuration from OpenAPI spec
openapi-to-ts init ./api.yaml

# With custom output directory
openapi-to-ts init ./api.yaml -o ./src/api

# From remote URL
openapi-to-ts init https://api.example.com/openapi.json
```

### Configuration File Format

The generated `.ott.json` file contains:

```json
{
  "apis": [
    {
      "name": "My API",
      "spec": "./api.yaml",
      "output": "./generated",
      "namespace": "MyAPI",
      "axiosInstance": "apiClient",
      "typeOutput": "single-file",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      },
      "operationIds": [
        "getUsers",
        "createUser",
        "updateUser"
      ]
    }
  ]
}
```

### Configuration Commands

```bash
# List available operations from config
openapi-to-ts list

# List operations for specific API (if multiple APIs)
openapi-to-ts list --api "My API"

# Generate using configuration file (auto-detects .ott.json in cwd)
openapi-to-ts generate

# Generate specific operations from CLI
openapi-to-ts generate --operation-ids "getUsers,createUser"

# Generate a specific API when multiple are defined in config
openapi-to-ts generate --api "My API"
```

### Benefits of Configuration Files

- **Operation Filtering**: Generate only the operations you need
- **Multiple APIs**: Manage multiple OpenAPI specs in one project
- **Persistent Settings**: Save generation options for repeated use
- **Team Collaboration**: Share configuration with your team
- **CI/CD Integration**: Use config files in automated builds

## 🛠️ CLI Reference

### Commands

```bash
# Generate TypeScript client
openapi-to-ts generate <spec> [options]

# Initialize configuration file
openapi-to-ts init <spec> [options]

# List operations from config
openapi-to-ts list [options]

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
| `-c, --config <file>` | Path to configuration file | `.ott.json` in cwd |
| `--api <name>` | Generate a specific API from a multi-API config | - |
| `--operation-ids <ids>` | Comma-separated operation IDs to include | all |
| `--dry-run` | Preview generation without writing files | `false` |
| `--no-progress` | Disable progress messages | `false` |

### Init Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Default output directory for generated files | `./generated` |
| `-c, --config <file>` | Path for the configuration file to create | `.ott.json` in cwd |
| `-H, --header <header>` | Add header for URL requests (format: "Name: Value") | - |

### List Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <file>` | Path to configuration file | `.ott.json` in cwd |
| `--api <name>` | List operations for a specific API in a multi-API config | - |

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

# Generate with environment variable headers
openapi-to-ts generate https://api.example.com/openapi.json \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-API-Key: ${API_KEY:default-key}"

# Custom output directory and namespace
openapi-to-ts generate api.yaml -o ./src/api -n GitHubAPI

# Different type organization modes
openapi-to-ts generate api.yaml -t file-per-type    # One file per type
openapi-to-ts generate api.yaml -t group-by-tag     # Group by OpenAPI tags

# Preview what will be generated
openapi-to-ts generate api.yaml --dry-run

# Configuration file workflow
openapi-to-ts init api.yaml                         # Create .ott.json config
openapi-to-ts list                                  # List available operations
openapi-to-ts generate                              # Generate using auto-detected .ott.json
openapi-to-ts generate --operation-ids "getUsers,createUser"  # Generate specific operations

# Show API specification information
openapi-to-ts info api.yaml
openapi-to-ts info https://api.example.com/openapi.json

# Get help and examples
openapi-to-ts examples
openapi-to-ts --help
```

### Environment Variables in Headers

You can use environment variables in header values to keep sensitive information out of your configuration files and command history. This is especially useful for API keys, tokens, and other credentials.

#### Syntax

- `${VAR_NAME}` - Use the value of the environment variable `VAR_NAME`
- `${VAR_NAME:default_value}` - Use the environment variable `VAR_NAME`, or `default_value` if not set
- `${VAR_NAME:}` - Use the environment variable `VAR_NAME`, or empty string if not set

#### Examples

```bash
# Set environment variables
export API_TOKEN="your-secret-token"
export API_KEY="your-api-key"

# Use in CLI commands
openapi-to-ts generate https://api.example.com/openapi.json \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-API-Key: ${API_KEY}"

# With default values
openapi-to-ts generate https://api.example.com/openapi.json \
  -H "Authorization: Bearer ${API_TOKEN:guest}" \
  -H "X-API-Key: ${API_KEY:demo-key}"
```

#### Configuration Files

Environment variables also work in `.ott.json` configuration files:

```json
{
  "apis": [
    {
      "name": "MyAPI",
      "spec": "https://api.example.com/openapi.json",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}",
        "X-API-Key": "${API_KEY:default-key}",
        "X-Environment": "${ENV:development}"
      }
    }
  ]
}
```

#### Security Best Practices

- Never commit environment variables to version control
- Use `.env` files for local development (not supported by this tool, use your shell or process manager)
- Use default values for non-sensitive configuration
- Keep sensitive tokens in secure environment variable management systems

### Type Output Modes

- **`single-file`** (default): All types in one `types.ts` file
- **`file-per-type`**: Each type in its own file under `types/` directory
- **`group-by-tag`**: Types grouped by OpenAPI tags/categories

### Client Output Modes

Client output mode is configured programmatically via `clientOutputMode` (not available as a CLI flag):

- **`split-by-namespace`** (default): Groups dot-separated operationIds into namespace modules under `namespaces/`
- **`single-file`**: All client methods in a single `client.ts` file

## 🔧 Programmatic Usage

For integration into build scripts, CI/CD pipelines, or custom tooling:

```typescript
import { generateFromSpec, TypeOutputMode, ClientOutputMode } from '@azwebmaster/openapi-to-ts';

// Basic usage
await generateFromSpec({
  spec: './api.yaml',
  outputDir: './generated/api',
  namespace: 'MyAPI'
});

// Advanced usage with all options
await generateFromSpec({
  spec: 'https://api.example.com/openapi.json',
  outputDir: './src/generated',
  namespace: 'GitHubAPI',
  axiosInstanceName: 'githubClient',
  typeOutputMode: TypeOutputMode.FilePerType,
  clientOutputMode: ClientOutputMode.SplitByNamespace,
  headers: {
    'Authorization': 'Bearer ${API_TOKEN}',
    'X-API-Key': '${API_KEY:default-key}'
  },
  operationIds: ['getUsers', 'createUser', 'updateUser'],
  noProgress: true
});
```

### Generator Options

```typescript
interface GeneratorOptions {
  spec: string;                         // Path to OpenAPI spec file or URL
  outputDir: string;                    // Output directory for generated files
  namespace?: string;                   // Client namespace (default: 'API')
  axiosInstanceName?: string;           // Name for Axios instance (default: 'apiClient')
  headers?: Record<string, string>;     // HTTP headers for remote specs
  typeOutputMode?: TypeOutputMode;      // How to organize generated types
  clientOutputMode?: ClientOutputMode;  // How to organize client methods (default: split-by-namespace)
  operationIds?: string[];            // Filter specific operations to generate
  noProgress?: boolean;                 // Disable progress messages (default: false)
}

enum TypeOutputMode {
  SingleFile = 'single-file',           // All types in one file
  FilePerType = 'file-per-type',        // One file per type
  GroupByTag = 'group-by-tag'           // Group by OpenAPI tags
}

enum ClientOutputMode {
  SingleFile = 'single-file',           // All methods in one client file
  SplitByNamespace = 'split-by-namespace' // Namespace modules for dot-separated operationIds
}
```

### Build Script Integration

```typescript
// scripts/generate-api.ts
import { generateFromSpec, TypeOutputMode, ClientOutputMode } from '@azwebmaster/openapi-to-ts';

async function generateAPI() {
  try {
    await generateFromSpec({
      spec: './api/openapi.yaml',
      outputDir: './src/api/generated',
      namespace: 'MyAPI',
      typeOutputMode: TypeOutputMode.SingleFile,
      operationIds: ['getUsers', 'createUser', 'updateUser'] // Only generate specific operations
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
pnpm install

# Run tests
pnpm test

# Build the project
pnpm run build
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