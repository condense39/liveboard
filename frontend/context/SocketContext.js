import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import io from 'socket.io-client'

const SocketContext = createContext(null)

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const connectSocket = useCallback(async () => {
    // Prevent multiple connections
    if (socketRef.current?.connected || isConnecting) {
      return socketRef.current
    }

    setIsConnecting(true)

    try {
      const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5,
      })

      newSocket.on('connect', () => {
        setIsConnected(true)
        setIsConnecting(false)
        console.log('Connected to server:', newSocket.id)
        
        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      })

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false)
        setIsConnecting(false)
        console.log('Disconnected from server:', reason)
        
        // Auto-reconnect after a delay if disconnection wasn't intentional
        if (reason !== 'io client disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!socketRef.current?.connected) {
              console.log('Attempting to reconnect...')
              connectSocket()
            }
          }, 3000)
        }
      })

      newSocket.on('connect_error', (error) => {
        setIsConnecting(false)
        console.error('Connection error:', error)
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts')
      })

      newSocket.on('reconnect_failed', () => {
        console.error('Failed to reconnect to server')
        setIsConnecting(false)
      })

      socketRef.current = newSocket
      setSocket(newSocket)
      return newSocket

    } catch (error) {
      console.error('Socket connection error:', error)
      setIsConnecting(false)
      return null
    }
  }, [])

  const disconnectSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
      setIsConnecting(false)
      console.log('Socket disconnected manually')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connectSocket()

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [connectSocket])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socketRef.current?.connected) {
        console.log('Page became visible, reconnecting socket...')
        connectSocket()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [connectSocket])

  const contextValue = {
    socket,
    isConnected,
    isConnecting,
    connectSocket,
    disconnectSocket,
    // Helper method to emit events safely
    emit: useCallback((event, data) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, data)
        return true
      } else {
        console.warn('Socket not connected, cannot emit:', event)
        return false
      }
    }, []),
    // Helper method to listen to events
    on: useCallback((event, callback) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback)
        return () => socketRef.current?.off(event, callback)
      }
      return () => {}
    }, []),
    // Helper method to remove event listeners
    off: useCallback((event, callback) => {
      if (socketRef.current) {
        socketRef.current.off(event, callback)
      }
    }, [])
  }

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  )
}