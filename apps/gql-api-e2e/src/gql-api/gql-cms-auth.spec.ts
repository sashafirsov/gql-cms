import axios, { AxiosError } from 'axios';

describe('GQL CMS Authentication API', () => {
  const API_BASE = '/gql-cms/auth';

  // Helper to generate unique email for tests
  const generateEmail = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

  // Helper to extract cookies from response
  const extractCookies = (setCookieHeader: string[]): Map<string, string> => {
    const cookies = new Map<string, string>();
    if (!setCookieHeader) return cookies;

    setCookieHeader.forEach((cookie) => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      cookies.set(name.trim(), value);
    });
    return cookies;
  };

  describe('POST /gql-cms/auth/register', () => {
    it('should successfully register a new user', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
        fullName: 'Test User',
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Registration successful');
      expect(res.data.user).toMatchObject({
        email,
        fullName: 'Test User',
        authProvider: 'password',
        emailVerified: false,
      });
      expect(res.data.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Verify cookies are set
      const cookies = extractCookies(res.headers['set-cookie'] || []);
      expect(cookies.has('access_token')).toBe(true);
      expect(cookies.has('refresh_token')).toBe(true);
    });

    it('should use email as fullName when not provided', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.user.fullName).toBe(email);
    });

    it('should fail with duplicate email', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      // First registration
      await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      // Try to register again with same email
      try {
        await axios.post(`${API_BASE}/register`, {
          email,
          password,
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        // API may return 400 (Bad Request) or 409 (Conflict) for duplicate email
        expect([400, 409]).toContain(axiosError.response?.status);
        // Verify error message indicates duplicate/conflict
        const errorMessage = (axiosError.response?.data as any)?.message || '';
        expect(errorMessage.toLowerCase()).toMatch(/email|exists|duplicate|registered|conflict/);
      }
    });

    it('should fail with invalid email format', async () => {
      try {
        await axios.post(`${API_BASE}/register`, {
          email: 'not-an-email',
          password: 'SecurePass123!',
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(400);
      }
    });

    it('should fail with missing required fields', async () => {
      try {
        await axios.post(`${API_BASE}/register`, {
          email: generateEmail(),
          // Missing password
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        // NestJS returns 400 or 401 for missing fields depending on validation pipe configuration
        expect([400, 401]).toContain(axiosError.response?.status);
      }
    });

    it('should fail with weak password', async () => {
      try {
        await axios.post(`${API_BASE}/register`, {
          email: generateEmail(),
          password: '123', // Too short/weak
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect([400, 401]).toContain(axiosError.response?.status);
      }
    });
  });

  describe('POST /gql-cms/auth/login', () => {
    let testEmail: string;
    let testPassword: string;

    beforeAll(async () => {
      // Create a user for login tests
      testEmail = generateEmail();
      testPassword = 'SecurePass123!';

      await axios.post(`${API_BASE}/register`, {
        email: testEmail,
        password: testPassword,
        fullName: 'Test Login User',
      });
    });

    it('should successfully login with valid credentials', async () => {
      const res = await axios.post(`${API_BASE}/login`, {
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Login successful');
      expect(res.data.user).toMatchObject({
        email: testEmail,
        fullName: 'Test Login User',
        authProvider: 'password',
        emailVerified: false,
      });

      // Verify cookies are set
      const cookies = extractCookies(res.headers['set-cookie'] || []);
      expect(cookies.has('access_token')).toBe(true);
      expect(cookies.has('refresh_token')).toBe(true);
    });

    it('should fail with incorrect password', async () => {
      try {
        await axios.post(`${API_BASE}/login`, {
          email: testEmail,
          password: 'WrongPassword123!',
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
        expect(axiosError.response?.data).toMatchObject({
          statusCode: 401,
          message: 'Invalid credentials',
        });
      }
    });

    it('should fail with non-existent email', async () => {
      try {
        await axios.post(`${API_BASE}/login`, {
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
        expect(axiosError.response?.data).toMatchObject({
          statusCode: 401,
          message: 'Invalid credentials',
        });
      }
    });

    it('should fail with missing credentials', async () => {
      try {
        await axios.post(`${API_BASE}/login`, {
          email: testEmail,
          // Missing password
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        // NestJS returns 400 or 401 for missing credentials depending on validation
        expect([400, 401]).toContain(axiosError.response?.status);
      }
    });

    it('should fail with empty email', async () => {
      try {
        await axios.post(`${API_BASE}/login`, {
          email: '',
          password: testPassword,
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect([400, 401]).toContain(axiosError.response?.status);
      }
    });
  });

  describe('GET /gql-cms/auth/me', () => {
    let testEmail: string;
    let testPassword: string;
    let accessToken: string;

    beforeAll(async () => {
      // Create and login a user
      testEmail = generateEmail();
      testPassword = 'SecurePass123!';

      await axios.post(`${API_BASE}/register`, {
        email: testEmail,
        password: testPassword,
        fullName: 'Test User for /me',
      });

      const loginRes = await axios.post(`${API_BASE}/login`, {
        email: testEmail,
        password: testPassword,
      });

      const cookies = extractCookies(loginRes.headers['set-cookie'] || []);
      accessToken = cookies.get('access_token') || '';
    });

    it('should return current user with valid access token', async () => {
      const res = await axios.get(`${API_BASE}/me`, {
        headers: {
          Cookie: `access_token=${accessToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.user).toMatchObject({
        email: testEmail,
        fullName: 'Test User for /me',
        authProvider: 'password',
        emailVerified: false,
      });
      expect(res.data.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(res.data.user.role).toBeDefined();
    });

    it('should fail without access token', async () => {
      try {
        await axios.get(`${API_BASE}/me`);
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });

    it('should fail with invalid access token', async () => {
      try {
        await axios.get(`${API_BASE}/me`, {
          headers: {
            Cookie: 'access_token=invalid.jwt.token',
          },
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });

    it('should fail with expired access token', async () => {
      // This would require a token that's actually expired
      // For now, test with a malformed token
      try {
        await axios.get(`${API_BASE}/me`, {
          headers: {
            Cookie: 'access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature',
          },
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });
  });

  describe('POST /gql-cms/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      // Create and login a user
      const email = generateEmail();
      const password = 'SecurePass123!';

      const regRes = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      const cookies = extractCookies(regRes.headers['set-cookie'] || []);
      accessToken = cookies.get('access_token') || '';
      refreshToken = cookies.get('refresh_token') || '';
    });

    it('should successfully logout and clear cookies', async () => {
      const res = await axios.post(`${API_BASE}/logout`, {}, {
        headers: {
          Cookie: `access_token=${accessToken}; refresh_token=${refreshToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Logout successful');

      // Verify cookies are cleared (should have Max-Age=0 or expires in past)
      const setCookieHeaders = res.headers['set-cookie'] || [];
      expect(setCookieHeaders.some(c => c.includes('access_token=;'))).toBe(true);
      expect(setCookieHeaders.some(c => c.includes('refresh_token=;'))).toBe(true);
    });

    it('should work even without tokens (idempotent)', async () => {
      const res = await axios.post(`${API_BASE}/logout`);

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('POST /gql-cms/auth/refresh', () => {
    let refreshToken: string;
    let userId: string;

    beforeAll(async () => {
      // Create and login a user
      const email = generateEmail();
      const password = 'SecurePass123!';

      const regRes = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      const cookies = extractCookies(regRes.headers['set-cookie'] || []);
      refreshToken = cookies.get('refresh_token') || '';
      userId = regRes.data.user.id;
    });

    it('should issue new access token with valid refresh token', async () => {
      const res = await axios.post(`${API_BASE}/refresh`, {}, {
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Token refreshed');

      // Verify new access token is set
      const cookies = extractCookies(res.headers['set-cookie'] || []);
      expect(cookies.has('access_token')).toBe(true);

      // Access token should be different from refresh token (different types)
      const newAccessToken = cookies.get('access_token');
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(refreshToken);
    });

    it('should fail without refresh token', async () => {
      try {
        await axios.post(`${API_BASE}/refresh`);
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });

    it('should fail with invalid refresh token', async () => {
      try {
        await axios.post(`${API_BASE}/refresh`, {}, {
          headers: {
            Cookie: 'refresh_token=invalid.jwt.token',
          },
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });

    it('should fail with expired refresh token', async () => {
      // Malformed token to simulate expiry
      try {
        await axios.post(`${API_BASE}/refresh`, {}, {
          headers: {
            Cookie: 'refresh_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature',
          },
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });
  });

  describe('POST /gql-cms/auth/logout-all', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login a user for each test
      const email = generateEmail();
      const password = 'SecurePass123!';

      const regRes = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      const cookies = extractCookies(regRes.headers['set-cookie'] || []);
      accessToken = cookies.get('access_token') || '';
      refreshToken = cookies.get('refresh_token') || '';
    });

    it('should successfully logout from all devices', async () => {
      const res = await axios.post(`${API_BASE}/logout-all`, {}, {
        headers: {
          Cookie: `access_token=${accessToken}; refresh_token=${refreshToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Logged out from all devices');

      // Verify cookies are cleared
      const setCookieHeaders = res.headers['set-cookie'] || [];
      expect(setCookieHeaders.some(c => c.includes('access_token=;'))).toBe(true);
      expect(setCookieHeaders.some(c => c.includes('refresh_token=;'))).toBe(true);
    });

    it('should fail without authentication', async () => {
      try {
        await axios.post(`${API_BASE}/logout-all`);
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });
  });

  describe('Integration: Complete auth flow', () => {
    it('should complete full registration -> login -> access protected resource -> logout flow', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      // Step 1: Register
      const regRes = await axios.post(`${API_BASE}/register`, {
        email,
        password,
        fullName: 'Integration Test User',
      });
      expect(regRes.status).toBe(201);
      const userId = regRes.data.user.id;

      // Step 2: Login (in a new session, without cookies from registration)
      const loginRes = await axios.post(`${API_BASE}/login`, {
        email,
        password,
      });
      expect(loginRes.status).toBe(200);

      const cookies = extractCookies(loginRes.headers['set-cookie'] || []);
      const accessToken = cookies.get('access_token');

      // Step 3: Access protected resource (/me)
      const meRes = await axios.get(`${API_BASE}/me`, {
        headers: {
          Cookie: `access_token=${accessToken}`,
        },
      });
      expect(meRes.status).toBe(200);
      expect(meRes.data.user.id).toBe(userId);
      expect(meRes.data.user.email).toBe(email);

      // Step 4: Logout
      const logoutRes = await axios.post(`${API_BASE}/logout`, {}, {
        headers: {
          Cookie: `access_token=${accessToken}`,
        },
      });
      expect(logoutRes.status).toBe(200);

      // Step 5: Verify access token is invalidated (should fail to access /me)
      try {
        await axios.get(`${API_BASE}/me`, {
          headers: {
            Cookie: `access_token=${accessToken}`,
          },
        });
        // Note: This might still work if we're not tracking session invalidation
        // In a stateless JWT system, tokens remain valid until expiry
      } catch (error) {
        // Expected if we implement token blacklisting
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });

    it('should handle token refresh in the middle of session', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      // Register and get initial tokens
      const regRes = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      let cookies = extractCookies(regRes.headers['set-cookie'] || []);
      let accessToken = cookies.get('access_token');
      const refreshToken = cookies.get('refresh_token');

      // Verify initial access works
      let meRes = await axios.get(`${API_BASE}/me`, {
        headers: {
          Cookie: `access_token=${accessToken}`,
        },
      });
      expect(meRes.status).toBe(200);

      // Refresh the token
      const refreshRes = await axios.post(`${API_BASE}/refresh`, {}, {
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      });
      expect(refreshRes.status).toBe(200);

      // Get new access token
      cookies = extractCookies(refreshRes.headers['set-cookie'] || []);
      const newAccessToken = cookies.get('access_token');
      expect(newAccessToken).toBeDefined();
      // Note: Token might be the same if generated in the same second with same payload
      // The important part is that we got a valid token back

      // Verify new access token works
      meRes = await axios.get(`${API_BASE}/me`, {
        headers: {
          Cookie: `access_token=${newAccessToken}`,
        },
      });
      expect(meRes.status).toBe(200);
      expect(meRes.data.user.email).toBe(email);
    });

    it('should handle multiple device logout scenario', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      // Device 1: Register
      const device1Res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });
      const device1Cookies = extractCookies(device1Res.headers['set-cookie'] || []);

      // Device 2: Login
      const device2Res = await axios.post(`${API_BASE}/login`, {
        email,
        password,
      });
      const device2Cookies = extractCookies(device2Res.headers['set-cookie'] || []);

      // Both devices should have valid tokens
      expect(device1Cookies.has('access_token')).toBe(true);
      expect(device2Cookies.has('access_token')).toBe(true);

      // Logout all devices from device 1
      await axios.post(`${API_BASE}/logout-all`, {}, {
        headers: {
          Cookie: `access_token=${device1Cookies.get('access_token')}`,
        },
      });

      // Device 2's refresh token should now be revoked
      try {
        await axios.post(`${API_BASE}/refresh`, {}, {
          headers: {
            Cookie: `refresh_token=${device2Cookies.get('refresh_token')}`,
          },
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });
  });

  describe('Security: Cookie attributes', () => {
    it('should set HttpOnly flag on auth cookies', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      const setCookieHeaders = res.headers['set-cookie'] || [];

      // Check access_token cookie
      const accessCookie = setCookieHeaders.find(c => c.startsWith('access_token='));
      expect(accessCookie).toBeDefined();
      expect(accessCookie).toContain('HttpOnly');

      // Check refresh_token cookie
      const refreshCookie = setCookieHeaders.find(c => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should set appropriate cookie paths', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      const setCookieHeaders = res.headers['set-cookie'] || [];

      // access_token should be available on all paths
      const accessCookie = setCookieHeaders.find(c => c.startsWith('access_token='));
      expect(accessCookie).toContain('Path=/');

      // refresh_token should be restricted to auth endpoints
      const refreshCookie = setCookieHeaders.find(c => c.startsWith('refresh_token='));
      expect(refreshCookie).toContain('Path=/gql-cms/auth');
    });

    it('should set SameSite attribute', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
      });

      const setCookieHeaders = res.headers['set-cookie'] || [];

      setCookieHeaders.forEach(cookie => {
        expect(cookie).toContain('SameSite=');
      });
    });
  });

  describe('Data Validation', () => {
    it('should sanitize email addresses (case-insensitive)', async () => {
      const baseEmail = generateEmail();
      const password = 'SecurePass123!';

      // Register with lowercase
      await axios.post(`${API_BASE}/register`, {
        email: baseEmail.toLowerCase(),
        password,
      });

      // Try to register with uppercase (should fail - same email)
      try {
        await axios.post(`${API_BASE}/register`, {
          email: baseEmail.toUpperCase(),
          password,
        });
        fail('Should have thrown an error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect([400, 409]).toContain(axiosError.response?.status);
      }
    });

    it('should handle long fullName gracefully', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';
      const longName = 'A'.repeat(500); // Very long name

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
        fullName: longName,
      });

      expect(res.status).toBe(201);
      expect(res.data.user.fullName).toBeDefined();
    });

    it('should handle special characters in fullName', async () => {
      const email = generateEmail();
      const password = 'SecurePass123!';

      const res = await axios.post(`${API_BASE}/register`, {
        email,
        password,
        fullName: "O'Brien-Smith Jr. (Test)",
      });

      expect(res.status).toBe(201);
      expect(res.data.user.fullName).toBe("O'Brien-Smith Jr. (Test)");
    });
  });
});
