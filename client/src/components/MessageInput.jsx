import { useRef, useState } from 'react';

export default function MessageInput({ onSend, onSendImage, onTyping, disabled }) {
  const [text, setText] = useState('');
  const fileInput = useRef(null);

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
    onTyping(false);
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);
    onTyping(Boolean(value.trim()));
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        onSendImage({ fileName: file.name, mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', .82) });
      };
      image.onerror = () => window.alert('This image could not be prepared for sending.');
      image.src = reader.result;
    };
    reader.onerror = () => window.alert('This image could not be read.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <form className="message-input" onSubmit={submit}>
      <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} hidden />
      <button className="icon-button" type="button" onClick={() => fileInput.current?.click()} title="Select image" disabled={disabled}>⌕</button>
      <input className="text-field" value={text} onChange={handleChange} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) submit(event);
      }} placeholder="Write something..." disabled={disabled} aria-label="Message" />
      <button className="send-button" type="submit" title="Send message" disabled={disabled || !text.trim()}>↑</button>
    </form>
  );
}
