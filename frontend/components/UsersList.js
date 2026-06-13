import { User, Crown } from 'lucide-react'

export default function UsersList({ users }) {
  return (
    <div className="w-64 bg-white rounded-lg shadow-xl border border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Online Users ({users.length})</h3>
      </div>
      <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
            <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="flex-1 text-sm text-gray-700 truncate">{user.name}</span>
            {user.isCreator && (
              <Crown className="w-4 h-4 text-yellow-500" title="Room Creator" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}