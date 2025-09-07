# Postman Collections for Revita API

## 📁 Files Overview

### Collections
1. **`work-session-api.postman_collection.json`** - Complete Work Session API collection
2. **`work-session-quick-test.postman_collection.json`** - Quick test for essential scenarios
3. **`revita-full-api-with-variables.postman_collection.json`** - Full system API collection

### Environment
- **`revita-local-environment.json`** - Local development environment variables

### Documentation
- **`WORK_SESSION_POSTMAN_GUIDE.md`** - Detailed testing guide
- **`README.md`** - This file

## 🚀 Quick Start

### 1. Import vào Postman

```bash
# Import collections
work-session-api.postman_collection.json
work-session-quick-test.postman_collection.json

# Import environment
revita-local-environment.json
```

### 2. Chọn Environment
- Chọn "Revita Local Environment" trong Postman

### 3. Chạy Test

#### Option A: Quick Test (Recommended for first time)
1. Chọn collection "Work Session Quick Test"
2. Click "Run"
3. Chọn environment "Revita Local Environment"
4. Click "Run Work Session Quick Test"

#### Option B: Full Test
1. Chọn collection "Work Session Management API"
2. Click "Run"
3. Chọn environment "Revita Local Environment"
4. Click "Run Work Session Management API"

## 📋 Test Scenarios

### Quick Test (8 steps)
1. ✅ Login Doctor
2. ✅ Create Doctor Schedule
3. ✅ Test Conflict Validation
4. ✅ View My Schedule
5. ✅ Update Schedule
6. ✅ Login Admin
7. ✅ Admin View All Schedules
8. ✅ Admin Approve Schedule

### Full Test (25+ requests)
- Authentication (3 requests)
- Create Work Sessions (4 requests)
- View Work Sessions (7 requests)
- Update Work Sessions (3 requests)
- Delete Work Sessions (2 requests)
- Permission Tests (3 requests)

## 🔧 Environment Variables

### Required Variables
```json
{
  "baseUrl": "http://localhost:3000/api",
  "doctorIdentifier": "nguyenminhduc@clinic.com",
  "doctorPassword": "123456",
  "adminIdentifier": "admin@clinic.com",
  "adminPassword": "123456",
  "technicianIdentifier": "technician@clinic.com",
  "technicianPassword": "123456"
}
```

### Auto-generated Variables (saved during test)
```json
{
  "doctorToken": "jwt_token_here",
  "adminToken": "jwt_token_here",
  "technicianToken": "jwt_token_here",
  "doctorId": "doctor_uuid",
  "adminId": "admin_uuid",
  "technicianId": "technician_uuid",
  "workSessionId": "work_session_uuid"
}
```

## 🎯 Key Features Tested

### ✅ Work Session Management
- Create multiple work sessions
- View schedules (own + admin view)
- Update schedules
- Delete schedules
- Filter by date, user, booth

### ✅ Conflict Validation
- Overlapping time slots
- Same user, different sessions
- Real-time validation

### ✅ Permission System
- Doctor: Manage own schedule only
- Technician: Manage own schedule only
- Admin: Manage all schedules
- Receptionist: View only

### ✅ Status Management
- PENDING → APPROVED → IN_PROGRESS → COMPLETED
- CANCELED status

## 🐛 Troubleshooting

### Common Issues

#### 1. 401 Unauthorized
```bash
# Solution: Re-run authentication requests
1. Login as Doctor
2. Login as Admin
3. Login as Technician
```

#### 2. 404 Not Found
```bash
# Check environment variables
- doctorId, adminId, technicianId
- boothId, serviceIds
```

#### 3. 400 Bad Request
```bash
# Expected for conflict validation
- Overlapping schedules
- Invalid time ranges
- Permission violations
```

#### 4. 500 Internal Server Error
```bash
# Check server status
npm run start:dev
# Check database connection
# Check Prisma schema
```

## 📊 Expected Results

### Success Cases (200/201)
- ✅ Authentication successful
- ✅ Schedule creation successful
- ✅ Schedule viewing successful
- ✅ Schedule update successful
- ✅ Schedule deletion successful

### Expected Failures (400/403)
- ❌ Conflict validation (400) - **This is correct behavior**
- ❌ Permission violations (403) - **This is correct behavior**
- ❌ Invalid data (400) - **This is correct behavior**

## 🔄 Running Tests

### Manual Testing
1. Import collections
2. Select environment
3. Run individual requests
4. Check console logs for results

### Automated Testing
1. Select collection
2. Click "Run"
3. Review test results
4. Check console for ✅/❌ indicators

### CI/CD Integration
```bash
# Install Newman (Postman CLI)
npm install -g newman

# Run collection
newman run work-session-api.postman_collection.json \
  -e revita-local-environment.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

## 📝 Notes

- **Base URL:** `http://localhost:3000/api`
- **Authentication:** JWT Bearer tokens
- **Database:** PostgreSQL with Prisma
- **Validation:** Real-time conflict detection
- **Permissions:** Role-based access control

## 🆘 Support

If you encounter issues:
1. Check server logs
2. Verify environment variables
3. Ensure database is running
4. Check Prisma schema
5. Review API documentation

---

**Happy Testing! 🎉**

