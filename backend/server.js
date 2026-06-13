const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

const Room = require('./models/Room')
const { generateRoomId } = require('./utils/helpers')

const app = express()
const server = http.createServer(app)

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}))

app.use(express.json())

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
})

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whiteboard', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err))

// Store active rooms and users in memory
const activeRooms = new Map()
const activeUsers = new Map()

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Create room
  socket.on('create-room', async (data) => {
    try {
      const { roomId, userName, roomType, isCreator } = data

      // Create room in database
      const room = new Room({
        roomId,
        creatorId: socket.id,
        roomType,
        createdAt: new Date(),
        canvasData: null
      })
      await room.save()

      // Add room to active rooms
      activeRooms.set(roomId, {
        roomId,
        creatorId: socket.id,
        roomType,
        users: [],
        canvasData: null
      })

      // Join the room
      socket.join(roomId)
      
      // Add user to room
      const user = {
        id: socket.id,
        name: userName,
        isCreator: true,
        permission: 'edit',
        isOnline: true
      }

      activeUsers.set(socket.id, { ...user, roomId })
      activeRooms.get(roomId).users.push(user)

      socket.emit('room-created', {
        roomId,
        room: activeRooms.get(roomId),
        users: activeRooms.get(roomId).users
      })

      console.log(`Room ${roomId} created by ${userName}`)
    } catch (error) {
      console.error('Error creating room:', error)
      socket.emit('error', { message: 'Failed to create room' })
    }
  })

  // Join room
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userName, isCreator } = data

      // Check if room exists
      let room = activeRooms.get(roomId)
      if (!room) {
        // Try to load from database
        const dbRoom = await Room.findOne({ roomId })
        if (!dbRoom) {
          socket.emit('room-not-found')
          return
        }
        room = {
          roomId: dbRoom.roomId,
          creatorId: dbRoom.creatorId,
          roomType: dbRoom.roomType,
          users: [],
          canvasData: dbRoom.canvasData
        }
        activeRooms.set(roomId, room)
      }

      const user = {
        id: socket.id,
        name: userName,
        isCreator: isCreator || false,
        permission: 'edit', // Default permission
        isOnline: true
      }

      // Private Room Logic
      if (room.roomType === 'private' && socket.id !== room.creatorId && !isCreator) {
        // Notify creator
        const creatorSocket = io.sockets.sockets.get(room.creatorId)
        if (creatorSocket) {
          creatorSocket.emit('join-request', {
            requestSocketId: socket.id,
            userName: userName
          })
        }
        // Make user wait
        socket.emit('waiting-for-approval')
        activeUsers.set(socket.id, { ...user, roomId, isWaiting: true }) // Store user temporarily
        return;
      }

      // Join the room (for public rooms or approved users)
      socket.join(roomId)
      activeUsers.set(socket.id, { ...user, roomId })

      // Prevent user duplication by checking if they're already in the list
      const userExists = room.users.some(u => u.id === socket.id)
      if (!userExists) {
        room.users.push(user)
      }

      // Send room data to the new user
      socket.emit('room-joined', {
        room,
        users: room.users,
        permission: user.permission
      })

      // Send canvas data if exists
      if (room.canvasData) {
        socket.emit('canvas-data', room.canvasData)
      }

      // Notify other users
      socket.to(roomId).emit('user-joined', {
        user,
        users: room.users
      })

      console.log(`${userName} joined room ${roomId}`)
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  })

  // Handle join request approval
  socket.on('approve-join-request', (data) => {
    const { roomId, requestSocketId } = data;
    const room = activeRooms.get(roomId);
    
    // Security check: only creator can approve
    if (!room || socket.id !== room.creatorId) return;
    
    const requestingUser = activeUsers.get(requestSocketId)
    const requestingSocket = io.sockets.sockets.get(requestSocketId)
    
    if (room && requestingUser && requestingSocket) {
      delete requestingUser.isWaiting
      room.users.push(requestingUser)
      
      requestingSocket.join(roomId)
      
      // Send approval and room data to the user
      requestingSocket.emit('room-joined', {
        room,
        users: room.users,
        permission: requestingUser.permission
      })

      // Notify everyone else
      io.to(roomId).emit('user-joined', {
        user: requestingUser,
        users: room.users
      })
    }
  })
  
  // Handle join request rejection
  socket.on('reject-join-request', (data) => {
    const { roomId, requestSocketId } = data;
    const room = activeRooms.get(roomId);
    
    if (!room || socket.id !== room.creatorId) return;

    const requestingSocket = io.sockets.sockets.get(requestSocketId)
    if (requestingSocket) {
      requestingSocket.emit('join-request-rejected')
    }
    activeUsers.delete(requestSocketId)
  })

  // Handle drawing data
  socket.on('drawing', (data) => {
    const user = activeUsers.get(socket.id)
    if (!user || user.permission !== 'edit') return

    const room = activeRooms.get(user.roomId)
    if (!room) return

    // Broadcast drawing data to other users in the room
    io.to(user.roomId).emit('drawing', data.data)

    // Update canvas data in room
    // Note: In a production app, you might want to store incremental changes
    // rather than the entire canvas state
  })

  // Handle canvas state updates
  socket.on('canvas-update', async (data) => {
    const user = activeUsers.get(socket.id)
    if (!user || user.permission !== 'edit') return

    const room = activeRooms.get(user.roomId)
    if (!room) return

    // Update canvas data
    room.canvasData = data.canvasData

    // Save to database
    try {
      await Room.findOneAndUpdate(
        { roomId: user.roomId },
        { canvasData: data.canvasData }
      )
    } catch (error) {
      console.error('Error saving canvas data:', error)
    }

    // Broadcast to other users
    socket.to(user.roomId).emit('canvas-state', data.canvasData)
  })

  // Clear canvas
  socket.on('clear-canvas', async (data) => {
    const user = activeUsers.get(socket.id)
    if (!user || user.permission !== 'edit') return

    const room = activeRooms.get(user.roomId)
    if (!room) return

    // Clear canvas data
    room.canvasData = null

    // Save to database
    try {
      await Room.findOneAndUpdate(
        { roomId: user.roomId },
        { canvasData: null }
      )
    } catch (error) {
      console.error('Error clearing canvas data:', error)
    }

    // Broadcast to all users in room
    io.to(user.roomId).emit('clear-canvas')
  })

  // Leave room
  socket.on('leave-room', (data) => {
    const user = activeUsers.get(socket.id)
    if (!user) return

    const room = activeRooms.get(user.roomId)
    if (room) {
      // Remove user from room
      room.users = room.users.filter(u => u.id !== socket.id)
      
      // Leave socket room
      socket.leave(user.roomId)
      
      // Notify other users
      socket.to(user.roomId).emit('user-left', {
        userId: socket.id,
        users: room.users
      })

      // If room is empty, remove it from active rooms
      if (room.users.length === 0) {
        activeRooms.delete(user.roomId)
      }
    }

    activeUsers.delete(socket.id)
    console.log(`User ${user.name} left room ${user.roomId}`)
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id)
    if (user) {
      const room = activeRooms.get(user.roomId)
      if (room) {
        // Remove user from room
        room.users = room.users.filter(u => u.id !== socket.id)
        
        // Notify other users
        socket.to(user.roomId).emit('user-left', {
          userId: socket.id,
          users: room.users
        })

        // If room is empty, remove it from active rooms
        if (room.users.length === 0) {
          activeRooms.delete(user.roomId)
        }
      }
      
      activeUsers.delete(socket.id)
      console.log(`User ${user.name} disconnected from room ${user.roomId}`)
    }
    
    console.log('User disconnected:', socket.id)
  })
})

// REST API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    const room = await Room.findOne({ roomId })
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' })
    }

    res.json({
      roomId: room.roomId,
      roomType: room.roomType,
      createdAt: room.createdAt,
      activeUsers: activeRooms.get(roomId)?.users.length || 0
    })
  } catch (error) {
    console.error('Error fetching room:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})