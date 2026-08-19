import { useEffect, useRef, useState } from 'react';
import ChatHeader from './components/ChatHeader';
import MessageBubble from './components/MessageBubble';
import MessageInput from './components/MessageInput';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3001';

function LoginScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-kicker"><span>♥</span> just for us</div>
        <h1>A little corner<br /><em>for <span className="joy-word">joy</span> &amp; <span className="love-word">love</span>.</em></h1>
        <p className="login-intro">A quiet, private room for the things you want to say only to each other.</p>
        <form onSubmit={(event) => { event.preventDefault(); if (name.trim() && roomCode.trim()) onJoin(name.trim(), roomCode.trim()); }}>
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="name" maxLength={32} autoFocus /></label>
          <label>Private room code<input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="OURSPACE" maxLength={32} /></label>
          <button className="join-button" type="submit" disabled={!name.trim() || !roomCode.trim()}>Enter our space <span>↗</span></button>
        </form>
        <div className="privacy-note"><span>✦</span> Runtime-only · nothing is saved</div>
      </section>
      <aside className="login-art" aria-label="Decorative artwork"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-heart">♥</div><span className="art-caption">same room<br />different places</span></aside>
    </main>
  );
}

export default function App() {
  const [identity, setIdentity] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [connected, setConnected] = useState(false);
  const socket = useRef(null);
  const reconnectTimer = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (!identity) return undefined;
    let closedByUser = false;

    const connect = () => {
      const connection = new WebSocket(SOCKET_URL);
      socket.current = connection;
      connection.onopen = () => {
        setConnected(true);
        connection.send(JSON.stringify({ type: 'join-room', ...identity }));
      };
      connection.onmessage = ({ data }) => {
        const event = JSON.parse(data);
        if (event.type === 'online-users') setOnlineUsers(event.users);
        if (event.type === 'receive-message') setMessages((current) => [...current, event.message]);
        if (event.type === 'typing') setTypingUser(event.isTyping ? event.user : '');
      };
      connection.onclose = () => {
        setConnected(false);
        setOnlineUsers([]);
        if (!closedByUser) reconnectTimer.current = window.setTimeout(connect, 1800);
      };
      connection.onerror = () => connection.close();
    };

    connect();
    return () => {
      closedByUser = true;
      window.clearTimeout(reconnectTimer.current);
      socket.current?.close();
    };
  }, [identity]);

  const send = (payload) => socket.current?.readyState === WebSocket.OPEN && socket.current.send(JSON.stringify(payload));
  const notifyTyping = (isTyping) => {
    send({ type: 'typing', isTyping });
    window.clearTimeout(typingTimer.current);
    if (isTyping) typingTimer.current = window.setTimeout(() => send({ type: 'typing', isTyping: false }), 1200);
  };
  const leave = () => { setIdentity(null); setMessages([]); setOnlineUsers([]); setConnected(false); };

  if (!identity) return <LoginScreen onJoin={(name, roomCode) => setIdentity({ name, roomCode })} />;
  return (
    <main className="chat-shell">
      <div className="romance-scene" aria-hidden="true">
        <div className="wind wind-one" /><div className="wind wind-two" /><div className="wind wind-three" /><div className="wind wind-four" /><div className="wind wind-five" />
        <div className="lover lover-left"><div className="lover-hair"><i /><i /><i /></div><div className="lover-head"><b /><b /><i /></div><div className="lover-neck" /><div className="lover-body" /><div className="lover-arm" /><div className="lover-legs" /></div>
        <div className="lover lover-right"><div className="lover-hair"><i /><i /><i /></div><div className="lover-head"><b /><b /><i /></div><div className="lover-neck" /><div className="lover-body" /><div className="lover-arm" /><div className="lover-legs" /></div>
        <div className="scene-ground" />
      </div>
      <section className="chat-window">
        <ChatHeader {...identity} onlineUsers={onlineUsers} currentUser={identity.name} connected={connected} onLeave={leave} />
        <div className="messages" aria-live="polite">
          {messages.length === 0 && <div className="empty-state"><span>♥</span><p>Your conversation starts here.</p><small>Messages disappear when everyone leaves.</small></div>}
          {messages.map((message, index) => <MessageBubble key={`${message.timestamp}-${index}`} message={message} isMine={message.sender === identity.name} />)}
          {typingUser && <div className="typing-indicator"><span /><span /><span /> {typingUser} is typing</div>}
        </div>
        <MessageInput disabled={!connected} onSend={(text) => send({ type: 'message', text })} onSendImage={(image) => send({ type: 'image', ...image })} onTyping={notifyTyping} />
      </section>
    </main>
  );
}
