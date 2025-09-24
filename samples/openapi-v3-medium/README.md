# OpenAPI v3 Medium Sample

This directory contains a medium complexity OpenAPI v3 specification and generation scripts.

## Files

- `openapi-v3-medium.yaml` - Medium complexity OpenAPI v3 specification
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
import { createMediumAPIClient } from './generated';

const client = createMediumAPIClient({
  baseURL: 'https://api.example.com/v1',
  headers: {
    'Authorization': 'Bearer your-token-here'
  }
});

// Get users with filtering
const users = await client.getUsers({
  page: 1,
  limit: 20,
  search: 'john',
  role: 'user'
});

// Upload user avatar
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
```
