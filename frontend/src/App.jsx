import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn } from './utils/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Wallet from './pages/Wallet';
import Shop from './pages/Shop';
import Exchange from './pages/Exchange';
import Chat from './pages/Chat';
import AIAssistant from './pages/AIAssistant';
import Admin from './pages/Admin';
import Landing from './pages/Landing';

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="shop" element={<Shop />} />
          <Route path="exchange" element={<Exchange />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
