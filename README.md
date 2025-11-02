# Node Practice - Todo App with Authentication

Full-stack Todo application with JWT authentication, built with MERN stack.

## Project Structure

```
node_pract/
├── client/          # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── server/          # Node.js backend
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── server.js
└── README.md
```

## Features

- 🔐 JWT Authentication (Register/Login)
- ✅ Todo CRUD Operations
- 🛡️ Protected Routes
- 🗄️ MongoDB Integration
- 🔒 Password Hashing with bcrypt
- 🌐 RESTful API

## Tech Stack

**Frontend:**
- React
- React Router DOM
- Axios
- Context API for state management

**Backend:**
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- bcrypt for password hashing

## Installation

### Prerequisites
- Node.js
- MongoDB (local or Atlas)

### Setup

1. Clone the repository
```bash
git clone <your-repo-url>
cd node_pract
```

2. Install dependencies for both client and server

**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd ../client
npm install
```

3. Environment Variables

Create `.env` file in server directory:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5001
```

## Running the Application

### Start Backend Server
```bash
cd server
npm start
```
Server runs on http://localhost:5001

### Start Frontend
```bash
cd client
npm start
```
Client runs on http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

### Todos (All Protected)
- `GET /api/todos` - Get all todos
- `POST /api/todos` - Create new todo
- `PUT /api/todos/:id` - Update todo
- `DELETE /api/todos/:id` - Delete todo
- `PUT /api/todos/:id/toggle` - Toggle completion status

## Password Security

The application uses bcrypt for secure password storage:
- Passwords are hashed with salt rounds of 10
- Original passwords are never stored
- Each registration generates a unique salt

## Contributing

Feel free to submit issues and pull requests.

## License

ISC