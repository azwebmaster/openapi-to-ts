# Swagger v2 Simple Sample

This directory contains a simple Swagger v2 specification and generation scripts.

## Files

- `swagger-2.0-test.json` - Simple Swagger v2 specification with basic operations
- `generate.sh` - Unix/Linux/macOS generation script
- `generate.bat` - Windows generation script
- `generated/` - Directory for generated TypeScript files (created after running generation)

## Specification Features

- Basic CRUD operations for users
- Simple data types (string, integer, date-time)
- Basic validation (minLength, maxLength, format)
- Standard HTTP status codes
- Swagger 2.0 format with definitions
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
import { createSwaggerSimpleAPIClient } from './generated';

const client = createSwaggerSimpleAPIClient({
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

// Get user by ID
const user = await client.getUserById('user-uuid-here');

// Update user
const updatedUser = await client.updateUser('user-uuid-here', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});

// Delete user
await client.deleteUser('user-uuid-here');
```
