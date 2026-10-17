import { useEffect, useRef, useState } from 'react';
import './video-call.css';

export default function VideoCallPanel({ state, peerName, localStream, remoteStream, error, onAccept, onHangup }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const incomingAlert = useRef(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localStream || null;
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream || null;
    setMuted(false);
    setCameraOff(false);
  }, [localStream, remoteStream]);

  useEffect(() => {
    if (state === 'incoming') incomingAlert.current?.focus();
  }, [state]);

  const toggleAudio = () => {
    const nextMuted = !muted;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  };

  const toggleCamera = () => {
    const nextCameraOff = !cameraOff;
    localStream?.getVideoTracks().forEach((track) => { track.enabled = !nextCameraOff; });
    setCameraOff(nextCameraOff);
  };

  const incoming = state === 'incoming';
  const connecting = state === 'calling' || state === 'connecting';

  if (incoming) {
    return (
      <section className="call-overlay incoming-call-overlay" aria-label="Incoming video call">
        <div className="incoming-call-alert" ref={incomingAlert} role="alertdialog" aria-labelledby="incoming-call-title" aria-describedby="incoming-call-description" tabIndex={-1}>
          <div className="incoming-call-ring"><span>♥</span></div>
          <span className="incoming-call-kicker">Incoming video call</span>
          <strong id="incoming-call-title">{peerName} is calling</strong>
          <span id="incoming-call-description">Pick up to join the call, or decline to keep chatting.</span>
          <div className="call-controls">
            <button className="call-action accept-call" onClick={onAccept}>Pick up</button>
            <button className="call-action end-call" onClick={onHangup}>Decline</button>
          </div>
          {error && <p className="call-error" role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="call-overlay" aria-label="Video call">
      <div className="call-stage">
        {remoteStream ? (
          <video ref={remoteVideo} className="remote-video" autoPlay playsInline />
        ) : (
          <div className="call-waiting">
            <span className="call-avatar">{peerName?.slice(0, 1).toUpperCase() || '♥'}</span>
            <strong>{incoming ? `${peerName} is calling` : connecting ? `Calling ${peerName}...` : `You are talking with ${peerName}`}</strong>
            <span>{incoming ? 'Incoming video call' : connecting ? 'Waiting for them to join' : 'Connecting video...'}</span>
          </div>
        )}
        {localStream && <video ref={localVideo} className="local-video" autoPlay playsInline muted aria-label="Your video" />}
      </div>
      <div className="call-controls">
        <button className="call-action" onClick={toggleAudio} disabled={!localStream} aria-pressed={muted} title={muted ? 'Turn microphone on' : 'Mute microphone'}>{muted ? 'Unmute' : 'Mute'}</button>
        <button className="call-action" onClick={toggleCamera} disabled={!localStream} aria-pressed={cameraOff} title={cameraOff ? 'Turn camera on' : 'Turn camera off'}>{cameraOff ? 'Camera on' : 'Camera off'}</button>
        <button className="call-action end-call" onClick={onHangup}>{connecting ? 'Cancel call' : 'End call'}</button>
      </div>
      {error && <p className="call-error" role="alert">{error}</p>}
    </section>
  );
}
