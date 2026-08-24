# Testing Guide

## Unit Tests

### DirectorPanel Tests (`lib/DirectorPanel.test.tsx`)

React component tests using React Testing Library. Coverage:

- **Visibility**: Rendering based on `visible` prop
- **Mode Switching**: Human/AI/Both mode buttons and state dispatch
- **State Toggle**: Show/hide state panel
- **Fact Assertion**: Key + clause inputs, assert/clear buttons
- **Connection**: WebSocket state and coordinator URL management
- **Activity Feed**: Message display and ordering
- **Disabled State**: Controls disabled in AI-only mode
- **Focus Management**: Button clicks don't steal game focus

**Run tests:**
```bash
npm test -- lib/DirectorPanel.test.tsx
npm test -- lib/DirectorPanel.test.tsx --watch  # Watch mode
npm test -- lib/DirectorPanel.test.tsx --coverage
```

### History Tests (`lib/history.test.ts`)

Core state management logic. Coverage:

- **Assertion**: Sustained, temporary, and instant facts
- **Retraction**: Remove facts by key
- **Clear**: Wipe all facts
- **Has**: Fact existence check
- **Advance & Expiration**: Fact lifetime management
- **Projection**: Convert facts to conditioning signal
- **Snapshot**: Ordered fact list with remaining lifetime
- **Reconciliation**: Handle fact observation
- **Debug Mode**: Logging when enabled

**Run tests:**
```bash
npm test -- lib/history.test.ts
npm test -- lib/history.test.ts --coverage
```

### Coordinator Tests

Integration tests for WebSocket state dispatch (in `coordinator/`).

```bash
cd coordinator
npm test
```

## Running All Tests

```bash
# Frontend tests
npm test

# With coverage report
npm test --coverage

# Watch mode for development
npm test --watch
```

## Test Structure

Each test file follows this pattern:

```typescript
describe('ComponentOrModule', () => {
  describe('Feature', () => {
    it('should do X', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Mocking

### WebSocket
```typescript
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  readyState: 1,
})) as any;
```

### React Components
Use `@testing-library/react` for component tests:
```typescript
render(<Component prop={value} />);
await waitFor(() => {
  expect(screen.getByText('text')).toBeInTheDocument();
});
```

## Coverage Goals

- **DirectorPanel**: >80% (UI logic, user interactions)
- **History**: >90% (core state management)
- **Coordinator**: >70% (WebSocket dispatch, state sync)

Current coverage: See `coverage/` directory after running `npm test --coverage`.

## Common Issues

### Test timeout
If WebSocket mocks or async operations timeout:
```typescript
await waitFor(() => {
  expect(...).toHaveBeenCalled();
}, { timeout: 5000 });
```

### Event not firing
Ensure you're using `fireEvent` or `userEvent`:
```typescript
fireEvent.click(button);  // Synchronous
await userEvent.type(input, 'text');  // Async
```

### Snapshot changes
Review changes with:
```bash
npm test -- --updateSnapshot
```

But commit snapshot changes carefully—they're version-controlled.

## CI Integration

Tests run automatically on:
- Pre-commit hooks (lint + test)
- Pull requests (full test suite)
- Before deployment (must pass)

Add to `.github/workflows/test.yml` for CI automation.

## Next Steps

1. Run all tests: `npm test`
2. Check coverage: `npm test --coverage`
3. Fix any failures
4. Add tests for new components/features
5. Aim for >80% coverage on hot-path code

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro)
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
