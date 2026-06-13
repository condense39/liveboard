import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSocket } from '../../context/SocketContext'
import WhiteboardCanvas from '../../components/WhiteboardCanvas'
import Toolbar from '../../components/Toolbar'
import UsersList from '../../components/UsersList'
import { Copy, LogOut, Users, Check, X, Bell } from 'lucide-react'

const JoinRequestToast = ({ request, onApprove, onReject }) => (
  <div className="bg-white shadow-lg rounded-lg p-4 flex items-center gap-4">
    <div className="flex-1">
      <p className="font-semibold">{request.userName}</p>
      <p className="text-sm text-gray-500">wants to join the board.</p>
    </div>
    <button onClick={() => onReject(request.requestSocketId)} className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200">
      <X className="w-5 h-5" />
    </button>
    <button onClick={() => onApprove(request.requestSocketId)} className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200">
      <Check className="w-5 h-5" />
    </button>
  </div>
);

export default function WhiteboardRoom() {
  const router = useRouter()
  const { roomId, name: nameFromQuery, creator } = router.query
  const { socket, isConnected } = useSocket()

  const [userName, setUserName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [promptName, setPromptName] = useState('')
  
  const canvasRef = useRef(null)
  const usersListRef = useRef(null)
  const [users, setUsers] = useState([])
  const [permission, setPermission] = useState('edit')
  const [roomData, setRoomData] = useState(null)
  const [tool, setTool] = useState('select')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [fontSize, setFontSize] = useState(24)
  const [fontFamily, setFontFamily] = useState('Arial')
  const [activeObject, setActiveObject] = useState(null)
  const [showUsersList, setShowUsersList] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [joinRequests, setJoinRequests] = useState([])
  const [waitingForApproval, setWaitingForApproval] = useState(false)
  const [joinRejected, setJoinRejected] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (nameFromQuery) {
      setUserName(nameFromQuery)
    } else {
      setShowNamePrompt(true)
    }
  }, [router.isReady, nameFromQuery])

  useEffect(() => {
    if (!socket || !roomId || !userName) return

    const onRoomJoined = (data) => {
      setWaitingForApproval(false)
      setRoomData(data.room)
      setUsers(data.users)
      setPermission(data.permission)
    }
    const onUserJoined = (data) => setUsers(data.users)
    const onUserLeft = (data) => setUsers(data.users)
    const onRoomNotFound = () => {
      alert('Room not found!')
      router.push('/')
    }
    const onWaiting = () => setWaitingForApproval(true)
    const onJoinRejected = () => {
      setWaitingForApproval(false)
      setJoinRejected(true)
    }
    const onJoinRequest = (request) => {
      setJoinRequests(prev => [...prev, request])
    }

    socket.emit('join-room', {
      roomId,
      userName: userName,
      isCreator: creator === 'true',
    })
    socket.on('room-joined', onRoomJoined)
    socket.on('user-joined', onUserJoined)
    socket.on('user-left', onUserLeft)
    socket.on('room-not-found', onRoomNotFound)
    socket.on('waiting-for-approval', onWaiting)
    socket.on('join-request-rejected', onJoinRejected)
    socket.on('join-request', onJoinRequest)

    return () => {
      if (socket) {
        socket.emit('leave-room', { roomId })
      }
      socket.off('room-joined', onRoomJoined)
      socket.off('user-joined', onUserJoined)
      socket.off('user-left', onUserLeft)
      socket.off('room-not-found', onRoomNotFound)
      socket.off('waiting-for-approval', onWaiting)
      socket.off('join-request-rejected', onJoinRejected)
      socket.off('join-request', onJoinRequest)
    }
  }, [socket, roomId, userName, creator, router])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (usersListRef.current && !usersListRef.current.contains(event.target)) {
        setShowUsersList(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [usersListRef])

  const handleNameSubmit = () => {
    if (promptName.trim()) {
      setUserName(promptName)
      setShowNamePrompt(false)
    }
  }

  const handleToolChange = (newTool) => {
    if (permission === 'edit') {
      setTool(newTool)
    }
  }
  const handleAction = (action) => {
    if (action === 'toggleExportMenu') {
      setShowExportMenu(prev => !prev)
      return
    }

    if (permission !== 'edit' || !canvasRef.current) return
    const allowedActions = ['undo', 'redo', 'clearCanvas', 'downloadAsPNG', 'downloadAsPDF']
    if (allowedActions.includes(action) && typeof canvasRef.current[action] === 'function') {
      canvasRef.current[action]()
      setShowExportMenu(false)
    }
  }
  const handleSelectionChange = (object) => {
    setActiveObject(object)
    if (object && object.type === 'i-text') {
      setFontSize(object.fontSize)
      setFontFamily(object.fontFamily)
    }
  }
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Link copied to clipboard!')
  }
  const leaveRoom = () => {
    router.push('/')
  }

  const handleApprove = (requestSocketId) => {
    socket.emit('approve-join-request', { roomId, requestSocketId })
    setJoinRequests(prev => prev.filter(req => req.requestSocketId !== requestSocketId))
  }

  const handleReject = (requestSocketId) => {
    socket.emit('reject-join-request', { roomId, requestSocketId })
    setJoinRequests(prev => prev.filter(req => req.requestSocketId !== requestSocketId))
  }

  if (joinRejected) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h2>
          <p className="text-gray-600 mb-6">The room creator has denied your request to join.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    )
  }

  if (waitingForApproval) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="w-12 h-12 mx-auto mb-4 text-blue-600">
            <Bell className="animate-swing" size={48} />
          </div>
          <h2 className="text-2xl font-bold mb-4">Request Sent</h2>
          <p className="text-gray-600">Waiting for the room creator to approve your request...</p>
        </div>
      </div>
    )
  }

  if (showNamePrompt) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4">Enter your name</h2>
          <p className="text-gray-600 mb-6">Please provide a name to join the board.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="Your name..."
              className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleNameSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              Join
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected || !userName) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to board...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 font-sans">
      {/* Join Requests Toast */}
      <div className="absolute top-4 right-4 z-50 space-y-2">
        {joinRequests.map(req => (
          <JoinRequestToast key={req.requestSocketId} request={req} onApprove={handleApprove} onReject={handleReject} />
        ))}
      </div>

      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">Live Board</h1>
          <button onClick={copyShareLink} className="p-1.5 flex items-center gap-2 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700">
            <Copy className="w-4 h-4" />
            <span className="text-sm">Copy Link</span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={usersListRef}>
            <button
              onClick={() => setShowUsersList(!showUsersList)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <Users className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700 font-medium">{users.length}</span>
            </button>
            {showUsersList && (
              <div className="absolute top-full right-0 mt-2 z-30">
                <UsersList users={users} />
              </div>
            )}
          </div>
          <button
            onClick={leaveRoom}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Toolbar
          permission={permission}
          currentTool={tool}
          onToolChange={handleToolChange}
          currentColor={color}
          onColorChange={setColor}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          activeObject={activeObject}
          onAction={handleAction}
          showExportMenu={showExportMenu}
        />
        <div className="flex-1 relative bg-gray-200">
          <WhiteboardCanvas
            ref={canvasRef}
            roomId={roomId}
            permission={permission}
            tool={tool}
            color={color}
            brushSize={brushSize}
            fontSize={fontSize}
            fontFamily={fontFamily}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      </div>
    </div>
  )
}