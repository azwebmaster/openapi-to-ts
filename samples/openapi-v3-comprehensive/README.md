# OpenAPI v3 Comprehensive Sample

This directory contains a comprehensive OpenAPI v3 specification and generation scripts.

## Files

- `comprehensive-test-spec.yaml` - Comprehensive OpenAPI v3 specification with all features
- `generate.sh` - Unix/Linux/macOS generation script
- `generate.bat` - Windows generation script
- `generated/` - Directory for generated TypeScript files (created after running generation)

## Specification Features

- **Complete CRUD operations** for multiple resources
- **Advanced authentication** (API Key, Bearer, OAuth2)
- **File upload scenarios** (single and multiple files)
- **Complex parameter handling** (query, path, header, form data)
- **Polymorphic responses** with discriminators
- **Recursive/circular references** (categories with subcategories)
- **Advanced validation** (patterns, formats, constraints)
- **Multiple content types** (JSON, XML, CSV, PDF)
- **Webhook configurations**
- **Analytics and reporting**
- **Health monitoring**
- **Edge cases** (special characters in operation IDs)
- **Comprehensive error handling**

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

The generation script uses `group-by-tag` mode, creating:
- `types/` - Directory with TypeScript files grouped by API tags
- `client.ts` - Axios-based API client class
- `index.ts` - Exports and factory function

## Usage Example

```typescript
import { createComprehensiveAPIClient } from './generated';

const client = createComprehensiveAPIClient({
  baseURL: 'https://api.example.com/v1',
  headers: {
    'X-API-Key': 'your-api-key',
    'Authorization': 'Bearer your-jwt-token'
  }
});

// Complex user operations
const users = await client.getUsers({
  page: 1,
  limit: 50,
  sort: 'created_at',
  order: 'desc',
  filter: 'john'
});

// File upload with metadata
const formData = new FormData();
formData.append('file', file);
formData.append('description', 'Document upload');
formData.append('tags', JSON.stringify(['important', 'contract']));

const fileInfo = await client.uploadFile(formData);

// Analytics with complex filtering
const analytics = await client.getAnalyticsReport({
  metrics: ['views', 'clicks', 'conversions'],
  dimensions: ['date', 'country'],
  filters: {
    source: ['google', 'facebook'],
    device: ['mobile']
  },
  period: {
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  }
});

// Webhook management
const webhook = await client.createWebhook({
  url: 'https://myapp.com/webhooks',
  events: ['user.created', 'user.updated'],
  secret: 'webhook-secret',
  retry_config: {
    max_attempts: 5,
    backoff_multiplier: 2,
    initial_delay: 1000
  }
});
```
