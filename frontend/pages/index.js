import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSocket } from '../context/SocketContext'
import { Edit3, Link2, Lock, Globe } from 'lucide-react'

export default function Landing() {
  const [createUserName, setCreateUserName] = useState('')
  const [roomType, setRoomType] = useState('public')
  const [joinUserName, setJoinUserName] = useState('')
  const [joinLink, setJoinLink] = useState('')
  const router = useRouter()
  const { socket, connectSocket } = useSocket()

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = async () => {
    if (!createUserName.trim()) {
      alert('Please enter your name')
      return
    }
    const roomId = generateRoomId()
    const activeSocket = socket || await connectSocket()
    activeSocket.emit('create-room', {
      roomId,
      userName: createUserName.trim(),
      roomType: roomType,
      isCreator: true,
    })
    router.push(`/whiteboard/${roomId}?name=${encodeURIComponent(createUserName)}&creator=true`)
  }
  
  const handleJoinWithLink = () => {
    if (!joinUserName.trim()) {
      alert('Please enter your name')
      return
    }
    if (!joinLink.trim()) {
      alert('Please paste the board link')
      return
    }

    try {
      const url = new URL(joinLink)
      const pathSegments = url.pathname.split('/')
      const roomId = pathSegments[pathSegments.length - 1]
      
      if (roomId) {
        router.push(`/whiteboard/${roomId}?name=${encodeURIComponent(joinUserName)}`)
      } else {
        alert('Invalid link. Please check the URL and try again.')
      }
    } catch (error) {
      alert('Invalid link. Please check the URL and try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Live Board</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create a board and share the link to start collaborating in real-time.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Edit3 className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Create a New Board</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                <input type="text" value={createUserName} onChange={(e) => setCreateUserName(e.target.value)} placeholder="Enter your name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Board Type</label>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                  <button onClick={() => setRoomType('public')} className={`py-2 px-4 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${roomType === 'public' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Globe className="w-4 h-4" />
                    Public
                  </button>
                  <button onClick={() => setRoomType('private')} className={`py-2 px-4 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${roomType === 'private' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                </div>
              </div>
              <button onClick={handleCreateRoom} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
                <Edit3 className="w-5 h-5" />
                Create & Go
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Join with Link</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                <input type="text" value={joinUserName} onChange={(e) => setJoinUserName(e.target.value)} placeholder="Enter your name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Board Link</label>
                <input type="text" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} placeholder="Paste the link here" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <button onClick={handleJoinWithLink} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
                <Link2 className="w-5 h-5" />
                Join Board
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}