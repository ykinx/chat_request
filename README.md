# Role-Based Ticketing System

A comprehensive real-time ticket management system with role-based access control, built with Next.js, TypeScript, MongoDB, and Socket.IO.

## 🚀 Features

### Authentication & Authorization
- **Role-based access control** (Super Admin, Admin, IT, User)
- **JWT authentication** with secure cookie storage
- **Password hashing** with bcrypt
- **Session management** with automatic logout

### User Roles & Permissions

#### Super Admin (1-2 accounts)
- Create/delete Admin and IT accounts
- Reset any user's password
- Suspend/activate user accounts
- View audit logs
- Cannot be deleted if only one exists

#### Admin
- View all tickets
- Assign tickets to IT staff
- Close tickets
- Access all conversations

#### IT
- View assigned tickets only
- Chat in assigned tickets
- Update ticket status

#### User
- Create new tickets
- View own tickets
- Chat in own tickets

### Ticket System
- **Multi-ticket support** - Users can create multiple tickets
- **Real-time chat** - Live conversation via Socket.IO with message history
- **Ticket status management** - Open / In Progress / Closed states
- **Assignment system** - Admins can assign tickets to IT staff
- **Ticket participants** - Track read/unread status per user
- **File attachments** - Upload images (JPEG, PNG, GIF, WebP up to 10MB)
- **Unread message tracking** - Badge counts and mark-as-read

### Notifications
- **Browser push notifications** - Native Notification API support
- **Mobile-friendly** - PWA-aware with iOS/Android handling
- **In-app toast fallback** - When browser notifications are blocked
- **Sound & haptic feedback** - Audio alerts and device vibration
- **Tab visibility detection** - Notifications only when tab is hidden

### Analytics Dashboard
- **Ticket statistics** - Total, open, in-progress, and closed counts
- **Category distribution** - Visual breakdown by ticket category
- **Tickets per day** - 7-day trend charts
- **Status trends** - Track open/in-progress/closed over time
- **Resolution rate** - Percentage of resolved tickets

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Protected API routes
- Secure cookie storage
- Input validation with Zod
- Audit logging for all actions

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Next.js API Routes + Custom Node.js Server
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO (WebSocket + polling)
- **Authentication**: JWT with HTTP-only cookies
- **Security**: bcrypt for password hashing, Zod for validation
- **Charts**: Recharts for analytics visualization
- **Alerts**: SweetAlert2

## 📋 Prerequisites

- Node.js 18+
- npm or yarn

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chat-request
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```bash
   MONGODB_URI="mongodb://localhost:27017/ticket-system"
   JWT_SECRET="your-secret-key"
   PORT=3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔐 Default Credentials

Register accounts via `/register` or create them programmatically. The first registered user can be promoted to Super Admin.

## 🏗️ Project Structure

```
src/
├── app/
│   ├── (auth)/              # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── api/                 # API routes
│   │   ├── auth/            # Auth (login, register, logout, me)
│   │   ├── tickets/         # Ticket CRUD, unread count, mark-as-read
│   │   ├── messages/        # Message handling
│   │   ├── users/           # User management
│   │   ├── analytics/       # Dashboard analytics
│   │   ├── audit-logs/      # Audit log viewer
│   │   └── upload/          # File/image upload
│   ├── dashboard/           # Role-based dashboards
│   │   ├── admin/
│   │   ├── it/
│   │   └── super-admin/
│   └── tickets/[id]/        # Ticket conversation page
├── components/              # Reusable components
│   ├── layout/
│   │   └── DashboardLayout.tsx
│   ├── GlobalNotificationHandler.tsx
│   ├── MobileNotificationPrompt.tsx
│   └── Providers.tsx
├── lib/                     # Utility functions
│   ├── auth.ts              # Authentication utilities
│   ├── mongodb.ts           # MongoDB/Mongoose connection
│   ├── socket.tsx           # Socket.IO client provider
│   ├── notifications.ts     # Browser notification manager
│   ├── audit.ts             # Audit logging
│   ├── ticket-participant.ts # Participant/read-status helpers
│   ├── middleware.ts         # Auth middleware
│   └── utils.ts             # Helper functions
├── models/                  # Mongoose models
│   ├── User.ts
│   ├── Ticket.ts
│   ├── Message.ts
│   ├── AuditLog.ts
│   ├── TicketParticipant.ts
│   └── index.ts
└── types/                   # TypeScript type definitions
server.js                    # Custom Node.js server with Socket.IO
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Tickets
- `GET /api/tickets` - Get tickets (role-based filtering)
- `POST /api/tickets` - Create new ticket (users only)
- `GET /api/tickets/[id]` - Get specific ticket
- `PUT /api/tickets/[id]` - Update ticket (admin/IT)
- `GET /api/tickets/unread-count` - Get unread ticket count
- `POST /api/tickets/mark-as-read` - Mark messages as read

### Messages
- `POST /api/messages` - Send message

### Users
- `GET /api/users` - List users (admin/super-admin)
- `GET /api/users/[id]` - Get specific user

### Analytics
- `GET /api/analytics` - Dashboard analytics data (admin/IT)

### Audit Logs
- `GET /api/audit-logs` - View audit trail (super-admin)

### Upload
- `POST /api/upload` - Upload image attachment (all roles)

## 🛡️ Security Implementation

### Password Security
- Passwords are hashed using bcrypt with 12 salt rounds
- Never stored in plain text
- Secure comparison during authentication

### Authentication
- JWT tokens with 24-hour expiration
- HTTP-only cookies for token storage
- Role validation on every request
- Automatic session cleanup

### Authorization
- Role-based access control middleware
- Fine-grained permissions per operation
- Server-side validation (never trust frontend)
- Forbidden access returns 403 status

### Input Validation
- Server-side validation for all inputs
- Sanitization of user data
- Type checking with TypeScript

## 🧪 Testing Checklist

✅ Login with all roles
✅ User registration (role automatically set to 'user')
✅ Multi-ticket creation
✅ IT assignment functionality
✅ Ticket closing functionality
✅ Role restriction enforcement
✅ Forbidden access protection
✅ Super admin account protection
✅ Conversation messaging
✅ Ticket status updates

## 🚀 Deployment

### Environment Variables
Set the following in production:
```bash
MONGODB_URI="your-production-mongodb-uri"
JWT_SECRET="your-super-secret-production-key"
PORT=3000
```

### Build and Deploy
```bash
npm run build
npm start
```

## 📝 Future Enhancements

- [ ] Email notifications
- [ ] Rate limiting
- [ ] 2FA for super admin
- [ ] IP whitelisting
- [ ] Advanced ticket filtering
- [ ] User profile management
- [ ] SLA tracking
- [ ] Export tickets to CSV/PDF

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📄 License

This project is licensed under the MIT License.