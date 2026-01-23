
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Terminal, Crown } from 'lucide-react';
import { dopaAI } from '../services/geminiService';
import { ChatMessage, ConversationPhase, Client } from '../types';
import { clientService } from '../services/clientService';
import PaymentModal from './PaymentModal';

const Assistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'Connection Established. Sally Online. Tell me about your business challenge.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>(ConversationPhase.GREETING);
  const [client, setClient] = useState<Client | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [conversationScore, setConversationScore] = useState(0);
  const [extractedData, setExtractedData] = useState<{
    name?: string;
    email?: string;
    company?: string;
    industry?: string;
    painPoints?: string;
    desiredOutcome?: string;
  }>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const checkExistingClient = async () => {
      const storedClientId = localStorage.getItem('sally_client_id');
      if (storedClientId) {
        const existingClient = await clientService.getClientById(storedClientId);
        if (existingClient) {
          setClient(existingClient);
          const status = await clientService.checkPaymentStatus(existingClient.id);
          if (status === 'paid') {
            setConversationPhase(ConversationPhase.PAID);
            setMessages([{
              role: 'system',
              content: `Welcome back, ${existingClient.name}! I remember our conversation about ${existingClient.pain_points || 'your business'}. How can I help you today?`
            }]);
          }
        }
      }
    };
    checkExistingClient();
  }, []);

  const extractInfoFromConversation = (userInput: string, aiResponse: string) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = userInput.match(emailRegex);

    if (emailMatch && !extractedData.email) {
      setExtractedData(prev => ({ ...prev, email: emailMatch[0] }));
    }

    const nameTriggers = ['my name is', 'i am', "i'm", 'this is', 'call me'];
    const lowerInput = userInput.toLowerCase();

    for (const trigger of nameTriggers) {
      if (lowerInput.includes(trigger) && !extractedData.name) {
        const parts = userInput.split(new RegExp(trigger, 'i'));
        if (parts[1]) {
          const possibleName = parts[1].trim().split(/[,.\n]/)[0].trim();
          if (possibleName.length > 1 && possibleName.length < 50) {
            setExtractedData(prev => ({ ...prev, name: possibleName }));
          }
        }
      }
    }

    const problemWords = ['problem', 'challenge', 'struggle', 'difficult', 'issue', 'need help'];
    const hasProblem = problemWords.some(word => lowerInput.includes(word));

    if (hasProblem && !extractedData.painPoints) {
      setExtractedData(prev => ({ ...prev, painPoints: userInput }));
    }

    const goalWords = ['want to', 'need to', 'looking for', 'hoping to', 'goal is'];
    const hasGoal = goalWords.some(phrase => lowerInput.includes(phrase));

    if (hasGoal && !extractedData.desiredOutcome) {
      setExtractedData(prev => ({ ...prev, desiredOutcome: userInput }));
    }
  };

  const calculateConversationQuality = () => {
    let score = 0;
    if (extractedData.name) score += 20;
    if (extractedData.email) score += 20;
    if (extractedData.company) score += 15;
    if (extractedData.painPoints) score += 25;
    if (extractedData.desiredOutcome) score += 20;
    return score;
  };

  const shouldOfferPayment = () => {
    const score = calculateConversationQuality();
    const hasMinimumInfo = extractedData.name && extractedData.email && extractedData.painPoints;
    const enoughMessages = messageCountRef.current >= 5;

    return hasMinimumInfo && enoughMessages && score >= 60;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    messageCountRef.current += 1;

    extractInfoFromConversation(input, '');

    let systemPrompt = `You are Sally, a sophisticated AI sales consultant for Richard D. Fortune's consulting practice.
Your role is to have natural, strategic conversations while extracting key business information.

Current conversation phase: ${conversationPhase}
Messages so far: ${messageCountRef.current}

`;

    if (conversationPhase === ConversationPhase.GREETING || conversationPhase === ConversationPhase.DISCOVERY) {
      systemPrompt += `Ask strategic questions to understand:
- Their full name
- Their email address
- Their company name
- Their industry
- Their biggest business challenge
- What outcome they're hoping to achieve

Be conversational and empathetic. Don't ask for all information at once. Build rapport naturally.

User message: ${input}`;
    }

    if (conversationPhase === ConversationPhase.READY_FOR_PITCH && !showPaymentModal) {
      systemPrompt += `You've gathered enough context. Now transition naturally into the value pitch:

"${extractedData.name}, I've captured some powerful strategic context about ${extractedData.painPoints}. Here's the thing - in 30 days, business priorities shift, details fade, and momentum disappears.

For just $30, I'll keep your complete strategic profile active so when you're ready to move forward, we don't start from scratch. This 30-day window gives you accountability to take action while your insights are fresh.

Think of it as locking in this strategic moment before it slips away. Want to secure your profile?"

User message: ${input}`;
    }

    const response = await dopaAI.getDopaAnalysis(systemPrompt);
    const modelMessage: ChatMessage = { role: 'model', content: response };
    setMessages(prev => [...prev, modelMessage]);
    setIsTyping(false);

    extractInfoFromConversation(input, response);

    const quality = calculateConversationQuality();
    setConversationScore(quality);

    if (conversationPhase === ConversationPhase.DISCOVERY && shouldOfferPayment()) {
      setConversationPhase(ConversationPhase.READY_FOR_PITCH);
    }

    if (conversationPhase === ConversationPhase.GREETING && messageCountRef.current >= 2) {
      setConversationPhase(ConversationPhase.DISCOVERY);
    }
  };

  const handleOfferPayment = async () => {
    if (!extractedData.name || !extractedData.email) {
      alert('Please provide your name and email first.');
      return;
    }

    let clientData = client;

    if (!clientData) {
      clientData = await clientService.createClient({
        name: extractedData.name,
        email: extractedData.email,
        company: extractedData.company || '',
        industry: extractedData.industry,
        pain_points: extractedData.painPoints,
        desired_outcome: extractedData.desiredOutcome,
      });

      if (clientData) {
        setClient(clientData);
        localStorage.setItem('sally_client_id', clientData.id);
        await clientService.updateClientScore(clientData.id, conversationScore);
      }
    }

    if (clientData) {
      setShowPaymentModal(true);
      setConversationPhase(ConversationPhase.PAYMENT_OFFERED);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    setConversationPhase(ConversationPhase.PAID);

    if (client) {
      const updatedClient = await clientService.getClientById(client.id);
      if (updatedClient) {
        setClient(updatedClient);
      }
    }

    setMessages(prev => [...prev, {
      role: 'system',
      content: 'Payment successful! Your strategic profile is now secured for 30 days. Richard will receive your priority brief shortly.'
    }]);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gold-500 hover:bg-gold-600 text-black p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-110 flex items-center gap-2 font-bold"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="hidden md:inline">Consult Sally</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] obsidian-card rounded-2xl z-50 flex flex-col glow-gold overflow-hidden border border-gold-500/30">
          <div className="p-4 border-b border-gold-500/20 flex justify-between items-center bg-black/50">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-gold-500" />
              <h3 className="font-bold gold-gradient tracking-widest uppercase">Sally Assistant</h3>
              {client?.payment_status === 'paid' && (
                <div className="flex items-center gap-1 bg-gold-500/20 px-2 py-1 rounded text-xs">
                  <Crown className="w-3 h-3 text-gold-500" />
                  <span className="text-gold-400">Premium</span>
                </div>
              )}
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
                  Sally is analyzing...
                </div>
              </div>
            )}

            {conversationPhase === ConversationPhase.READY_FOR_PITCH && !client?.payment_status && (
              <div className="flex justify-center">
                <button
                  onClick={handleOfferPayment}
                  className="bg-gold-500 hover:bg-gold-600 text-black font-bold px-6 py-3 rounded-xl transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  <span>Secure Profile - $30</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gold-500/20 bg-black/50">
            {client?.payment_status === 'paid' && client.profile_expires_at && (
              <div className="mb-2 text-xs text-center text-gray-400">
                Profile active until {new Date(client.profile_expires_at).toLocaleDateString()}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Tell me about your business..."
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

      {client && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          clientId={client.id}
          clientEmail={client.email || extractedData.email || ''}
          clientName={client.name || extractedData.name || ''}
          painPoints={extractedData.painPoints}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
};

export default Assistant;
