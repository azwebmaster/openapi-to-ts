# OpenAPI v3 Simple Sample

This directory contains a simple OpenAPI v3 specification and generation scripts.

## Files

- `openapi-v3-simple.yaml` - Simple OpenAPI v3 specification with basic CRUD operations
- `generate.sh` - Unix/Linux/macOS generation script
- `generate.bat` - Windows generation script
- `generated/` - Directory for generated TypeScript files (created after running generation)

## Specification Features

- Basic CRUD operations for users
- Simple data types (string, integer, date-time)
- Basic validation (minLength, maxLength, format)
- Standard HTTP status codes
- Clean, minimal structure

## Generation

### Unix/Linux/macOS
```bash
./generate.sh
```

### Windows
```cmd
generate.bat
```

## Generated Output

The generation script will create:
- `types.ts` - TypeScript interfaces and types
- `client.ts` - Axios-based API client class
- `index.ts` - Exports and factory function

## Usage Example

```typescript
import { createSimpleAPIClient } from './generated';

const client = createSimpleAPIClient({
  baseURL: 'https://api.example.com/v1'
});

// Get all users
const users = await client.getUsers({ limit: 10 });

// Create a new user
const newUser = await client.createUser({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});
```
