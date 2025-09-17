# OpenAPI to TypeScript Generator (@azwebmaster/openapi-to-ts)

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

This is a TypeScript library and CLI tool that generates typed Axios client code from OpenAPI 3.0+ specifications. The project uses Bun as the primary runtime and package manager.

## Working Effectively

### Prerequisites and Setup
- Install Bun runtime (v1.2.22+):
  ```bash
  curl -fsSL https://bun.sh/install | bash
  source ~/.bashrc
  ```
- Node.js v18+ is also available as fallback but Bun is preferred
- Install dependencies: `bun install` -- takes ~20 seconds
- Build the project: `bun run build` -- takes ~3 seconds, NEVER CANCEL
- Run tests: `bun run test` -- No tests currently exist, so this will exit with code 1

### Build and Development Commands
- `bun install` -- Install all dependencies (~20 seconds)
- `bun run build` -- Compile TypeScript to dist/ (~3 seconds)
- `bun run cli [command]` -- Run CLI directly from source
- `bun run test` -- Run test suite (currently no tests exist)
- `bun run generate` -- Run programmatic generation from source

### CLI Usage and Testing
The CLI can be used directly from source during development:
- `bun run cli --help` -- Show help
- `bun run cli examples` -- Show usage examples
- `bun run cli info <spec>` -- Analyze OpenAPI spec
- `bun run cli generate <spec> [options]` -- Generate TypeScript client

### Generation Testing
Always test generation with a sample spec:
```bash
# Create test spec
cat > /tmp/test-api.yaml << 'EOF'
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      required:
        - id
        - name
EOF

# Test generation
bun run cli generate /tmp/test-api.yaml -o /tmp/generated-test
```

## Validation Scenarios

### Essential CLI Testing
After making changes, always run these validation steps:
1. `bun run build` -- Ensure compilation succeeds
2. `bun run cli --help` -- Verify CLI loads correctly
3. `bun run cli examples` -- Check examples display properly
4. `bun run cli info /tmp/test-api.yaml` -- Test spec analysis
5. `bun run cli generate /tmp/test-api.yaml --dry-run` -- Test dry run
6. `bun run cli generate /tmp/test-api.yaml -o /tmp/test-output` -- Test actual generation
7. Verify generated files exist: `ls /tmp/test-output/` (should show types.ts, client.ts, index.ts)

### Build Timing Expectations
- Dependencies install: ~20 seconds
- TypeScript compilation: ~3 seconds
- Code generation: <1 second per spec
- NEVER CANCEL any build operations - they complete quickly

### Manual Functionality Testing
The generated client should be usable as TypeScript code:
```typescript
import { createClient } from './generated-output';
const client = createClient("https://api.example.com");
// Should have properly typed methods based on OpenAPI spec
```

## Project Structure

```
src/
├── cli.ts          # Command-line interface entry point
├── generator.ts    # Core OpenAPI-to-TypeScript generation logic  
├── index.ts        # Main programmatic exports
└── ...

dist/               # Compiled TypeScript output
.github/workflows/  # CI/CD (uses Bun for build and test)
package.json        # Bun package manager configuration
tsconfig.json       # TypeScript configuration
```

## Key Implementation Details

### Core Components
- **CLI (src/cli.ts)**: Commander.js-based CLI with commands: generate, info, examples
- **Generator (src/generator.ts)**: Uses ts-morph and swagger-parser for code generation
- **Main Export (src/index.ts)**: Provides programmatic API

### Runtime Requirements
- Bun is the primary runtime for development and CLI usage
- Project outputs ES modules with .js extensions in imports
- Generated code uses Axios for HTTP client functionality
- Supports both file-based and URL-based OpenAPI specifications

### CI/CD Integration
The GitHub Actions workflow (.github/workflows/ci.yml) uses:
- Ubuntu latest runner
- Bun setup action
- Standard workflow: install → build → test

## Common Development Tasks

### Adding New CLI Features
1. Modify src/cli.ts to add new commands or options
2. Update src/generator.ts for generation logic changes
3. Test with: `bun run build && bun run cli [new-command]`
4. Validate all existing commands still work

### Debugging Generation Issues
1. Use `--dry-run` flag to preview without writing files
2. Test with minimal OpenAPI specs first
3. Check TypeScript compilation of generated output
4. Verify imports/exports work correctly

### Development Workflow
1. Make changes to TypeScript source
2. Run `bun run build` to compile
3. Test CLI functionality with `bun run cli`
4. Create test OpenAPI specs in /tmp/ for validation
5. Never commit temporary test files

## Important Notes

- The project uses ES modules exclusively - all imports need .js extensions
- Bun handles TypeScript compilation much faster than tsc directly
- No linting tools are currently configured
- Test infrastructure exists (Vitest) but no tests are implemented yet
- Generated code creates fully typed Axios client classes
- Supports OpenAPI 3.0+ specifications in both YAML and JSON formats
- CLI provides helpful error messages and colorized output using emojis

## Troubleshooting

### Common Issues
- Module resolution errors: Ensure .js extensions in imports for ES modules
- CLI not found: Run `bun run build` first, then use `bun run cli` instead of direct execution
- Generation failures: Validate OpenAPI spec with `bun run cli info <spec>` first
- Build failures: Check TypeScript errors and ensure all dependencies are installed

### Environment Validation
Run this sequence to verify working environment:
```bash
bun --version  # Should be 1.2.22+
cd /path/to/repo
bun install
bun run build
bun run cli --help
```

Always use Bun commands over npm/node for consistency with the project setup.