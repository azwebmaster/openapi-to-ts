# @azwebmaster/openapi-to-ts

OpenAPI to TypeScript code generator with Axios

### Programmatic Usage

```typescript
import { generateFromSpec } from '@azwebmaster/openapi-to-ts';

await generateFromSpec({
  inputSpec: './specs/api.yaml',  // Path to OpenAPI spec (YAML or JSON)
  outputDir: './generated/api',    // Output directory for generated files
  namespace: 'MyAPI',              // Namespace for the client class
  axiosInstanceName: 'apiClient'   // Name for the Axios instance variable
});
```

> 🚀 **NEW**: Now includes a powerful CLI tool for easy code generation!

## Features

- ✅ **Full OpenAPI 3.0+ Support**: Comprehensive spec parsing and validation
- ✅ **Advanced Schema Features**:
  - `anyOf`, `oneOf`, `allOf` composition schemas
  - Discriminated unions with proper TypeScript narrowing
  - Nullable types (`nullable: true` and OpenAPI 3.1 `type: ["string", "null"]`)
  - Const values and literal types
  - Schema inheritance with `allOf`
  - Complex nested object types
- ✅ **TypeScript Generation**:
  - Strongly-typed interfaces from OpenAPI schemas
  - Union types with proper discriminator support
  - Intersection types for schema composition
  - Nullable and optional property handling
- ✅ **Axios Client Generation**:
  - Typed methods for each API endpoint
  - Full request/response typing
  - Path, query, and header parameter support
  - Request body typing for mutations
- ✅ **Developer Experience**:
  - JSDoc comments from OpenAPI descriptions
  - Factory function for easy client instantiation
  - Complete TypeScript IntelliSense support
- ✅ **CLI Tool**:
  - Simple command-line interface
  - Preview generation with dry-run mode
  - API information display
  - Interactive help and examples

## Installation

```bash
bun add @azwebmaster/openapi-to-ts
# or
npm install @azwebmaster/openapi-to-ts

# For global CLI usage:
npm install -g @azwebmaster/openapi-to-ts
# or
bun install -g @azwebmaster/openapi-to-ts
```

## Usage

### CLI Usage (Recommended)

Generate TypeScript clients directly from the command line:

```bash
# Basic usage
openapi-to-ts generate ./api.yaml

# Custom output directory
openapi-to-ts generate ./api.yaml -o ./src/generated

# Custom namespace and options
openapi-to-ts generate ./api.yaml \
  --output ./src/api \
  --namespace GitHubAPI \
  --axios-instance githubClient

# Preview generation (dry run)
openapi-to-ts generate ./api.yaml --dry-run

# Show API information
openapi-to-ts info ./api.yaml

# Get help and examples
openapi-to-ts --help
openapi-to-ts examples
```

### Programmatic Usage

```typescript
import { generateFromSpec } from '@azwebmaster/openapi-to-ts';

await generateFromSpec({
  inputSpec: './specs/api.yaml',  // Path to OpenAPI spec (YAML or JSON)
  outputDir: './generated/api',    // Output directory for generated files
  namespace: 'MyAPI',              // Namespace for the client class
  axiosInstanceName: 'apiClient'   // Name for the Axios instance
});
```

### Use Generated Client

```typescript
import { createClient } from './generated/api';

// Create client instance
const client = createClient('https://api.example.com', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

// Use typed methods
const response = await client.getUsers(1, 10);  // page, limit parameters
console.log(response.data.users);

// Create a user
const newUser = await client.createUser({
  email: 'user@example.com',
  name: 'John Doe'
});
```

## Examples

### CLI Examples

Generate a client from the included sample API spec:

```bash
# Using the CLI
openapi-to-ts generate specs/sample-api.yaml -o ./my-api

# Or using bun/npm scripts
cd packages/openapi
bun run cli generate specs/sample-api.yaml
```

### Advanced Features Example

To see all advanced OpenAPI features in action:

```bash
# Generate complex API with advanced features
openapi-to-ts generate specs/complex-api.yaml -o ./complex-api -n ComplexAPI

# Preview what would be generated
openapi-to-ts generate specs/complex-api.yaml --dry-run

# Show API information first
openapi-to-ts info specs/complex-api.yaml
```

This demonstrates:
- **Discriminated Unions**: Pet types with `oneOf` + discriminator
- **Union Types**: Vehicle types with `anyOf`
- **Inheritance**: Product extending BaseProduct with `allOf`
- **Nullable Types**: Optional and null values
- **Const Values**: Literal string/number types
- **Complex Nesting**: Multi-level object composition

