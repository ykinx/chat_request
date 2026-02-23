# Role-Based Ticketing System

A comprehensive ticket management system with role-based access control built with Next.js, TypeScript, and Prisma.

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
- **Real-time chat** - Conversation interface with message history
- **Ticket status management** - Open/Closed states
- **Assignment system** - Admins can assign tickets to IT staff

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Protected API routes
- Secure cookie storage
- Input validation

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (Prisma ORM)
- **Authentication**: JWT with cookies
- **Security**: bcrypt for password hashing

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
   ```bash
   # Copy the example env file
   cp .env.example .env
   ```

4. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

5. **Seed the database**
   ```bash
   npm run seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔐 Default Credentials

After seeding, you can log in with these accounts:

### Super Admin
- **Email**: superadmin@example.com
- **Password**: SuperAdmin123!

### Admin
- **Email**: admin@example.com
- **Password**: Admin123!

### IT
- **Email**: it@example.com
- **Password**: IT123!

### User
- **Email**: user@example.com
- **Password**: User123!

## 🏗️ Project Structure

```
src/
├── app/
│   ├── (auth)/          # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── api/             # API routes
│   │   ├── auth/        # Authentication endpoints
│   │   ├── tickets/     # Ticket management
│   │   └── messages/    # Message handling
│   ├── dashboard/       # User dashboard
│   ├── admin/           # Admin dashboard
│   ├── it/              # IT dashboard
│   ├── super-admin/     # Super admin panel
│   └── ticket/[id]/     # Ticket conversation page
├── components/          # Reusable components
│   └── DashboardLayout.tsx
├── lib/                 # Utility functions
│   ├── auth.ts          # Authentication utilities
│   ├── prisma.ts        # Database client
│   ├── utils.ts         # Helper functions
│   └── middleware.ts    # Auth middleware
prisma/
├── schema.prisma        # Database schema
└── seed.js              # Database seeder
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Tickets
- `GET /api/tickets` - Get tickets (role-based)
- `POST /api/tickets` - Create new ticket (users only)
- `GET /api/tickets/[id]` - Get specific ticket
- `PUT /api/tickets/[id]` - Update ticket (admin/IT)

### Messages
- `POST /api/messages` - Send message

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
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-super-secret-production-key"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### Build and Deploy
```bash
npm run build
npm start
```

## 📝 Future Enhancements

- [ ] Real-time messaging with WebSocket
- [ ] Email notifications
- [ ] File attachments in tickets
- [ ] Audit logging for all actions
- [ ] Rate limiting
- [ ] 2FA for super admin
- [ ] IP whitelisting
- [ ] Advanced ticket filtering
- [ ] User profile management
- [ ] Analytics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📄 License

This project is licensed under the MIT License.