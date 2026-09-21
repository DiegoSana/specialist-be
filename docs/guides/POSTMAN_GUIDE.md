# Postman Collection Guide

## 📦 Import the Collection

1. Open Postman
2. Click on **Import** (top left button)
3. Select the files:
   - `Especialistas_API.postman_collection.json` (Collection)
   - `Especialistas_API.postman_environment.json` (Environment - optional but recommended)

## 🔧 Configure the Environment

### Environment Variables

- **`base_url`**: API base URL
  - Development: `http://0.0.0.0:5000` (use `0.0.0.0` instead of `localhost` or `127.0.0.1`)
  - Production: `https://specialist-api.fly.dev`

- **`token`**: JWT token (automatically set after login)
- **`user_id`**: Current user ID (automatically set)

### Manual Configuration

If you don't import the environment, you can create one manually:

1. Click the **gear icon** (⚙️) in the top right corner
2. Click **Add** to create a new environment
3. Add the variables mentioned above

## 🚀 Recommended Usage Flow

### 1. Authentication

1. **Register - Client** or **Register - Professional**
   - Creates a new user
   - Token is automatically saved in the `token` variable

2. **Login**
   - If you already have a user, use this endpoint
   - Token is automatically saved

### 2. For Clients

1. **Get My Profile** - View your profile
2. **Search Professionals** - Search for professionals
3. **Get Professional by ID** - View professional details
4. **Create Service Request** - Create a service request
5. **Get My Requests** - View your requests
6. **Create Review** - Leave a review (after completing a service)

### 3. For Professionals

1. **Get All Trades** - View available trades
2. **Create Professional Profile** - Create your professional profile
3. **Get My Professional Profile** - View your professional profile
4. **Update Professional Profile** - Update your profile
5. **Get Available Requests** - View public requests matching your trades
6. **Express Interest** - Show interest in a public request
7. **Update Request Status** - Accept/complete requests

### 4. For Administrators

1. **Get All Users** - View all users
2. **Get User by ID** - View user details
3. **Update User Status** - Change user status (ACTIVE, SUSPENDED, BANNED)
4. **Get All Professionals** - View all professional profiles
5. **Update Professional Status** - Verify/reject professionals (VERIFIED, REJECTED)

## 📋 Complete Use Cases

### Use Case 1: Client searches and hires a professional

1. **Register - Client** → Get token
2. **Search Professionals** → Search by trade, zone, rating
3. **Get Professional by ID** → View full details
4. **Create Service Request** → Create service request
5. **Get My Requests** → View request status
6. (After service completion) **Create Review** → Leave review

### Use Case 2: Professional registers and creates profile

1. **Register** → Create account
2. **Get All Trades** → View available trades
3. **Create Professional Profile** → Create profile with trade, description, etc.
4. **Get My Professional Profile** → Verify created profile
5. **Get Available Requests** → View available public requests
6. **Express Interest** → Show interest in a request
7. **Update Request Status** → Accept request (status: CONTACT_RELEASED)
8. **Update Request Status** → Finish work (status: FINISHED)

### Use Case 3: Admin verifies professionals

1. **Login** (as admin) → Get token
2. **Get All Professionals** → View pending professionals
3. **Get Professional by ID** → Review details
4. **Update Professional Status** → Verify (status: VERIFIED) or reject (status: REJECTED)

### Use Case 4: Contact between users

1. **Login** → Get token
2. **Search Professionals** → Find professional
3. **Get Professional by ID** → Get professional's userId
4. **Create Contact Request** → Send contact message

## 🔐 Authentication

All protected endpoints require the header:

```
Authorization: Bearer {{token}}
```

Postman handles this automatically if:
- You've imported the environment
- You've executed a login/register endpoint (token is saved automatically)

## 📝 Important Notes

### Enum Values

**UserStatus:**
- `PENDING`
- `ACTIVE`
- `SUSPENDED`
- `BANNED`

**ProfessionalStatus:**
- `PENDING_VERIFICATION`
- `VERIFIED`
- `REJECTED`

**RequestStatus:**
- `DRAFT`, `PUBLISHED`, `SENT`, `CONTACT_RELEASED`, `IN_PROGRESS`, `FINISHED`, `CLOSED`, `UNDER_REVIEW`
- `EXPIRED`, `NO_RESPONSE`, `REJECTED`, `CANCELLED`, `NOT_COMPLETED`, `INTERRUPTED`, `ABANDONED`

### Public Endpoints (no authentication)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/trades`
- `GET /api/trades/:id`
- `GET /api/professionals`
- `GET /api/professionals/:id`
- `GET /api/professionals/:professionalId/reviews`

### Endpoints Requiring Authentication

All other endpoints require JWT token.

### Role-Specific Endpoints

- **Client**: Can create requests and reviews
- **Professional**: Can create/update their profile and manage requests
- **Admin**: Full access to admin endpoints

## 🧪 Testing

Each authentication request has a test script that:
- Automatically saves the `token` in the environment variable
- Saves the `user_id` for later use

You can add more custom tests in the **Tests** tab of each request.

## 🔄 Update Variables

If you need to change the `base_url` or use a different token:

1. Select the environment in the top right dropdown
2. Click the **eye icon** (👁️) to view/edit variables
3. Modify the values as needed

## 📚 Collection Structure

```
Specialist API
├── Authentication
│   ├── Register
│   └── Login
├── Users
│   ├── Get My Profile
│   ├── Update My Profile
│   └── Activate Client Profile
├── Trades
│   ├── Get All Trades
│   ├── Get Trade by ID
│   └── Get Trades with Professionals
├── Professionals
│   ├── Search Professionals
│   ├── Get Professional by ID
│   ├── Get My Professional Profile
│   ├── Create Professional Profile
│   ├── Update Professional Profile
│   ├── Add Gallery Item
│   └── Remove Gallery Item
├── Requests
│   ├── Create Service Request
│   ├── Get My Requests
│   ├── Get Available Requests
│   ├── Get Request by ID
│   ├── Update Request Status
│   ├── Accept Quote
│   ├── Express Interest
│   ├── Remove Interest
│   ├── Get Interested Professionals
│   └── Assign Professional
├── Reviews
│   ├── Get Professional Reviews
│   ├── Get Review by ID
│   ├── Create Review
│   ├── Update Review
│   └── Delete Review
├── Contact
│   ├── Create Contact Request
│   └── Get My Contacts
├── Storage
│   ├── Upload File
│   ├── Get Public File
│   ├── Get Private File
│   └── Delete File
└── Admin
    ├── Get All Users
    ├── Get User by ID
    ├── Update User Status
    ├── Get All Professionals
    └── Update Professional Status
```

## 🐛 Troubleshooting

### Error 401 Unauthorized
- Verify token is saved in the `token` variable
- Make sure you've executed login/register first
- Check that the token hasn't expired (default expiration is 7 days)

### Error 403 Forbidden
- Verify your user has the correct role for the endpoint
- Some endpoints require specific roles (ADMIN, PROFESSIONAL, CLIENT)

### Error 404 Not Found
- Verify `base_url` is correct
- Make sure the API is running
- Verify IDs in parameters are valid

### Variables not updating
- Make sure you have the correct environment selected
- Verify test scripts are executing correctly

## 📞 Support

If you encounter problems or need to add more endpoints, check:
- `docs/API.md` - General API documentation
- Controllers in `src/*/presentation/*.controller.ts` - Available endpoints
