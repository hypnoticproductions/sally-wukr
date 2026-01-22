
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Terminal } from 'lucide-react';
import { dopaAI } from '../services/geminiService';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'Connection Established. DOPA Online. How shall we architect the axis today?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const response = await dopaAI.getDopaAnalysis(input);
    const modelMessage: ChatMessage = { role: 'model', content: response };
    setMessages(prev => [...prev, modelMessage]);
    setIsTyping(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gold-500 hover:bg-gold-600 text-black p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-110 flex items-center gap-2 font-bold"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="hidden md:inline">Consult DOPA</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] obsidian-card rounded-2xl z-50 flex flex-col glow-gold overflow-hidden border border-gold-500/30">
          <div className="p-4 border-b border-gold-500/20 flex justify-between items-center bg-black/50">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-gold-500" />
              <h3 className="font-bold gold-gradient tracking-widest uppercase">DOPA Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                  m.role === 'user' 
                    ? 'bg-gold-600 text-black font-semibold' 
                    : m.role === 'system'
                    ? 'bg-white/5 border border-white/10 text-gold-400 italic'
                    : 'bg-white/10 text-white'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-gray-400 p-3 rounded-xl text-sm animate-pulse">
                  DOPA is reasoning...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gold-500/20 bg-black/50">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Inquire about the Axis..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gold-500 transition-colors"
              />
              <button 
                onClick={handleSend}
                className="bg-gold-500 text-black p-2 rounded-lg hover:bg-gold-600 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Assistant;
