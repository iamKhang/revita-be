# User Management API Documentation (Medical Clinic System)

## Overview

This document describes the RESTful API endpoints for managing **Users** in the Medical Clinic Management System. It also outlines how to implement **Role-based Access Control (RBAC)** using **Guards** and **Policy/Middleware** in NestJS.

---

# I. API Endpoints

## 1. System Admin Endpoints (`/admin`)

| Method | Endpoint                | Description                                         |
| ------ | ----------------------- | --------------------------------------------------- |
| GET    | `/admin/users`          | List all users (optional filter by role)            |
| GET    | `/admin/users/{userId}` | Get user details by ID                              |
| POST   | `/admin/users`          | Create new user (ClinicAdmin, Doctor, Receptionist) |
| PUT    | `/admin/users/{userId}` | Update user information                             |
| DELETE | `/admin/users/{userId}` | Soft delete or deactivate user                      |

---

## 2. Clinic Admin Endpoints (`/clinics/{clinicId}`)

| Method | Endpoint                                 | Description                      |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/clinics/{clinicId}/doctors`            | List doctors of the clinic       |
| POST   | `/clinics/{clinicId}/doctors`            | Create a new doctor              |
| PUT    | `/clinics/{clinicId}/doctors/{doctorId}` | Update doctor information        |
| DELETE | `/clinics/{clinicId}/doctors/{doctorId}` | Remove a doctor                  |
| GET    | `/clinics/{clinicId}/receptionists`      | List receptionists of the clinic |
| POST   | `/clinics/{clinicId}/receptionists`      | Create a new receptionist        |

---

## 3. Receptionist Endpoints

| Method | Endpoint                           | Description                           |
| ------ | ---------------------------------- | ------------------------------------- |
| POST   | `/patients`                        | Register new patient                  |
| GET    | `/clinics/{clinicId}/patients`     | List patients who have visited clinic |
| PUT    | `/patients/{patientId}`            | Update patient profile                |
| POST   | `/appointments`                    | Book an appointment                   |
| GET    | `/clinics/{clinicId}/appointments` | List appointments at the clinic       |

---

## 4. Doctor Endpoints

| Method | Endpoint                              | Description                      |
| ------ | ------------------------------------- | -------------------------------- |
| GET    | `/doctors/{doctorId}/appointments`    | View assigned appointments       |
| GET    | `/doctors/{doctorId}/medical-records` | View medical records of patients |
| POST   | `/medical-records`                    | Create medical record            |
| PUT    | `/medical-records/{recordId}`         | Update medical record            |

---

## 5. Patient Endpoints

| Method | Endpoint                       | Description              |
| ------ | ------------------------------ | ------------------------ |
| POST   | `/patients/register`           | Self-register as patient |
| GET    | `/patients/me`                 | View own profile         |
| PUT    | `/patients/me`                 | Update own profile       |
| GET    | `/patients/me/appointments`    | View appointment history |
| GET    | `/patients/me/medical-records` | View own medical records |

---

# II. Role-Based Access Control (RBAC)

## 1. Roles Defined:

- `SYSTEM_ADMIN`
- `CLINIC_ADMIN`
- `RECEPTIONIST`
- `DOCTOR`
- `PATIENT`

## 2. How to Implement RBAC in NestJS

### Step 1: Define Roles Enum

```typescript
export enum Role {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}
```

### Step 2: Create Roles Decorator

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### Step 3: Implement Roles Guard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

### Step 4: Apply Guard & Decorator to Controller

```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN, Role.CLINIC_ADMIN)
@Get('/clinics/:clinicId/doctors')
findDoctors() {
  // Accessible only by SYSTEM_ADMIN and CLINIC_ADMIN
}
```

---

# III. Additional Notes

- **Ownership Policies**: For stricter control (e.g. ensure ClinicAdmin can only see their own clinic's data), implement additional ownership checks inside services.
- **Soft Delete**: Prefer soft delete (isActive flag) for users instead of hard deletion.
- **Auditing**: Consider logging user actions for traceability.

---

# IV. Future Improvements

- Implement CASL or similar library for fine-grained permissions.
- Add activity logs and notification system for user management events.
- Consider multi-role per user by adding a `UserRole` table if required.

---

**End of Document**