### Generated Output

Both examples generate TypeScript files in their respective directories:
- `types.ts` - TypeScript interfaces for all schemas
- `client.ts` - Axios-based API client with typed methods
- `index.ts` - Main entry point with exports

### Usage Example

```typescript
import { createClient } from './generated/complex';
import type { Pet, Dog, Cat } from './generated/complex';

const client = createClient('https://api.example.com');

// Create pets with discriminated union types
const dog: Dog = {
  petType: "dog",  // TypeScript enforces correct discriminator
  name: "Buddy",
  breed: "Golden Retriever"
};

await client.createPet(dog);

// Get pets and handle union types
const pets = await client.getPets();
pets.data.forEach(pet => {
  switch (pet.petType) {  // TypeScript narrows the type
    case "dog":
      console.log(`Dog: ${pet.breed}`);  // pet is now typed as Dog
      break;
    case "cat":
      console.log(`Cat: ${pet.lives} lives`);  // pet is now typed as Cat
      break;
  }
});
```

## API

### `generateFromSpec(options: GeneratorOptions)`

Generates TypeScript code from an OpenAPI specification.

Options:
- `inputSpec` (string) - Path to the OpenAPI spec file (YAML or JSON)
- `outputDir` (string) - Directory where generated files will be written
- `namespace` (string, optional) - Namespace for the generated client class
- `axiosInstanceName` (string, optional) - Name for the Axios instance variable

## CLI Reference

### Commands

#### `generate <spec>`
Generate TypeScript client from OpenAPI specification.

**Arguments:**
- `<spec>` - Path to OpenAPI specification file (YAML or JSON)

**Options:**
- `-o, --output <dir>` - Output directory (default: `./generated`)
- `-n, --namespace <name>` - Client namespace (default: `API`)
- `-a, --axios-instance <name>` - Axios instance name (default: `apiClient`)
- `--dry-run` - Preview generation without writing files

**Examples:**
```bash
openapi-to-ts generate api.yaml
openapi-to-ts generate api.yaml -o ./src/api -n MyAPI
openapi-to-ts generate api.yaml --dry-run
```

#### `info <spec>`
Show information about an OpenAPI specification.

**Examples:**
```bash
openapi-to-ts info api.yaml
```

#### `examples`
Show usage examples and tips.

**Examples:**
```bash
openapi-to-ts examples
```

### Global Options
- `-V, --version` - Show version number
- `-h, --help` - Show help information

## Generated Code Structure

The generator creates three files:

1. **types.ts** - All TypeScript interfaces derived from OpenAPI schemas
2. **client.ts** - API client class with methods for each endpoint
3. **index.ts** - Exports and factory function for easy client creation

Each generated method includes:
- Full TypeScript typing for parameters and responses
- JSDoc comments from the OpenAPI spec
- Proper handling of path, query, header parameters
- Request body support for POST/PUT/PATCH methods

## Supported OpenAPI Features

### Schema Composition
- ✅ **`anyOf`** - Union types: `A | B | C`
- ✅ **`oneOf`** - Exclusive union types with discriminators
- ✅ **`allOf`** - Intersection types: `A & B & C`
- ✅ **Discriminated Unions** - Type narrowing with discriminator property
- ✅ **Discriminator Mapping** - Custom discriminator value mappings

### Type System
- ✅ **Primitive Types** - `string`, `number`, `boolean`, `integer`
- ✅ **Array Types** - `Array<T>` with typed items
- ✅ **Object Types** - Interfaces with required/optional properties
- ✅ **Enum Types** - String and numeric literal unions
- ✅ **Const Values** - Single literal values (`const: "value"`)
- ✅ **Nullable Types** - OpenAPI 3.0 `nullable: true` and 3.1 `type: ["string", "null"]`

### Advanced Features
- ✅ **Schema References** - `$ref` resolution across components
- ✅ **Inline Objects** - Anonymous object types in properties
- ✅ **Additional Properties** - `Record<string, T>` for flexible objects
- ✅ **Nested Schemas** - Complex multi-level object composition
- ✅ **Inheritance** - Interface extension with `allOf`
- ✅ **Schema Descriptions** - JSDoc comments from OpenAPI descriptions

### Endpoint Generation
- ✅ **All HTTP Methods** - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- ✅ **Path Parameters** - Template literal interpolation
- ✅ **Query Parameters** - Typed query object
- ✅ **Header Parameters** - Custom header support
- ✅ **Request Bodies** - Typed request data for mutations
- ✅ **Response Types** - Full response typing including status codes