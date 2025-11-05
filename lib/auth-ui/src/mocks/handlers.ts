// handlers.ts
// MSW handlers for Northwind authentication endpoints

import { http, HttpResponse, delay } from 'msw';

// Base URL for auth endpoints
const AUTH_BASE_URL = '/northwind/auth';

// Mock principal data
export const mockPrincipal = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  kind: 'customer',
  displayName: 'John Doe',
  emailVerified: true,
};

export const mockEmployeePrincipal = {
  id: '987e6543-e21b-12d3-a456-426614174000',
  email: 'employee@example.com',
  kind: 'employee',
  displayName: 'Jane Smith',
  emailVerified: true,
};

/**
 * Default handlers for authentication endpoints
 */
export const handlers = [
  // POST /northwind/auth/login - Successful login
  http.post(`${AUTH_BASE_URL}/login`, async ({ request }) => {
    await delay(300); // Simulate network delay

    const body = await request.json() as { email: string; password: string };

    // Simulate different responses based on email/password
    if (body.email === 'error@example.com') {
      return HttpResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (body.email === 'server-error@example.com') {
      return HttpResponse.json(
        { success: false, message: 'Internal server error' },
        { status: 500 }
      );
    }

    // Default success response
    const principal =
      body.email === 'employee@example.com'
        ? mockEmployeePrincipal
        : mockPrincipal;

    return HttpResponse.json(
      {
        success: true,
        message: 'Login successful',
        principal,
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': 'access_token=mock_access_token; HttpOnly; Path=/',
        },
      }
    );
  }),

  // POST /northwind/auth/register - Successful registration
  http.post(`${AUTH_BASE_URL}/register`, async ({ request }) => {
    await delay(400); // Simulate network delay

    const body = await request.json() as {
      email: string;
      password: string;
      kind?: string;
      displayName?: string;
    };

    // Simulate email already exists error
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 400 }
      );
    }

    // Default success response
    return HttpResponse.json(
      {
        success: true,
        message: 'Registration successful',
        principal: {
          id: '456e7890-e89b-12d3-a456-426614174000',
          email: body.email,
          kind: body.kind || 'customer',
          displayName: body.displayName || body.email.split('@')[0],
          emailVerified: false,
        },
      },
      {
        status: 201,
        headers: {
          'Set-Cookie': 'access_token=mock_access_token; HttpOnly; Path=/',
        },
      }
    );
  }),

  // POST /northwind/auth/logout - Logout
  http.post(`${AUTH_BASE_URL}/logout`, async () => {
    await delay(200);

    return HttpResponse.json(
      {
        success: true,
        message: 'Logout successful',
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': 'access_token=; HttpOnly; Path=/; Max-Age=0',
        },
      }
    );
  }),

  // POST /northwind/auth/refresh - Refresh token
  http.post(`${AUTH_BASE_URL}/refresh`, async () => {
    await delay(200);

    return HttpResponse.json(
      {
        success: true,
        message: 'Token refreshed',
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': 'access_token=new_mock_access_token; HttpOnly; Path=/',
        },
      }
    );
  }),

  // GET /northwind/auth/me - Get current user
  http.get(`${AUTH_BASE_URL}/me`, async () => {
    await delay(150);

    return HttpResponse.json(
      {
        success: true,
        principal: {
          ...mockPrincipal,
          role: 'app_user',
        },
      },
      { status: 200 }
    );
  }),
];

/**
 * Handler variants for specific test scenarios
 */

// Handler for successful login
export const successfulLoginHandler = http.post(
  `${AUTH_BASE_URL}/login`,
  async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Login successful',
      principal: mockPrincipal,
    });
  }
);

// Handler for invalid credentials (401)
export const invalidCredentialsHandler = http.post(
  `${AUTH_BASE_URL}/login`,
  async () => {
    await delay(300);
    return HttpResponse.json(
      { success: false, message: 'Invalid credentials' },
      { status: 401 }
    );
  }
);

// Handler for server error (500)
export const serverErrorHandler = http.post(
  `${AUTH_BASE_URL}/login`,
  async () => {
    await delay(300);
    return HttpResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
);

// Handler for network error (no response)
export const networkErrorHandler = http.post(
  `${AUTH_BASE_URL}/login`,
  async () => {
    await delay(300);
    return HttpResponse.error();
  }
);

// Handler for slow response (testing loading states)
export const slowResponseHandler = http.post(
  `${AUTH_BASE_URL}/login`,
  async () => {
    await delay(3000); // 3 second delay
    return HttpResponse.json({
      success: true,
      message: 'Login successful',
      principal: mockPrincipal,
    });
  }
);

export default handlers;
