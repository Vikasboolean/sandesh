function formatTime(timestamp) {
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

export default function MessageBubble({ message, isMine }) {
  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = message.data;
    link.download = message.fileName || 'our-photo';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <article className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
      <div className="message-bubble">
        {!isMine && <div className="sender-name">{message.sender}</div>}
        {message.kind === 'image' ? (
          <>
            <img className="shared-image" src={message.data} alt={message.fileName || 'Shared image'} />
            <button className="download-button" onClick={downloadImage}>↓ Download</button>
          </>
        ) : <p>{message.text}</p>}
        <time>{formatTime(message.timestamp)}</time>
      </div>
    </article>
  );
}
