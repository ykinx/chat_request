const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  // Initialize Socket.IO
  const { Server } = require('socket.io')
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  // Store io instance globally so API routes can access it
  globalThis.io = io

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Join a ticket room
    socket.on('join-ticket', (ticketId) => {
      socket.join(`ticket-${ticketId}`)
      console.log(`Socket ${socket.id} joined ticket-${ticketId}`)
    })

    // Leave a ticket room
    socket.on('leave-ticket', (ticketId) => {
      socket.leave(`ticket-${ticketId}`)
      console.log(`Socket ${socket.id} left ticket-${ticketId}`)
    })

    // Join user room for ticket updates
    socket.on('join-user', (userId) => {
      socket.join(`user-${userId}`)
      console.log(`Socket ${socket.id} joined user-${userId}`)
    })

    // Leave user room
    socket.on('leave-user', (userId) => {
      socket.leave(`user-${userId}`)
      console.log(`Socket ${socket.id} left user-${userId}`)
    })

    // Join admin room for all ticket updates
    socket.on('join-admin', () => {
      socket.join('admin-room')
      console.log(`Socket ${socket.id} joined admin-room`)
    })

    // Leave admin room
    socket.on('leave-admin', () => {
      socket.leave('admin-room')
      console.log(`Socket ${socket.id} left admin-room`)
    })

    // Join IT room for assigned ticket updates
    socket.on('join-it', (itId) => {
      socket.join(`it-${itId}`)
      console.log(`Socket ${socket.id} joined it-${itId}`)
    })

    // Leave IT room
    socket.on('leave-it', (itId) => {
      socket.leave(`it-${itId}`)
      console.log(`Socket ${socket.id} left it-${itId}`)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
