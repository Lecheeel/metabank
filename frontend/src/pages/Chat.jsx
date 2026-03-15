import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { getUser } from '../utils/auth';
import { Send, Wallet, ArrowRight, Users, Search } from 'lucide-react';

export default function Chat() {
  const me = getUser();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const msgEnd = useRef(null);

  useEffect(() => {
    loadConversations();
    api.get('/auth/users').then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeChat) {
      api.get(`/chat/messages/${activeChat.username}`).then(setMessages);
    }
  }, [activeChat?.username]);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = () => api.get('/chat/conversations').then(setConversations).catch(() => {});

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    try {
      await api.post('/chat/send', {
        to_username: activeChat.username,
        content: input,
        transfer_amount: showTransfer && transferAmount ? parseFloat(transferAmount) : null
      });
      setInput('');
      setTransferAmount('');
      setShowTransfer(false);
      api.get(`/chat/messages/${activeChat.username}`).then(setMessages);
      loadConversations();
    } catch (err) {
      alert(err.detail || '发送失败');
    }
  };

  const startChat = (user) => {
    setActiveChat({ username: user.username, nickname: user.nickname, wallet_address: user.wallet_address });
    setShowUsers(false);
    setSearchUser('');
  };

  const filteredUsers = users.filter(u => u.username !== me?.username && (u.username.includes(searchUser) || u.nickname.includes(searchUser)));

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <div className="w-80 flex-shrink-0 flex flex-col card overflow-hidden">
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Users size={18} />消息</h2>
            <button onClick={() => setShowUsers(!showUsers)} className="text-indigo-400 text-sm hover:text-indigo-300">
              {showUsers ? '返回' : '发起聊天'}
            </button>
          </div>
          {showUsers && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input className="input-field pl-8 text-sm" placeholder="搜索用户..." value={searchUser}
                onChange={e => setSearchUser(e.target.value)} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {showUsers ? (
            <div className="p-2 space-y-1">
              {filteredUsers.map(u => (
                <div key={u.id} onClick={() => startChat(u)} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {u.nickname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.nickname}</p>
                    <p className="text-xs text-white/30 font-mono truncate">{u.wallet_address?.slice(0, 16)}...</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map(c => (
                <div key={c.username} onClick={() => setActiveChat(c)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeChat?.username === c.username ? 'bg-indigo-500/15 border border-indigo-500/20' : 'hover:bg-white/5'}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {c.nickname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{c.nickname}</p>
                      {c.unread > 0 && <span className="w-5 h-5 rounded-full bg-indigo-500 text-xs flex items-center justify-center">{c.unread}</span>}
                    </div>
                    <p className="text-xs text-white/30 truncate">{c.last_message}</p>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-center text-white/30 text-sm py-8">
                  暂无会话<br />
                  <button onClick={() => setShowUsers(true)} className="text-indigo-400 mt-2 hover:text-indigo-300">发起聊天</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col card overflow-hidden">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{activeChat.nickname}</h3>
                  <p className="text-xs text-white/30 font-mono">{activeChat.wallet_address}</p>
                </div>
                <button onClick={() => setShowTransfer(!showTransfer)} className={`text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${showTransfer ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                  <Wallet size={14} />转账
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => {
                const isMine = m.from_username === me?.username;
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md ${isMine ? 'order-1' : ''}`}>
                      <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-indigo-500/20 border border-indigo-500/20 rounded-br-md' : 'bg-white/5 border border-white/10 rounded-bl-md'}`}>
                        <p className="text-sm">{m.content}</p>
                        {m.transfer_amount > 0 && (
                          <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                            <p className="text-xs text-amber-400/60">代币转账</p>
                            <p className="text-lg font-bold text-amber-400">{m.transfer_amount} GMC</p>
                            <div className="text-xs text-white/30 mt-1 font-mono">
                              <p>{m.from_wallet?.slice(0, 12)}...</p>
                              <ArrowRight size={12} className="mx-auto my-0.5" />
                              <p>{m.to_wallet?.slice(0, 12)}...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className={`text-xs text-white/20 mt-1 ${isMine ? 'text-right' : ''}`}>
                        {new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEnd} />
            </div>

            <div className="p-4 border-t border-white/10">
              {showTransfer && (
                <div className="mb-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex items-center gap-3">
                  <Wallet size={16} className="text-amber-400 flex-shrink-0" />
                  <input type="number" min="0.01" step="0.01" className="input-field text-sm flex-1" placeholder="转账金额 (GMC)"
                    value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
                  <button onClick={() => { setShowTransfer(false); setTransferAmount(''); }} className="text-white/30 hover:text-white text-sm">取消</button>
                </div>
              )}
              <div className="flex gap-2">
                <input className="input-field flex-1" placeholder="输入消息..." value={input}
                  onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                <button onClick={sendMessage} className="btn-primary px-4">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/30">
            <div className="text-center">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>选择一个会话或发起新聊天</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
