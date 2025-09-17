# Contributing to @azwebmaster/openapi-to-ts

Thank you for your interest in contributing to the OpenAPI to TypeScript generator! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Bun](https://bun.sh/) (latest version recommended)

### Installation

1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/openapi-to-ts.git
cd openapi-to-ts
```

2. Install dependencies:
```bash
bun install
```

3. Build the project:
```bash
bun run build
```

## Development Workflow

### Running Tests

Run the test suite:
```bash
bun run test
```

Run tests in watch mode:
```bash
bun run test --watch
```

### Building

Build the TypeScript code:
```bash
bun run build
```

### CLI Development

Test the CLI locally:
```bash
# Build first
bun run build

# Test CLI commands
bun run cli generate path/to/spec.yaml
bun run cli info path/to/spec.yaml
bun run cli examples
```

### Code Quality

This project uses:
- **TypeScript** for type safety
- **Vitest** for testing
- **ESLint** for linting (if configured)

## Project Structure

```
src/
├── cli.ts          # Command-line interface
├── generator.ts    # Core generation logic
├── index.ts        # Main exports
└── ...

dist/               # Compiled output
.github/workflows/  # CI/CD workflows
```

## Contributing Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Write descriptive commit messages

### Testing

- Add tests for new features
- Ensure all tests pass before submitting
- Test both CLI and programmatic usage
- Include edge cases and error scenarios

### Pull Request Process

1. Create a feature branch from `main`:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and add tests

3. Ensure all tests pass:
```bash
bun run test
```

4. Build the project:
```bash
bun run build
```

5. Update documentation if needed

6. Commit your changes:
```bash
git commit -m "feat: add your feature description"
```

7. Push to your fork and create a pull request

### Commit Message Format

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test-related changes
- `refactor:` for code refactoring
- `chore:` for maintenance tasks

Examples:
```
feat: add support for OpenAPI 3.1 nullable types
fix: handle circular references in schema parsing
docs: update CLI usage examples
test: add integration tests for complex schemas
```

## Reporting Issues

When reporting bugs or requesting features:

1. Check existing issues first
2. Use issue templates when available
3. Provide a clear description
4. Include reproduction steps
5. Add sample OpenAPI specs if relevant
6. Specify your environment (Node.js version, OS, etc.)

## Feature Requests

For feature requests:
- Describe the use case
- Explain why it's needed
- Provide examples if possible
- Consider backward compatibility

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Questions?

If you have questions about contributing, feel free to:
- Open a discussion in the GitHub repository
- Check the documentation in the README
- Look at existing issues and pull requests

Thank you for contributing! 🎉