# MSW Mocks for Auth UI

This directory contains Mock Service Worker (MSW) handlers for testing authentication flows in Storybook and tests.

## Overview

MSW intercepts network requests at the service worker level, providing realistic API mocking without modifying application code.

## Files

- **`handlers.ts`** - MSW request handlers for `/northwind/auth/*` endpoints
- **`index.ts`** - Barrel export for all mocks

## Available Handlers

### Default Handlers
The `handlers` array includes handlers for all auth endpoints:

- `POST /northwind/auth/login` - Login endpoint
- `POST /northwind/auth/register` - Registration endpoint
- `POST /northwind/auth/logout` - Logout endpoint
- `POST /northwind/auth/refresh` - Token refresh endpoint
- `GET /northwind/auth/me` - Get current user endpoint

### Handler Variants

Pre-configured handlers for specific test scenarios:

```typescript
import {
  successfulLoginHandler,
  invalidCredentialsHandler,
  serverErrorHandler,
  networkErrorHandler,
  slowResponseHandler,
} from './mocks';
```

- **`successfulLoginHandler`** - Returns successful login response
- **`invalidCredentialsHandler`** - Returns 401 with error message
- **`serverErrorHandler`** - Returns 500 server error
- **`networkErrorHandler`** - Simulates network failure
- **`slowResponseHandler`** - 3 second delay for testing loading states

### Mock Data

```typescript
import { mockPrincipal, mockEmployeePrincipal } from './mocks';
```

- **`mockPrincipal`** - Default customer principal
- **`mockEmployeePrincipal`** - Employee principal for role testing

## Usage in Storybook

### Basic Usage

Use the MSW addon to provide handlers for specific stories:

```typescript
import { successfulLoginHandler } from '../mocks';

export const MyStory: Story = {
  parameters: {
    msw: {
      handlers: [successfulLoginHandler],
    },
  },
};
```

### Custom Handlers

Create custom handlers for specific scenarios:

```typescript
import { http, HttpResponse, delay } from 'msw';

export const CustomScenario: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/northwind/auth/login', async ({ request }) => {
          const body = await request.json();

          await delay(300);

          if (body.email === 'special@example.com') {
            return HttpResponse.json({
              success: true,
              principal: { /* custom data */ },
            });
          }

          return HttpResponse.json(
            { success: false, message: 'Error' },
            { status: 400 }
          );
        }),
      ],
    },
  },
};
```

### Multiple Handlers

Combine multiple handlers for complex scenarios:

```typescript
export const ComplexScenario: Story = {
  parameters: {
    msw: {
      handlers: [
        successfulLoginHandler,
        http.get('/northwind/auth/me', async () => {
          return HttpResponse.json({
            success: true,
            principal: mockPrincipal,
          });
        }),
      ],
    },
  },
};
```

## Special Test Cases

### Testing Different User Types

The default login handler checks email to return different principals:

```typescript
// Returns mockPrincipal (customer)
{ email: 'user@example.com', password: 'any' }

// Returns mockEmployeePrincipal (employee)
{ email: 'employee@example.com', password: 'any' }
```

### Testing Error Scenarios

```typescript
// Returns 401 Invalid credentials
{ email: 'error@example.com', password: 'any' }

// Returns 500 Server error
{ email: 'server-error@example.com', password: 'any' }
```

### Testing Stateful Scenarios

For scenarios requiring state (like retry after error):

```typescript
http.post('/northwind/auth/login', async ({ request }) => {
  const body = await request.json();

  // Different responses based on input
  if (body.password === 'wrongpassword') {
    return HttpResponse.json(
      { success: false, message: 'Invalid' },
      { status: 401 }
    );
  }

  return HttpResponse.json({
    success: true,
    principal: mockPrincipal,
  });
})
```

## MSW Configuration

### Storybook Setup

The MSW addon is configured in `.storybook/`:

**main.ts:**
```typescript
addons: ['msw-storybook-addon']
```

**preview.ts:**
```typescript
import { initialize, mswLoader } from 'msw-storybook-addon';

initialize({ onUnhandledRequest: 'bypass' });

export default {
  loaders: [mswLoader],
};
```

### Service Worker

The MSW service worker is located at `public/mockServiceWorker.js` and is automatically served by Storybook.

## Adding New Handlers

1. Add handler to `handlers.ts`:

```typescript
export const newFeatureHandler = http.post(
  `${AUTH_BASE_URL}/new-endpoint`,
  async ({ request }) => {
    // Handler logic
    return HttpResponse.json({ /* response */ });
  }
);
```

2. Export from `index.ts`:

```typescript
export { newFeatureHandler } from './handlers';
```

3. Use in stories:

```typescript
import { newFeatureHandler } from '../mocks';

export const Story: Story = {
  parameters: {
    msw: { handlers: [newFeatureHandler] },
  },
};
```

## Debugging

### View Network Requests

MSW logs intercepted requests to the console:

```
[MSW] POST /northwind/auth/login (200 OK)
```

### Bypass MSW for Specific Requests

```typescript
initialize({
  onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
});
```

### Disable MSW for a Story

```typescript
export const NoMocking: Story = {
  parameters: {
    msw: { handlers: [] }, // No handlers, real network calls
  },
};
```

## Best Practices

1. **Use handler variants** for common scenarios instead of inline handlers
2. **Keep handlers realistic** - match actual API behavior
3. **Test error cases** - don't just test happy paths
4. **Add delays** - simulate realistic network latency
5. **Document custom handlers** - explain special test logic

## Resources

- [MSW Documentation](https://mswjs.io/)
- [MSW Storybook Addon](https://github.com/mswjs/msw-storybook-addon)
- [Storybook Testing](https://storybook.js.org/docs/writing-tests)
