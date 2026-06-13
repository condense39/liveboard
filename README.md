# Live Board 🎨

A real-time, collaborative whiteboard application built with the MERN stack and Socket.io. Live Board allows users to instantly create online drawing rooms, share the link with their friends or team, and sketch ideas together in real-time.

## Features ✨

- **Real-Time Collaboration**: Every stroke and shape drawn is instantly synced across all connected clients via WebSockets.
- **Room Management**: Create public rooms that anyone with the link can join, or private rooms where the creator must approve join requests.
- **Drawing Tools**: Includes a pen, eraser, rectangle, circle, and text tool with adjustable brush sizes, colors, and font styles.
- **Export Capabilities**: Easily export your finished whiteboard as a high-quality PNG or PDF.
- **Responsive Canvas**: The whiteboard canvas resizes automatically to fit your screen.
- **Undo/Redo History**: Made a mistake? Quickly undo or redo your recent actions.

## Tech Stack 🛠️

**Frontend:**
- [Next.js](https://nextjs.org/) (React Framework)
- [TailwindCSS](https://tailwindcss.com/) (Styling)
- [Fabric.js](http://fabricjs.com/) (HTML5 Canvas Drawing Library)
- [Socket.io-client](https://socket.io/) (Real-time events)
- [Lucide React](https://lucide.dev/) (Icons)

**Backend:**
- [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- [Socket.io](https://socket.io/) (WebSocket Server)
- [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/) (Database)

## Getting Started 🚀

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [MongoDB](https://www.mongodb.com/) installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/collaborative-whiteboard.git
cd collaborative-whiteboard
```

### 2. Setup the Backend
Open a terminal and navigate to the backend directory:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/whiteboard
FRONTEND_URL=http://localhost:3000
```

Start the backend server:
```bash
npm run dev
```

### 3. Setup the Frontend
Open a new terminal window and navigate to the frontend directory:
```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend` directory:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

Start the Next.js development server:
```bash
npm run dev
```

### 4. Open the App
Visit [http://localhost:3000](http://localhost:3000) in your browser. Enter your name, click "Create & Go", and start drawing!

## Deployment 🌐

- **Frontend**: Can be deployed seamlessly on [Vercel](https://vercel.com).
- **Backend**: Because it relies on persistent WebSockets, the backend must be deployed to a service that supports long-lived connections (e.g., [Render](https://render.com/), Railway, or Heroku). Serverless platforms like Vercel will drop WebSocket connections.

*Note: Make sure to update the `MONGODB_URI`, `FRONTEND_URL`, and `NEXT_PUBLIC_BACKEND_URL` environment variables in your production environments.*

## License 📄
This project is licensed under the MIT License.
