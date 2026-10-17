export default function ChatHeader({ roomCode, onlineUsers, currentUser, connected, callState, onStartCall, onLeave }) {
  return (
    <header className="chat-header">
      <div className="brand-mark">♥</div>
      <div className="header-copy">
        <div className="eyebrow">Private room · {roomCode}</div>
        <h1>Our Space</h1>
        <div className="presence-list" aria-label="Online users">
          {onlineUsers.map((user) => (
            <span className="presence-user" key={user}>
              <i /> {user}{user === currentUser ? ' (you)' : ''}
            </span>
          ))}
          {onlineUsers.length === 0 && <span className="presence-user offline"><i /> Waiting for someone</span>}
        </div>
      </div>
      <div className={`connection-state ${connected ? 'is-connected' : ''}`}>
        <span className="status-dot" /> {connected ? 'Connected' : 'Reconnecting'}
      </div>
      <button className="video-call-button" onClick={onStartCall} disabled={!connected || onlineUsers.length !== 2 || callState !== 'idle'} title="Start a video call">Video call</button>
      <button className="leave-button" onClick={onLeave} title="Leave this room">Leave</button>
    </header>
  );
}
