import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITERATIONS = 100000;
const HASH_ALGO = 'sha256';
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 mins

export function authDevPlugin() {
  return {
    name: 'skycash-auth-dev-plugin',
    configureServer(server) {
      const usersFilePath = path.resolve(__dirname, '../data/auth_users.json');
      const activeSessions = new Map();
      const failedAttempts = new Map();

      // Helper to dynamically read Google Client ID from any available .env file
      function getGoogleClientId() {
        if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;
        if (process.env.VITE_GOOGLE_CLIENT_ID) return process.env.VITE_GOOGLE_CLIENT_ID;

        const candidateEnvFiles = [
          path.resolve(__dirname, '../backend/.env'),
          path.resolve(__dirname, '../.env'),
          path.resolve(__dirname, '.env'),
        ];

        for (const envFile of candidateEnvFiles) {
          if (fs.existsSync(envFile)) {
            try {
              const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                  const [k, ...vParts] = trimmed.split('=');
                  const val = vParts.join('=').trim();
                  if (k.trim() === 'GOOGLE_CLIENT_ID' || k.trim() === 'VITE_GOOGLE_CLIENT_ID') {
                    process.env.GOOGLE_CLIENT_ID = val;
                    return val;
                  }
                }
              }
            } catch {
              // Ignore read errors
            }
          }
        }
        return null;
      }

      function ensureUsersFile() {
        try {
          if (!fs.existsSync(usersFilePath)) {
            fs.mkdirSync(path.dirname(usersFilePath), { recursive: true });
            fs.writeFileSync(usersFilePath, JSON.stringify([], null, 2), 'utf-8');
            return [];
          }
          const content = fs.readFileSync(usersFilePath, 'utf-8');
          return JSON.parse(content);
        } catch {
          return [];
        }
      }

      function saveUsers(users) {
        fs.mkdirSync(path.dirname(usersFilePath), { recursive: true });
        const tmpPath = usersFilePath + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(users, null, 2), 'utf-8');
        fs.renameSync(tmpPath, usersFilePath);
      }

      function hashPassword(password) {
        const salt = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, HASH_ALGO);
        return `pbkdf2_${HASH_ALGO}$${ITERATIONS}$${salt.toString('hex')}$${key.toString('hex')}`;
      }

      function verifyPassword(password, storedHash) {
        try {
          const parts = storedHash.split('$');
          if (parts.length !== 4) return false;
          const [algo, itersStr, saltHex, keyHex] = parts;
          if (algo !== `pbkdf2_${HASH_ALGO}`) return false;
          const salt = Buffer.from(saltHex, 'hex');
          const expectedKey = Buffer.from(keyHex, 'hex');
          const computedKey = crypto.pbkdf2Sync(password, salt, parseInt(itersStr, 10), 32, HASH_ALGO);
          return crypto.timingSafeEqual(computedKey, expectedKey);
        } catch {
          return false;
        }
      }

      function parseCookies(req) {
        const list = {};
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) return list;
        cookieHeader.split(';').forEach((cookie) => {
          const parts = cookie.split('=');
          const name = parts.shift()?.trim();
          if (name) {
            list[name] = decodeURI(parts.join('='));
          }
        });
        return list;
      }

      function parseBody(req) {
        return new Promise((resolve) => {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              resolve(JSON.parse(body || '{}'));
            } catch {
              resolve({});
            }
          });
        });
      }

      function sendJson(res, statusCode, data) {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      }

      function isBackendUp() {
        return new Promise((resolve) => {
          const checkReq = http.get('http://127.0.0.1:8000/health', (resp) => {
            resolve(resp.statusCode === 200);
          });
          checkReq.on('error', () => resolve(false));
          checkReq.setTimeout(300, () => {
            checkReq.destroy();
            resolve(false);
          });
        });
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/auth')) {
          return next();
        }

        const backendOnline = await isBackendUp();
        if (backendOnline) {
          return next();
        }

        const method = req.method?.toUpperCase();
        const cookies = parseCookies(req);
        const authHeader = req.headers.authorization;
        const sessionToken = cookies['skycash_session'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

        // GET /api/auth/config
        if (method === 'GET' && url === '/api/auth/config') {
          const googleClientId = getGoogleClientId();
          return sendJson(res, 200, {
            google_client_id: googleClientId,
            registration_enabled: true,
            password_min_length: 8,
            team_name: 'BUTANE',
            product_name: 'SkyCash',
          });
        }

        // GET /api/auth/me
        if (method === 'GET' && url === '/api/auth/me') {
          if (!sessionToken) {
            return sendJson(res, 401, { detail: 'Authentication required. Please sign in.' });
          }
          const session = activeSessions.get(sessionToken);
          if (!session || Date.now() > session.expires_at) {
            if (session) activeSessions.delete(sessionToken);
            return sendJson(res, 401, { detail: 'Session expired or invalid. Please sign in again.' });
          }
          const users = ensureUsersFile();
          const user = users.find((u) => u.id === session.user_id);
          if (!user) {
            return sendJson(res, 401, { detail: 'User account no longer found.' });
          }
          return sendJson(res, 200, {
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              auth_provider: user.auth_provider,
              created_at: user.created_at,
            },
          });
        }

        // POST /api/auth/register
        if (method === 'POST' && url === '/api/auth/register') {
          const body = await parseBody(req);
          const email = (body.email || '').trim().toLowerCase();
          const password = body.password || '';
          const name = (body.name || '').trim();

          if (!email || !email.includes('@') || !email.includes('.')) {
            return sendJson(res, 422, { detail: 'Valid email address required.' });
          }
          if (password.length < 8) {
            return sendJson(res, 422, { detail: 'Password must be at least 8 characters long.' });
          }

          const users = ensureUsersFile();
          if (users.some((u) => u.email === email)) {
            return sendJson(res, 400, { detail: 'An account with this email address already exists. Please sign in instead.' });
          }

          const newUser = {
            id: `usr_${crypto.randomBytes(6).toString('hex')}`,
            email,
            name: name || email.split('@')[0],
            password_hash: hashPassword(password),
            auth_provider: 'local',
            created_at: new Date().toISOString(),
          };
          users.push(newUser);
          saveUsers(users);

          const token = crypto.randomBytes(24).toString('base64url');
          const durationMs = 24 * 3600 * 1000;
          activeSessions.set(token, {
            user_id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            auth_provider: newUser.auth_provider,
            expires_at: Date.now() + durationMs,
          });

          res.setHeader('Set-Cookie', `skycash_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 3600}`);
          return sendJson(res, 201, {
            user: {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              auth_provider: newUser.auth_provider,
              created_at: newUser.created_at,
            },
            token,
            expires_in_seconds: 24 * 3600,
          });
        }

        // POST /api/auth/login
        if (method === 'POST' && url === '/api/auth/login') {
          const body = await parseBody(req);
          const email = (body.email || '').trim().toLowerCase();
          const password = body.password || '';
          const rememberMe = Boolean(body.remember_me);

          // Rate limiting check
          const attempt = failedAttempts.get(email);
          const now = Date.now();
          if (attempt && attempt.lockedUntil > now) {
            const remainingMins = Math.ceil((attempt.lockedUntil - now) / 60000);
            return sendJson(res, 429, {
              detail: `Too many failed login attempts. Account temporarily locked for ${remainingMins} minute(s) for security.`,
            });
          }

          const users = ensureUsersFile();
          const user = users.find((u) => u.email === email);
          const valid = user && user.password_hash ? verifyPassword(password, user.password_hash) : false;

          if (!user || !valid) {
            const count = (attempt ? attempt.count : 0) + 1;
            const lockedUntil = count >= LOCKOUT_THRESHOLD ? now + LOCKOUT_DURATION_MS : 0;
            failedAttempts.set(email, { count, lockedUntil });
            return sendJson(res, 401, {
              detail: 'Invalid email or password. Please verify your credentials and try again.',
            });
          }

          failedAttempts.delete(email);
          const durationSeconds = rememberMe ? 30 * 24 * 3600 : 24 * 3600;
          const token = crypto.randomBytes(24).toString('base64url');
          activeSessions.set(token, {
            user_id: user.id,
            email: user.email,
            name: user.name,
            auth_provider: user.auth_provider,
            expires_at: now + durationSeconds * 1000,
          });

          res.setHeader('Set-Cookie', `skycash_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${durationSeconds}`);
          return sendJson(res, 200, {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              auth_provider: user.auth_provider,
              created_at: user.created_at,
            },
            token,
            expires_in_seconds: durationSeconds,
          });
        }

        // POST /api/auth/logout
        if (method === 'POST' && url === '/api/auth/logout') {
          if (sessionToken) {
            activeSessions.delete(sessionToken);
          }
          res.setHeader('Set-Cookie', 'skycash_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
          return sendJson(res, 200, { status: 'ok', message: 'Logged out successfully.' });
        }

        // POST /api/auth/google
        if (method === 'POST' && url === '/api/auth/google') {
          const body = await parseBody(req);
          const clientId = getGoogleClientId();
          if (!clientId) {
            return sendJson(res, 501, {
              code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
              message:
                'Google OAuth sign-in is not yet configured for this environment. To enable Google Sign-In, configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your backend environment (.env) file.',
            });
          }

          const credential = body.credential;
          if (!credential) {
            return sendJson(res, 400, { detail: 'Missing Google credential token.' });
          }

          // Verify token directly with Google OAuth2 tokeninfo endpoint
          try {
            const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
            const googleData = await new Promise((resolve, reject) => {
              https
                .get(googleVerifyUrl, (gRes) => {
                  let raw = '';
                  gRes.on('data', (c) => (raw += c));
                  gRes.on('end', () => {
                    try {
                      const parsed = JSON.parse(raw);
                      resolve(parsed);
                    } catch (e) {
                      reject(e);
                    }
                  });
                })
                .on('error', reject);
            });

            if (googleData.error || !googleData.email) {
              return sendJson(res, 401, {
                detail: googleData.error_description || 'Invalid or expired Google authentication token.',
              });
            }

            if (googleData.aud !== clientId) {
              return sendJson(res, 401, {
                detail: 'Google authentication token was issued for a different client application.',
              });
            }

            const email = googleData.email.toLowerCase().trim();
            const name = googleData.name || email.split('@')[0];

            const users = ensureUsersFile();
            let user = users.find((u) => u.email === email);
            if (!user) {
              user = {
                id: `usr_goog_${crypto.randomBytes(6).toString('hex')}`,
                email,
                name,
                password_hash: '',
                auth_provider: 'google',
                created_at: new Date().toISOString(),
              };
              users.push(user);
              saveUsers(users);
            }

            const durationSeconds = 24 * 3600;
            const token = crypto.randomBytes(24).toString('base64url');
            activeSessions.set(token, {
              user_id: user.id,
              email: user.email,
              name: user.name,
              auth_provider: user.auth_provider,
              expires_at: Date.now() + durationSeconds * 1000,
            });

            res.setHeader('Set-Cookie', `skycash_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${durationSeconds}`);
            return sendJson(res, 200, {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                auth_provider: user.auth_provider,
                created_at: user.created_at,
              },
              token,
              expires_in_seconds: durationSeconds,
            });
          } catch (err) {
            return sendJson(res, 400, { detail: 'Failed to verify Google token: ' + (err.message || String(err)) });
          }
        }

        // POST /api/auth/forgot-password
        if (method === 'POST' && url === '/api/auth/forgot-password') {
          return sendJson(res, 200, {
            status: 'ok',
            message: 'If an account is associated with this email address, password reset guidance has been logged for workspace administrators.',
          });
        }

        return next();
      });
    },
  };
}
