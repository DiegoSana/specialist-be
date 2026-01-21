# Verification Endpoints - cURL Test Commands

## Prerequisites

1. **Base URL**: `http://localhost:5000/api` (or your server URL)
2. **Get Authentication Token**: First, login or register to get a JWT token

---

## Step 1: Get Authentication Token

### Option A: Register a new user
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+5492944123456"
  }'
```

### Option B: Login with existing user
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Save the `accessToken` from the response** - you'll need it for all verification endpoints.

---

## Step 2: Set Your Token Variable

```bash
# Replace YOUR_TOKEN_HERE with the actual token from Step 1
TOKEN="YOUR_TOKEN_HERE"
```

---

## Phone Verification

### 1. Request Phone Verification (Send OTP)

```bash
curl -X POST http://localhost:5000/api/identity/verification/phone/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "message": "Verification code sent successfully"
}
```

**Note**: The phone number must be in E.164 format (e.g., `+5492944123456`). Make sure your user profile has a phone number set.

---

### 2. Confirm Phone Verification (Verify OTP)

```bash
curl -X POST http://localhost:5000/api/identity/verification/phone/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "code": "123456"
  }'
```

**Expected Response:**
```json
{
  "message": "Phone verified successfully"
}
```

**Note**: Replace `123456` with the actual OTP code sent to your phone via SMS.

---

## Email Verification

### 3. Request Email Verification (Send OTP)

```bash
curl -X POST http://localhost:5000/api/identity/verification/email/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "message": "Verification code sent successfully"
}
```

---

### 4. Confirm Email Verification (Verify OTP)

```bash
curl -X POST http://localhost:5000/api/identity/verification/email/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "code": "123456"
  }'
```

**Expected Response:**
```json
{
  "message": "Email verified successfully"
}
```

**Note**: Replace `123456` with the actual OTP code sent to your email.

---

## Verify Verification Status

### Check User Profile (includes verification status)

```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "id": "user-id",
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "User",
  "phone": "+5492944123456",
  "phoneVerified": true,
  "emailVerified": true,
  ...
}
```

---

## Error Scenarios

### 1. Missing Phone Number (Phone Verification)
```bash
# If user doesn't have a phone number set
curl -X POST http://localhost:5000/api/identity/verification/phone/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "User does not have a phone number"
}
```

### 1b. Phone Already Verified (Phone Verification Request)
```bash
# If phone is already verified
curl -X POST http://localhost:5000/api/identity/verification/phone/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Phone is already verified"
}
```

### 2. Invalid Phone Format
```bash
# If phone is not in E.164 format
curl -X POST http://localhost:5000/api/identity/verification/phone/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Invalid phone format. Must be in E.164 format (e.g., +5492944123456)"
}
```

### 3. Invalid/Expired Code
```bash
curl -X POST http://localhost:5000/api/identity/verification/phone/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "code": "000000"
  }'
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Invalid or expired verification code"
}
```

### 4. Already Verified (Confirmation)
```bash
# If phone/email is already verified when trying to confirm
curl -X POST http://localhost:5000/api/identity/verification/phone/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "code": "123456"
  }'
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Phone is already verified"
}
```

### 4b. Email Already Verified (Email Verification Request)
```bash
# If email is already verified
curl -X POST http://localhost:5000/api/identity/verification/email/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Email is already verified"
}
```

### 5. Missing Authentication Token
```bash
curl -X POST http://localhost:5000/api/identity/verification/phone/request \
  -H "Content-Type: application/json"
```

**Expected Error:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## Complete Test Flow Example

```bash
# 1. Set base URL and get token
BASE_URL="http://localhost:5000/api"

# 2. Login (or register)
TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.accessToken')

echo "Token: $TOKEN"

# 3. Request phone verification
echo "Requesting phone verification..."
curl -X POST $BASE_URL/identity/verification/phone/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"

# 4. Wait for SMS, then confirm (replace CODE with actual code)
echo "Confirming phone verification..."
curl -X POST $BASE_URL/identity/verification/phone/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code": "123456"}'

# 5. Request email verification
echo "Requesting email verification..."
curl -X POST $BASE_URL/identity/verification/email/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"

# 6. Wait for email, then confirm (replace CODE with actual code)
echo "Confirming email verification..."
curl -X POST $BASE_URL/identity/verification/email/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code": "123456"}'

# 7. Check verification status
echo "Checking verification status..."
curl -X GET $BASE_URL/users/me \
  -H "Authorization: Bearer $TOKEN" | jq '{phoneVerified, emailVerified}'
```

---

## Environment Variables Required

Make sure these are set in your `.env` file:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
```

**⚠️ Important**: Use **production credentials**, not test credentials. Test credentials cannot send real SMS/Email messages and will result in the error: "Resource not accessible with Test Account Credentials".

---

## Troubleshooting

### Error: "Resource not accessible with Test Account Credentials"

**Cause**: You're using Twilio test credentials (Account SID starting with `AC` but from a test account).

**Solution**: 
1. Get production credentials from your Twilio Console
2. Update your `.env` file with production credentials:
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Production Account SID
   TWILIO_AUTH_TOKEN=your_production_auth_token
   TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. Restart your application

**Note**: For testing purposes, you can verify phone numbers in the Twilio Console to use them with test credentials, but production credentials are recommended.

### Error: "Invalid phone number format"

**Cause**: Phone number is not in E.164 format.

**Solution**: Use E.164 format: `+[country code][number]` (e.g., `+5492944123456` for Argentina)

### Error: "Maximum number of attempts reached"

**Cause**: Too many verification requests in a short time.

**Solution**: Wait a few minutes before trying again.

---

## Notes

- **Phone Format**: Must be in E.164 format (e.g., `+5492944123456`)
- **OTP Codes**: Codes are sent via SMS (phone) or Email (email) through Twilio Verify
- **Code Expiration**: OTP codes expire after a certain time (configured in Twilio)
- **Rate Limiting**: Twilio may rate limit verification requests
- **Test Credentials**: Cannot send real SMS/Email. Use production credentials for real verification.

