const crypto = require('crypto')

const generateRoomId = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

const validateRoomId = (roomId) => {
  return /^[A-Z0-9]{6}$/.test(roomId)
}

module.exports = {
  generateRoomId,
  validateRoomId
}