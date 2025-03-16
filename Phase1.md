# Phase 1: Secure Authentication & Role-Based Access Control (RBAC)

This document outlines the implementation details for the secure authentication and role-based access control system implemented in this project.

## Requirements Implementation

### 1. JWT-based Authentication System

#### Login
- Implemented in `AuthController.ts` using the `loginUser` function
- Validates user credentials using Joi validation
- Uses bcrypt to compare password hashes
- Returns JWT token upon successful authentication
- Sets HTTP-only cookie for token storage
- See implementation: `/src/controllers/AuthController.ts`

#### Register
- Implemented in `AuthController.ts` using the `createUser` function
- Validates user input with Joi schema validation
- Encrypts passwords using bcrypt with salt factor of 10
- Assigns default "User" role to new users
- Issues JWT token upon successful registration
- See implementation: `/src/controllers/AuthController.ts`

#### Logout
- Multiple logout mechanisms implemented:
  - `logoutUser`: Current device logout
  - `logoutFromDevice`: Specific device logout
  - `logoutFromAllDevices`: Complete account logout
- Invalidates tokens by marking them as disabled in the database
- Clears authentication cookies
- See implementation: `/src/controllers/AuthController.ts`

#### Password Reset
- Implemented secure password reset flow:
  - `forgotPassword`: Generates a secure token and sends reset email
  - `getResetPasswordEmail`: Verifies token and provides associated email
  - `resetPassword`: Allows password change with valid token
- Tokens have configurable expiration (default: 120 minutes)
- Tokens become invalid after use (marked as disabled)
- See implementation: `/src/controllers/AuthController.ts`

#### Token Management
- Token generation and verification handled by `TokenService.ts`
- Stores tokens in database with unique identifiers
- Implements token revocation and blacklisting
- See implementation: `/src/services/TokenService.ts`

### 2. Role-Based Access Control (RBAC)

- Implemented three primary roles: Admin, Moderator, and User
- Roles stored in database with relationships to users
- Role verification middleware: `HasRole.ts`
- Example usage in routes: `UserRoutes.ts`
- Database schema supports role relationships: `schema.prisma`

#### Protected Endpoints:
- Admin-only routes: `UserRoutes.post('/:id/disable', Authenticate, HasRole('Admin'), disableUser)`
- Moderator access: `UserRoutes.get('/', Authenticate, HasRole('Admin', 'Moderator'), Paginate, getUsers)`
- User-specific endpoints: `UserRoutes.get('/me', Authenticate, getProfile)`

### 3. Security Measures

#### Rate Limiting
- Express Rate Limit implementation in `index.ts`
- Configured with:
  - 15 requests per minute window
  - Custom rate limit exceeded message
  - Applied to all API routes

#### Login Attempt Limiting
- Specialized rate limiter for login attempts in `LoginRateLimiter.ts`
- Configurable threshold (default: 10 attempts)
- Automatically disables account after threshold is reached
- Requires password reset to re-activate locked accounts
- IP-based limiting for 24-hour window

#### CSRF Protection
- Double-submit cookie pattern implemented in `Csrf.ts` middleware
- CSRF token attached to responses via cookies
- Token validation on all non-GET/HEAD requests
- Applied to all API routes

#### Brute Force Prevention
- Rate limiting helps prevent brute force attacks
- Account lockout mechanism via the `active` field in the User model
- Admin ability to disable compromised accounts

#### Data Encryption
- Password hashing with bcrypt (10 rounds)
- Secure cookie settings with:
  - HTTP-only flag
  - Secure flag in production
  - SameSite policy
- Database-level encryption for sensitive fields

### 4. Additional Security Features

#### Authentication Middleware
- Robust token verification in `Authenticate.ts`
- Checks token validity, expiration, and active status
- Fetches associated user and role information

#### Secure Headers
- Helmet.js integration for security headers
- Protection against common web vulnerabilities
- XSS protection through content security policies

#### Cookie Security
- Secure cookie implementation for token storage
- Configurable security settings based on environment

#### WebSocket Security
- Socket.io connection secured with credentials
- User identification and room management
- Role-based event emission

#### Performance Optimization
- Redis caching implementation for database queries
- Configurable cache TTL (Time To Live)
- Automatic cache invalidation on data updates
- Support for various caching drivers (memory, Redis)

## Database Model

The security model relies on the following database tables:

### Users (`users`)
- Stores user credentials and profile information
- Contains password hashes and account status
- Tracks active/inactive status for account lockouts

### Roles (`roles`)
- Defines available roles in the system
- Linked to users via relations

### User Tokens (`user_tokens`)
- Stores active authentication tokens
- Supports multi-device login and selective revocation
- Includes token disabling functionality

### Password Reset (`password_reset`)
- Stores secure password reset tokens
- Links tokens to specific users
- Includes creation timestamp for expiration enforcement
- Supports token invalidation after use

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Authenticate user and get token
- `POST /api/auth/logout` - Invalidate current session
- `POST /api/auth/logout/:id` - Invalidate specific session
- `POST /api/auth/logout/all` - Invalidate all user sessions
- `POST /api/auth/forgot-password` - Request password reset
- `GET /api/auth/forgot-password/:id` - Verify reset token and get email
- `POST /api/auth/forgot-password/:id` - Reset password with token

### User Management
- `GET /api/users` - List users (Admin/Moderator only)
- `GET /api/users/me` - Get current user profile
- `GET /api/users/me/tokens` - List active login sessions
- `GET /api/users/:id` - Get specific user profile
- `POST /api/users/:id/disable` - Disable user account (Admin only)

## Security Best Practices

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Role-based restrictions on access
3. **Secure Defaults**: Secure configuration by default
4. **Token Management**: Proper handling of authentication tokens
5. **Input Validation**: Joi validation on all user inputs
6. **Error Handling**: Custom exception handling with appropriate information disclosure
7. **Account Recovery**: Secure password reset workflow
8. **Password Policy**: Secure password hashing and handling
9. **Brute Force Protection**: Account lockout after failed login attempts
10. **Cache Security**: Proper implementation of caching with invalidation
