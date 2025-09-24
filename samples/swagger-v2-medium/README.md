# Swagger v2 Medium Sample

This directory contains a medium complexity Swagger v2 specification and generation scripts.

## Files

- `swagger-v2-medium.json` - Medium complexity Swagger v2 specification
- `generate.sh` - Unix/Linux/macOS generation script
- `generate.bat` - Windows generation script
- `generated/` - Directory for generated TypeScript files (created after running generation)

## Specification Features

- Multiple resource types (Users, Products, Search, Health)
- Authentication (Bearer token and API key)
- File upload capabilities
- Complex query parameters and filtering
- Pagination support
- Nested objects and arrays
- Advanced validation rules
- Multiple response types
- Error handling
- Swagger 2.0 format with comprehensive definitions

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

The generation script uses `file-per-type` mode, creating:
- `types/` - Directory with individual TypeScript files for each schema
- `client.ts` - Axios-based API client class
- `index.ts` - Exports and factory function

## Usage Example

```typescript
import { createSwaggerMediumAPIClient } from './generated';

const client = createSwaggerMediumAPIClient({
  baseURL: 'https://api.example.com/v1',
  headers: {
    'Authorization': 'Bearer your-token-here',
    'X-API-Key': 'your-api-key'
  }
});

// Get users with filtering
const users = await client.getUsers({
  page: 1,
  limit: 20,
  search: 'john',
  role: 'user'
});

// Create a new user
const newUser = await client.createUser({
  email: 'john@example.com',
  name: 'John Doe',
  password: 'securepassword123',
  role: 'user',
  preferences: {
    theme: 'dark',
    language: 'en',
    notifications: {
      email: true,
      push: false
    }
  }
});

// Upload user avatar (Swagger v2 file upload)
const formData = new FormData();
formData.append('file', avatarFile);
formData.append('description', 'Profile picture');

const fileInfo = await client.uploadUserAvatar('user-id', formData);

// Search across content
const searchResults = await client.searchContent({
  q: 'laptop',
  type: ['products'],
  limit: 10
});

// Get products with filtering
const products = await client.getProducts({
  category: 'electronics',
  minPrice: 100,
  maxPrice: 1000,
  inStock: true,
  sortBy: 'price',
  sortOrder: 'asc'
});

// Health check
const health = await client.healthCheck();
```
