import { useEffect, useRef, useState } from 'react';
import ChatHeader from './components/ChatHeader';
import MessageBubble from './components/MessageBubble';
import MessageInput from './components/MessageInput';
import VideoCallPanel from './components/VideoCallPanel';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3002';
const MEDIA_CONSTRAINTS = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 24, max: 24 }
  }
};

async function configureSender(sender, encodingOptions) {
  const parameters = sender.getParameters();
  if (!parameters.encodings?.length) return;
  Object.assign(parameters.encodings[0], encodingOptions);
  await sender.setParameters(parameters);
}

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
  const [callState, setCallState] = useState('idle');
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callError, setCallError] = useState('');
  const socket = useRef(null);
  const peerConnection = useRef(null);
  const localStreamRef = useRef(null);
  const callStateRef = useRef('idle');
  const pendingCandidates = useRef([]);
  const reconnectTimer = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (callState !== 'incoming' || !incomingCall || document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return undefined;
    const notification = new Notification(`${incomingCall.from} is calling`, { body: 'Incoming video call', tag: 'our-space-call' });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return () => notification.close();
  }, [callState, incomingCall]);

  const updateCallState = (state) => {
    callStateRef.current = state;
    setCallState(state);
  };

  const stopCall = (notifyPeer = false) => {
    if (notifyPeer) send({ type: 'call-signal', signal: { type: 'hangup' } });
    if (peerConnection.current) window.clearInterval(peerConnection.current.statsTimer);
    peerConnection.current?.close();
    peerConnection.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidates.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setCallError('');
    updateCallState('idle');
  };

  const createPeerConnection = async (stream) => {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnection.current = connection;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    const videoSender = connection.getSenders().find((sender) => sender.track?.kind === 'video');
    const audioSender = connection.getSenders().find((sender) => sender.track?.kind === 'audio');
    if (videoSender) stream.getVideoTracks().forEach((track) => { track.contentHint = 'motion'; });
    await Promise.all([
      videoSender && configureSender(videoSender, { maxBitrate: 1_000_000, maxFramerate: 24, scaleResolutionDownBy: 1 }).catch(() => {}),
      audioSender && configureSender(audioSender, { maxBitrate: 32_000 }).catch(() => {})
    ].filter(Boolean));

    let usingReducedProfile = false;
    let healthySamples = 0;
    const setVideoProfile = async (reduced) => {
      if (!videoSender) return;
      await configureSender(videoSender, reduced
        ? { maxBitrate: 400_000, maxFramerate: 20, scaleResolutionDownBy: 2 }
        : { maxBitrate: 1_000_000, maxFramerate: 24, scaleResolutionDownBy: 1 });
    };
    connection.statsTimer = window.setInterval(async () => {
      if (connection.connectionState === 'closed') return;
      try {
        const stats = await connection.getStats();
        const remoteVideoStats = [...stats.values()].filter((report) => report.type === 'remote-inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video'));
        const poorConnection = remoteVideoStats.some((report) => report.fractionLost > 0.07 || report.roundTripTime > 0.45);
        if (poorConnection) {
          healthySamples = 0;
          if (!usingReducedProfile) {
            await setVideoProfile(true);
            usingReducedProfile = true;
          }
        } else if (usingReducedProfile && ++healthySamples >= 3) {
          await setVideoProfile(false);
          usingReducedProfile = false;
          healthySamples = 0;
        }
      } catch {
        // Stats and sender controls are optional across browser implementations.
      }
    }, 5000);

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) send({ type: 'call-signal', signal: { type: 'ice-candidate', candidate: candidate.toJSON() } });
    };
    connection.ontrack = ({ streams }) => {
      if (streams[0]) setRemoteStream(streams[0]);
      updateCallState('connected');
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') updateCallState('connected');
    };
    return connection;
  };

  const applyPendingCandidates = async (connection) => {
    const candidates = pendingCandidates.current.splice(0);
    for (const candidate of candidates) await connection.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const startCall = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setCallError('Video calling is not supported by this browser.');
      return;
    }
    setCallError('');
    updateCallState('calling');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const connection = await createPeerConnection(stream);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      send({ type: 'call-signal', signal: { type: 'offer', description: connection.localDescription } });
    } catch (error) {
      stopCall(false);
      setCallError(error.name === 'NotAllowedError' ? 'Allow camera and microphone access to start a call.' : 'Could not start the video call.');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    updateCallState('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const connection = await createPeerConnection(stream);
      await connection.setRemoteDescription(new RTCSessionDescription(incomingCall.description));
      await applyPendingCandidates(connection);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      send({ type: 'call-signal', signal: { type: 'answer', description: connection.localDescription } });
      setIncomingCall(null);
    } catch (error) {
      stopCall(true);
      setCallError(error.name === 'NotAllowedError' ? 'Allow camera and microphone access to accept the call.' : 'Could not join the video call.');
    }
  };

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
        if (event.type === 'call-signal') {
          const { signal, from } = event;
          if (signal.type === 'offer') {
            if (callStateRef.current !== 'idle') {
              send({ type: 'call-signal', signal: { type: 'busy' } });
            } else {
              setIncomingCall({ from, description: signal.description });
              setCallError('');
              updateCallState('incoming');
            }
          }
          if (signal.type === 'answer' && peerConnection.current) {
            const connection = peerConnection.current;
            connection.setRemoteDescription(new RTCSessionDescription(signal.description))
              .then(() => applyPendingCandidates(connection))
              .catch(() => setCallError('The video call could not connect.'));
          }
          if (signal.type === 'ice-candidate') {
            if (peerConnection.current?.remoteDescription) {
              peerConnection.current.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
            } else {
              pendingCandidates.current.push(signal.candidate);
            }
          }
          if (signal.type === 'hangup') stopCall(false);
          if (signal.type === 'busy') {
            stopCall(false);
            setCallError(`${from} is already on another call.`);
          }
        }
      };
      connection.onclose = () => {
        setConnected(false);
        setOnlineUsers([]);
        stopCall(false);
        if (!closedByUser) reconnectTimer.current = window.setTimeout(connect, 1800);
      };
      connection.onerror = () => connection.close();
    };

    connect();
    return () => {
      closedByUser = true;
      window.clearTimeout(reconnectTimer.current);
      stopCall(false);
      socket.current?.close();
    };
  }, [identity]);

  const send = (payload) => socket.current?.readyState === WebSocket.OPEN && socket.current.send(JSON.stringify(payload));
  const notifyTyping = (isTyping) => {
    send({ type: 'typing', isTyping });
    window.clearTimeout(typingTimer.current);
    if (isTyping) typingTimer.current = window.setTimeout(() => send({ type: 'typing', isTyping: false }), 1200);
  };
  const leave = () => { stopCall(true); setIdentity(null); setMessages([]); setOnlineUsers([]); setConnected(false); };

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
        <ChatHeader {...identity} onlineUsers={onlineUsers} currentUser={identity.name} connected={connected} callState={callState} onStartCall={startCall} onLeave={leave} />
        {callState !== 'idle' && <VideoCallPanel state={callState} peerName={incomingCall?.from || onlineUsers.find((name) => name !== identity.name) || 'your person'} localStream={localStream} remoteStream={remoteStream} error={callError} onAccept={acceptCall} onHangup={() => stopCall(true)} />}
        {callError && callState === 'idle' && <div className="call-error-toast" role="alert">{callError}<button onClick={() => setCallError('')} aria-label="Dismiss">×</button></div>}
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
