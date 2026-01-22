
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Mic2, MicOff, Zap, History, Mail, Wind, FileText, X, Info } from 'lucide-react';
import { SYSTEM_METRICS } from './constants';

// Branding & Configuration
const LOGO_URL = "https://res.cloudinary.com/dd6z9fx5m/image/upload/v1769104511/22.01.2026_13.41.59_REC_eyyetp.png";
const TOP_LOGO_URL = "https://res.cloudinary.com/dd6z9fx5m/image/upload/v1768754337/Generated_Image_January_18_2026_-_12_20PM_bjvupo.jpg";
const RICHARD_EMAIL = "richardf.productions@gmail.com";

// Audio Processing Utilities
function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Sally Standby');
  const [isTalking, setIsTalking] = useState(false);
  const [history, setHistory] = useState<{ role: string, text: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<{ recipient: string, body: string, clientName?: string } | null>(null);
  const [voiceProfile, setVoiceProfile] = useState<'Kore' | 'Zephyr'>('Kore');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  const liveCoherence = useMemo(() => {
    const base = SYSTEM_METRICS.coherenceScore;
    return base + Math.min(20, history.length * 2);
  }, [history]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const historyEndRef = useRef<HTMLDivElement>(null);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    if (historyEndRef.current) historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const generateBriefing = async () => {
    if (history.length < 2) return setStatus('Insufficient Lead Data');
    setIsGeneratingBrief(true);
    setStatus('Optimizing Brief...');
    try {
      const apiKey = process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const transcript = history.map(h => `${h.role}: ${h.text}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze session. Extraction: Name, Business, Market goals. Brief for Richard Fortune.\n\n${transcript}`,
      });
      const body = response.text || "Synthesis failed.";
      const name = body.match(/Name:?\s*([^\n]+)/i);
      setPendingEmail({ recipient: RICHARD_EMAIL, body, clientName: name ? name[1].trim() : "Strategic Lead" });
      setStatus('Synthesis Complete');
    } catch (err) { 
      console.error(err);
      setStatus('Synthesis Error'); 
    } finally { setIsGeneratingBrief(false); }
  };

  const startDopa = async () => {
    if (isActive) {
      if (sessionRef.current) sessionRef.current.close();
      return setIsActive(false);
    }
    try {
      setStatus('Linking Neural Axis...');
      setHistory([]);
      const apiKey = process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const iCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const oCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await iCtx.resume(); await oCtx.resume();
      audioContextRef.current = iCtx; outputAudioContextRef.current = oCtx;
      const oNode = oCtx.createGain(); oNode.connect(oCtx.destination);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus('Sally Active'); setIsActive(true);
            const source = iCtx.createMediaStreamSource(stream);
            const processor = iCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const data = e.inputBuffer.getChannelData(0);
              const i16 = new Int16Array(data.length);
              for (let i = 0; i < data.length; i++) i16[i] = data[i] * 32768;
              sPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(i16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor); processor.connect(iCtx.destination);
            sPromise.then(s => s.sendRealtimeInput({ text: "Introduce yourself concisely as Sally Wukr. Welcome the user and ask for their name and business goals so you can brief Richard Fortune." }));
          },
          onmessage: async (m: LiveServerMessage) => {
            const b64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (b64) {
              setIsTalking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, oCtx.currentTime);
              const buffer = await decodeAudioData(decode(b64), oCtx, 24000, 1);
              const src = oCtx.createBufferSource();
              src.buffer = buffer; src.connect(oNode);
              src.addEventListener('ended', () => { sourcesRef.current.delete(src); if (sourcesRef.current.size === 0) setIsTalking(false); });
              src.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration; sourcesRef.current.add(src);
            }
            if (m.serverContent?.outputTranscription) currentOutputTranscription.current += m.serverContent.outputTranscription.text;
            else if (m.serverContent?.inputTranscription) currentInputTranscription.current += m.serverContent.inputTranscription.text;
            if (m.serverContent?.turnComplete) {
              const u = currentInputTranscription.current.trim();
              const s = currentOutputTranscription.current.trim();
              if (u || s) setHistory(prev => [...prev, ...(u ? [{ role: 'User', text: u }] : []), ...(s ? [{ role: 'Sally', text: s }] : [])]);
              currentInputTranscription.current = ''; currentOutputTranscription.current = '';
            }
            if (m.serverContent?.interrupted) {
              for (const s of sourcesRef.current.values()) { try { s.stop(); } catch(e) {} }
              sourcesRef.current.clear(); nextStartTimeRef.current = 0; setIsTalking(false);
            }
          },
          onerror: (e) => {
            console.error(e);
            setIsActive(false);
          },
          onclose: () => setIsActive(false),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceProfile } } },
          systemInstruction: "You are Sally Wukr, high-fidelity onboarding agent for Dopa-Tech. Sharp, professional, elegant.",
          inputAudioTranscription: {}, outputAudioTranscription: {},
        },
      });
      sessionRef.current = await sPromise;
    } catch (err) { 
      console.error(err);
      setStatus('Offline'); 
    }
  };

  return (
    <div className="container-chassis">
      <div className="flex justify-between items-center mb-10 relative z-10">
        <div className="logo-box">
          <img src={TOP_LOGO_URL} alt="WUKR" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowHistory(!showHistory)} className="btn-icon-metal">
            <History className="w-5 h-5" />
          </button>
          <button onClick={() => window.open('https://wa.me/17587162802')} className="btn-direct-black h-11 px-6">DIRECT</button>
        </div>
      </div>

      <div className="flex flex-col items-center mb-10 relative z-10">
        <div className="profile-image-wrapper mb-6">
          <div className={`profile-image-bezel ${isActive ? 'scale-110 shadow-[0_0_40px_rgba(184,134,11,0.3)]' : 'grayscale opacity-80 scale-100'}`}>
            <img src={LOGO_URL} alt="Sally" className="w-full h-full rounded-full object-cover" />
          </div>
        </div>
        <div className="status-badge-metal">{isActive ? 'SALLY ACTIVE' : status}</div>
        <div className="name-gold-italic">SALLY WUKR</div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-10 relative z-10">
        <button onClick={startDopa} className={`action-btn-circle ${isActive ? 'active' : ''}`}>
          {isActive ? <MicOff className="w-8 h-8" /> : <Mic2 className="w-8 h-8 text-[#3c3c3c]" />}
          <span className="text-[9px] font-black uppercase tracking-wider">{isActive ? 'MUTE' : 'START'}</span>
        </button>
        
        <button onClick={() => setVoiceProfile(p => p === 'Kore' ? 'Zephyr' : 'Kore')} className="action-btn-circle">
          <Wind className="w-7 h-7 text-[#3c3c3c]" />
          <span className="text-[9px] font-black uppercase tracking-wider">{voiceProfile}</span>
        </button>

        <button onClick={generateBriefing} disabled={isGeneratingBrief || history.length < 3} className={`action-btn-circle ${history.length < 3 ? 'opacity-30' : 'animate-pulse'}`}>
          <FileText className="w-7 h-7 text-[#3c3c3c]" />
          <span className="text-[9px] font-black uppercase tracking-wider">BRIEF</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-auto relative z-10">
        <div className="bottom-btn-rect flex-col items-start px-5">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[9px] font-black opacity-60">COHERENCE</span>
            <Info className="w-3 h-3 text-slate-500" />
          </div>
          <div className="text-sm font-black">{liveCoherence}%</div>
          <div className="coherence-track">
             <div className="coherence-fill" style={{ width: `${liveCoherence}%` }} />
          </div>
        </div>
        <div className="bottom-btn-rect flex-col items-start px-5">
          <span className="text-[9px] font-black opacity-60 mb-1">SYSTEM PHASE</span>
          <div className="text-sm font-black italic">{SYSTEM_METRICS.phase}</div>
          <div className="text-[7px] font-black text-[#b8860b] tracking-[0.2em] mt-1">SCALING AXIS</div>
        </div>
      </div>

      {showHistory && (
        <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="absolute inset-x-0 bottom-0 bg-white/95 h-[80%] rounded-t-[2.5rem] shadow-2xl flex flex-col p-8 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#b8860b]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 italic">Neural Uplink History</h3>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-black">
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-8 pr-2">
              {history.map((h, i) => (
                <div key={i} className={`flex flex-col ${h.role === 'User' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{h.role}</span>
                  <div className={`p-5 rounded-2xl text-xs leading-relaxed max-w-[90%] shadow-sm ${h.role === 'User' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                    {h.text}
                  </div>
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          </div>
        </div>
      )}

      {pendingEmail && (
        <div className="absolute inset-0 z-[200] bg-white/60 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white border-2 border-slate-100 p-10 rounded-[3rem] shadow-2xl text-center relative overflow-hidden">
            <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 rotate-6 shadow-2xl">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tight text-slate-900">Uplink Ready</h3>
            <p className="text-slate-500 text-xs mb-10 leading-relaxed italic">Strategic brief synthesized for <strong>{pendingEmail.clientName}</strong>. Push to Richard Fortune's terminal?</p>
            <button onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${RICHARD_EMAIL}&su=${encodeURIComponent(`AXIS LEAD: ${pendingEmail.clientName}`)}&body=${encodeURIComponent(pendingEmail.body)}`); setPendingEmail(null); }} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl text-sm tracking-widest uppercase transition-all shadow-xl active:scale-95">TRANSMIT FINDINGS</button>
            <button onClick={() => setPendingEmail(null)} className="mt-8 text-slate-400 text-[9px] font-black uppercase tracking-[0.4em] hover:text-red-600">Abort Protocol</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
