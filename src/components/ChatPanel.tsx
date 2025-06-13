import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Trash } from 'lucide-react';
import { useVideo } from '../contexts/VideoContext';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const { state, sendChatMessage, deleteChatMessage } = useVideo();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendChatMessage(message.trim());
      setMessage('');
    }
  };

  const handleDeleteMessage = (id: string) => {
    deleteChatMessage(id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-4 bottom-20 w-80 bg-white rounded-xl shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-gray-800">Chat</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {state.chatMessages.map((msg) => (
          <div key={msg.id} className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-800">{msg.senderName}</span>
                <span className="text-xs text-gray-500">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="bg-gray-100 rounded-lg px-3 py-2">
                <p className="text-gray-800 text-sm">{msg.message}</p>
              </div>
            </div>
            <button onClick={() => handleDeleteMessage(msg.id)} className="text-red-500 hover:text-red-700">
              <Trash className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
