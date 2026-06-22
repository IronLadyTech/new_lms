# IL LMS — Learning Management System

React LMS built from your Excalidraw pipeline: **Firebase + Zoho (parallel)**, student auth flow, admin dashboard, and super admin operations.

## Pipeline implemented

| Area | Features |
|------|----------|
| **Auth (Page 1)** | Email/password sign up & login, Google sign-in |
| **Home (Page 2)** | MBW & LEP courses, enroll, course detail |
| **Bottom nav** | HOME → dashboard, PROGRESS → tracking, PROFILE → settings |
| **Student** | Enrolled courses, last activity, pending assignments, streak, resources |
| **Admin** | Course CRUD, resources (video/PDF/PPT/mock test), user tracking |
| **Super Admin** | Assign admins, role CRUD (student/moderator/admin/superadmin) |
| **Data** | Firestore: `users`, `courses`, `resources`, `assignments`, `activities` |
| **Zoho** | Parallel sync on signup/enroll + activity notes |

## Quick start

1. **Install**

   ```bash
   npm install
   ```

2. **Firebase**

   - Create a project at [Firebase Console](https://console.firebase.google.com)
   - Enable **Authentication** → Email/Password + Google
   - Create **Firestore** database
   - Copy web app config into `.env` (from `.env.example`)

3. **Firestore rules**

   ```bash
   firebase deploy --only firestore:rules
   ```

   Or paste `firestore.rules` in the Firebase Console → Firestore → Rules.

4. **First super admin**

   After your first sign-up, in Firestore set:

   `users/{your-uid}` → `role: "superadmin"`

5. **Zoho (optional)**

   - [Zoho API Console](https://api-console.zoho.com/) → Server-based app
   - Add refresh token + client credentials to `.env`
   - Custom fields on Zoho **Leads** module: `Enrolled_Courses`, `LMS_Role`, etc. (see Admin → Zoho CRM setup)

6. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173

## Routes

| Path | Role |
|------|------|
| `/auth/login`, `/auth/signup` | Public |
| `/app/home` | Student — courses |
| `/app/dashboard` | Student — HOME tab |
| `/app/progress` | Student — tracking |
| `/app/profile` | Student — settings |
| `/admin` | Moderator+ |
| `/superadmin` | Super admin |

## Tech stack

- React 19 + Vite 6
- React Router 7
- Firebase Auth + Firestore
- Zoho CRM API (client-side refresh token — use a backend proxy in production)

## Production notes

- Move Zoho OAuth to a **backend** so secrets are not in the browser.
- Use **CloudFront / S3** for PDF/PPT; paste URLs in admin resources.
- YouTube links work as `resource.url` with type `video`.
