# 🧪 Testing Guide - Notification System

## Quick Start (5 Minutes)

### Step 1: Restart the Server
```powershell
# Stop current server (Ctrl+C)
npm run dev
```

### Step 2: Open Two Browsers/Windows
- **Window A**: Login as `user@example.com` (regular user)
- **Window B**: Login as `admin@example.com` (admin)

### Step 3: Test Unread Counters

#### Create a Ticket (Window A - User)
1. Go to dashboard
2. Create a new ticket with description "Testing notifications"
3. Navigate to the ticket chat page

#### Reply as Admin (Window B - Admin)
1. You should see the new ticket in admin dashboard
2. Click on it to open
3. Send a reply: "Hello from admin!"

#### Check Unread Badge (Window A - User)
1. **Don't look at the ticket yet**
2. Go back to dashboard or open another tab
3. You should see a **red badge** with "1" on the ticket in sidebar
4. If you have browser notifications enabled, you'll get a push notification

#### Auto-Mark as Read (Window A - User)
1. Click on the ticket to open it
2. The unread badge should disappear immediately
3. Switch back to admin window - you won't see any change (each user has their own count)

### Step 4: Test Browser Notifications

#### Enable Notifications
1. First interaction (click anywhere) will trigger permission request
2. Click "Allow" when browser asks
3. Now you'll receive notifications when tab is hidden

#### Test Notification Flow
1. **Window A**: Hide/minimize the tab
2. **Window B**: Send another message
3. **Window A**: You should see a browser notification!
4. Click the notification → window focuses and shows the ticket

### Step 5: Test Duplicate Prevention

#### Rapid Fire Messages (Window B)
1. Send 3 messages quickly
2. Switch to Window A
3. You should see badge showing "3" (not duplicates)

#### Refresh Page (Window A)
1. Press F5 while on ticket with unread messages
2. Badge count should persist (stored in DB!)
3. This proves it's not just client-side state

---

## Advanced Testing Scenarios

### Multi-Ticket Test
1. Create 5 different tickets (as User)
2. As Admin, reply to all of them
3. Go back to User window
4. You should see badges on all 5 tickets with correct counts

### IT Assignment Test
1. Create ticket (User)
2. Assign to IT staff (Admin)
3. IT user should now track unread counts for that ticket
4. Send message (Admin) → IT user gets notification

### Closed Ticket Test
1. Close a ticket (Admin)
2. Try to send message → Should show error
3. No unread count should increment

---

## What to Look For (Bugs)

### ❌ Common Issues

1. **Badge doesn't appear**
   - Check browser console for errors
   - Verify Socket.IO connection (look for "joined ticket-xxx" in logs)
   - Check if `/api/tickets/unread-count` returns data

2. **Notification spam**
   - Make sure tab visibility detection works
   - Check `isTabVisible` state in console
   - Verify you're not sending to yourself

3. **Counts don't reset**
   - Check if `mark-as-read` API is called (Network tab)
   - Verify socket event is emitted
   - Check MongoDB directly: `db.ticketparticipants.find()`

4. **Duplicate messages**
   - Should be prevented by ID check
   - Check `if (prev.find(m => m.id === message.id))` logic

---

## Console Logs to Watch

### Server Logs (Good Signs)
```
✓ Client connected: abc123
✓ Socket abc123 joined ticket-xyz789
✓ Incremented unread counts for 2 participants in ticket xyz789
✓ Marked messages as read for user user123 in ticket xyz789
```

### Client Console (Good Signs)
```
✓ Received new message via Socket.IO
✓ Tab visible, marking messages as read for ticket: xyz789
✓ Messages marked as read for user user123 in ticket xyz789
```

---

## Database Verification

### Check Participants
```javascript
// MongoDB shell
db.ticketparticipants.find().pretty()

// Should show documents like:
{
  "_id": ObjectId("..."),
  "ticket_id": ObjectId("xyz789"),
  "user_id": ObjectId("user123"),
  "unread_count": 5,
  "last_read_at": ISODate("2026-03-23T..."),
  "created_at": ISODate("2026-03-23T..."),
  "updated_at": ISODate("2026-03-23T...")
}
```

### Verify Indexes
```javascript
db.ticketparticipants.getIndexes()

// Should show:
[
  { key: { _id: 1 }, name: "_id_" },
  { 
    key: { ticket_id: 1, user_id: 1 }, 
    name: "ticket_id_1_user_id_1", 
    unique: true 
  },
  { 
    key: { user_id: 1, unread_count: -1 }, 
    name: "user_id_1_unread_count_-1" 
  }
]
```

---

## Performance Testing

### Load Test (Optional)
1. Create 100 tickets
2. Send 10 messages to each
3. Open ticket list → should load in <2 seconds
4. Unread badges should appear instantly

### Concurrent Users Test
1. Open 5 browser windows (different users)
2. All join same ticket
3. User A sends message
4. All other 4 should get notification
5. User B opens ticket → only B's count resets

---

## Success Criteria ✅

You know it's working when:

1. ✅ Red badges appear on tickets with unread messages
2. ✅ Badge count matches actual unread messages
3. ✅ Badges disappear when you open the ticket
4. ✅ Browser notifications show when tab is hidden
5. ✅ Counts persist after page refresh
6. ✅ No duplicate messages or counts
7. ✅ No notifications sent to message sender
8. ✅ Real-time sync across multiple windows

---

## Troubleshooting Commands

### Reset Everything
```javascript
// MongoDB shell - DANGER: Deletes all participant data!
db.ticketparticipants.deleteMany({})

// Then restart server to recreate participants
```

### Force Unread Sync
```javascript
// In browser console (on ticket page)
fetch('/api/tickets/unread-count?ticket_id=YOUR_TICKET_ID')
  .then(r => r.json())
  .then(d => console.log('Unread count:', d.unread_count))
```

### Check Socket Connection
```javascript
// In browser console
console.log('Socket connected:', socket?.connected)
console.log('Socket rooms:', socket?.rooms)
```

---

## Report Format

When reporting bugs, include:

```
🐛 Bug Report

Steps to Reproduce:
1. Login as User A
2. Create ticket
3. Login as User B
4. Reply to ticket
5. Check User A dashboard

Expected: Red badge with "1"
Actual: No badge appears

Console Errors: [paste error]
Server Logs: [paste log]
Browser: Chrome v122
OS: Windows 11
```

---

**Happy Testing! 🎉**
