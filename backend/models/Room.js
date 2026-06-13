const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  creatorId: {
    type: String,
    required: true
  },
  roomType: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  canvasData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
})

// Index for faster queries
roomSchema.index({ roomId: 1 })
roomSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Room', roomSchema)