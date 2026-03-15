import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { getUser } from '../utils/auth';
import { Send, Wallet, ArrowRight, Users, Search, Heart, MessageCircle, TrendingUp } from 'lucide-react';

function FeedPostCard({ post, me, onLike, onComment, commentInput, onCommentInputChange }) {
  const liked = (post.liked_by || []).includes(me?.username);
  const extra = post.extra || {};

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center font-bold flex-shrink-0 text-white" style={{ fontSize: '1.25rem' }}>
          {post.nickname?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold" style={{ fontSize: '1.0625rem' }}>{post.nickname}</p>
          <p style={{ fontSize: '1rem', color: '#9ca3af' }}>{new Date(post.created_at).toLocaleString('zh-CN')}</p>
        </div>
      </div>
      <p className="mb-3" style={{ fontSize: '1rem', lineHeight: 1.6 }}>{post.content}</p>
      {post.type === 'sport' && extra.gmc_earned && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-3" style={{ background: 'linear-gradient(135deg,#fff7ed,#fffbeb)', border: '1px solid #fed7aa' }}>
          <span style={{ fontSize: '1.25rem' }}>{extra.emoji || '🏃'}</span>
          <span style={{ color: '#ea580c', fontWeight: 600 }}>+{extra.gmc_earned} GMC</span>
        </div>
      )}
      {post.type === 'shop' && extra.product && (
        <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: '2rem' }}>{extra.emoji || '🛒'}</span>
          <div>
            <p className="font-medium" style={{ fontSize: '1rem' }}>{extra.product}</p>
            <p style={{ color: '#ea580c', fontWeight: 600 }}>{extra.price} GMC</p>
          </div>
        </div>
      )}
      {post.type === 'trade' && extra.symbol && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <TrendingUp size={18} style={{ color: '#16a34a' }} />
          <span>{extra.action === 'buy' ? '买入' : '卖出'} {extra.symbol} {extra.amount}份</span>
        </div>
      )}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
        <button onClick={() => onLike(post.id)} className="flex items-center gap-1.5" style={{ color: liked ? '#ea580c' : '#6b7280', fontSize: '0.9375rem' }}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          {post.likes || 0}
        </button>
        <span className="flex items-center gap-1.5" style={{ color: '#6b7280', fontSize: '0.9375rem' }}>
          <MessageCircle size={18} />
          {(post.comments || []).length} 条评论
        </span>
      </div>
      {(post.comments || []).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {post.comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <span className="font-medium" style={{ fontSize: '1.0625rem' }}>{c.nickname}:</span>
              <span style={{ fontSize: '1.0625rem', color: '#4b5563' }}>{c.content}</span>
            </div>
          ))}
        </div>
      )}
      {me && (
        <div className="flex gap-2 mt-3">
          <input className="input-field flex-1" placeholder="写评论..." value={commentInput}
            onChange={e => onCommentInputChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onComment(post.id)}
            style={{ fontSize: '1.0625rem', padding: '0.65rem 1rem' }} />
          <button onClick={() => onComment(post.id)} className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.5rem 1rem' }}>发送</button>
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const me = getUser();
  const [mode, setMode] = useState('chat'); // 'chat' | 'feed'
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [feedPosts, setFeedPosts] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const msgEnd = useRef(null);

  useEffect(() => {
    loadConversations();
    api.get('/auth/users').then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'feed') {
      api.get('/chat/feed').then(r => setFeedPosts(r.posts || [])).catch(() => setFeedPosts([]));
    }
  }, [mode]);

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

  const handleLike = async (postId) => {
    try {
      const r = await api.post(`/chat/feed/${postId}/like`);
      setFeedPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const cur = p.liked_by || [];
        const newLiked = r.liked ? [...cur, me?.username].filter(Boolean) : cur.filter(x => x !== me?.username);
        return { ...p, likes: r.likes, liked_by: newLiked };
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleComment = async (postId) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    try {
      const r = await api.post(`/chat/feed/${postId}/comment`, { content });
      setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), r.comment] } : p));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (e) {
      alert('评论失败');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('chat')} className="px-4 py-2 rounded-xl font-medium transition-all" style={{ fontSize: '1.125rem', ...(mode === 'chat' ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' } : { color: '#6b7280', border: '1px solid #e5e7eb' }) }}>
          <MessageCircle size={18} className="inline mr-1.5 align-middle" />消息
        </button>
        <button onClick={() => setMode('feed')} className="px-4 py-2 rounded-xl font-medium transition-all" style={{ fontSize: '1.125rem', ...(mode === 'feed' ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' } : { color: '#6b7280', border: '1px solid #e5e7eb' }) }}>
          <Users size={18} className="inline mr-1.5 align-middle" />社区动态
        </button>
      </div>

      {mode === 'feed' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {feedPosts.map(p => (
              <FeedPostCard key={p.id} post={p} me={me} onLike={handleLike} onComment={handleComment} commentInput={commentInputs[p.id] || ''} onCommentInputChange={v => setCommentInputs(prev => ({ ...prev, [p.id]: v }))} />
            ))}
          </div>
        </div>
      ) : (
    <div className="flex-1 flex" style={{ gap: '1.5rem' }}>
      <div className="w-80 flex-shrink-0 flex flex-col card overflow-hidden">
        <div className="border-b border-gray-200" style={{ padding: '1.25rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
            <h2 className="font-semibold flex items-center gap-2" style={{ fontSize: '1.125rem' }}><Users size={20} />消息</h2>
            <button onClick={() => setShowUsers(!showUsers)} className="text-orange-500 hover:text-orange-400" style={{ fontSize: '1rem' }}>
              {showUsers ? '返回' : '发起聊天'}
            </button>
          </div>
          {showUsers && (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input-field pl-10" placeholder="搜索用户..." value={searchUser}
                onChange={e => setSearchUser(e.target.value)} style={{ fontSize: '1rem' }} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {showUsers ? (
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredUsers.map(u => (
                <div key={u.id} onClick={() => startChat(u)} className="flex items-center gap-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-all" style={{ padding: '1rem' }}>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center font-bold flex-shrink-0" style={{ fontSize: '1.125rem' }}>
                    {u.nickname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ fontSize: '1rem' }}>{u.nickname}</p>
                    <p className="text-gray-400 font-mono truncate" style={{ fontSize: '1rem' }}>{u.wallet_address?.slice(0, 16)}...</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conversations.map(c => (
                <div key={c.username} onClick={() => setActiveChat(c)}
                  className={`flex items-center gap-3 rounded-xl cursor-pointer transition-all ${activeChat?.username === c.username ? 'bg-orange-50 border border-orange-100' : 'hover:bg-gray-50'}`}
                  style={{ padding: '1rem' }}>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center font-bold flex-shrink-0" style={{ fontSize: '1.125rem' }}>
                    {c.nickname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate" style={{ fontSize: '1rem' }}>{c.nickname}</p>
                      {c.unread > 0 && <span className="rounded-full bg-orange-500 flex items-center justify-center" style={{ width: '1.5rem', height: '1.5rem', fontSize: '1rem' }}>{c.unread}</span>}
                    </div>
                    <p className="text-gray-400 truncate" style={{ fontSize: '1rem' }}>{c.last_message}</p>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-center text-gray-400 py-8" style={{ fontSize: '1rem' }}>
                  暂无会话<br />
                  <button onClick={() => setShowUsers(true)} className="text-orange-500 mt-2 hover:text-orange-400">发起聊天</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col card overflow-hidden">
        {activeChat ? (
          <>
            <div className="border-b border-gray-200" style={{ padding: '1.25rem' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold" style={{ fontSize: '1.125rem' }}>{activeChat.nickname}</h3>
                  <p className="text-gray-400 font-mono" style={{ fontSize: '1rem' }}>{activeChat.wallet_address}</p>
                </div>
                <button onClick={() => setShowTransfer(!showTransfer)} className="px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all" style={{ fontSize: '1rem', ...(showTransfer ? { background: '#fff7ed', color: '#ea580c' } : { color: '#6b7280' }) }}>
                  <Wallet size={16} />转账
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.map(m => {
                const isMine = m.from_username === me?.username;
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md ${isMine ? 'order-1' : ''}`}>
                      <div className={`rounded-2xl ${isMine ? 'bg-orange-50 border border-orange-100 rounded-br-md' : 'bg-gray-50 border border-gray-200 rounded-bl-md'}`} style={{ padding: '1rem 1.25rem' }}>
                        <p style={{ color: '#111827', fontSize: '1rem' }}>{m.content}</p>
                        {m.transfer_amount > 0 && (
                          <div className="mt-2 rounded-xl p-2 text-center" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                            <p style={{ fontSize: '1rem', color: '#b45309' }}>代币转账</p>
                            <p className="text-lg font-bold" style={{ color: '#ea580c' }}>{m.transfer_amount} GMC</p>
                            <div className="mt-1 font-mono" style={{ fontSize: '1rem', color: '#6b7280' }}>
                              <p>{m.from_wallet?.slice(0, 12)}...</p>
                              <ArrowRight size={12} className="mx-auto my-0.5" />
                              <p>{m.to_wallet?.slice(0, 12)}...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className={`mt-1 ${isMine ? 'text-right' : ''}`} style={{ fontSize: '1rem', color: '#9ca3af' }}>
                        {new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEnd} />
            </div>

            <div className="border-t border-gray-200" style={{ padding: '1.25rem' }}>
              {showTransfer && (
                <div className="mb-4 rounded-xl flex items-center gap-3" style={{ padding: '1rem', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <Wallet size={18} className="flex-shrink-0" style={{ color: '#ea580c' }} />
                  <input type="number" min="0.01" step="0.01" className="input-field flex-1" placeholder="转账金额 (GMC)"
                    value={transferAmount} onChange={e => setTransferAmount(e.target.value)} style={{ fontSize: '1rem' }} />
                  <button onClick={() => { setShowTransfer(false); setTransferAmount(''); }} className="text-gray-400 hover:text-gray-900" style={{ fontSize: '1rem' }}>取消</button>
                </div>
              )}
              <div className="flex" style={{ gap: '0.75rem' }}>
                <input className="input-field flex-1" placeholder="输入消息..." value={input}
                  onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ fontSize: '1rem' }} />
                <button onClick={sendMessage} className="btn-primary px-5">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: '#6b7280' }}>
            <div className="text-center">
              <Users size={56} className="mx-auto opacity-30" style={{ marginBottom: '1rem' }} />
              <p style={{ fontSize: '1.125rem' }}>选择一个会话或发起新聊天</p>
            </div>
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
