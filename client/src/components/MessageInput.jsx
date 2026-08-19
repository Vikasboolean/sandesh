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
    if (file.size > 6 * 1024 * 1024) {
      window.alert('Please choose an image smaller than 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onSendImage({ fileName: file.name, mimeType: file.type, data: reader.result });
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
