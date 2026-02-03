import React, { useState } from 'react';
import { X, CreditCard, Shield, Clock, Video, Calendar, Star } from 'lucide-react';
import { CalendlyEmbed } from './CalendlyEmbed';

type OfferType = 'profile' | 'consultation' | 'dual';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientEmail: string;
  clientName: string;
  painPoints?: string;
  company?: string;
  offerType?: OfferType;
  onPaymentSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientEmail,
  clientName,
  painPoints,
  company,
  offerType = 'profile',
  onPaymentSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCalendly, setShowCalendly] = useState(false);

  if (!isOpen) return null;

  const handleProfilePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId,
            clientEmail,
            clientName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleConsultationClick = () => {
    setShowCalendly(true);
  };

  const handleCalendlyScheduled = () => {
    setShowCalendly(false);
    onPaymentSuccess();
    onClose();
  };

  if (showCalendly) {
    return (
      <CalendlyEmbed
        url="https://calendly.com/richarddfortune/consultation"
        prefill={{
          name: clientName,
          email: clientEmail,
          customAnswers: {
            company: company || '',
            pain_points: painPoints || '',
          },
        }}
        utm={{
          utmSource: 'sally',
          utmMedium: 'chat',
          utmCampaign: 'consultation',
          utmContent: clientId,
        }}
        onClose={() => setShowCalendly(false)}
        onEventScheduled={handleCalendlyScheduled}
      />
    );
  }

  if (offerType === 'dual') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gold-500/30 rounded-2xl max-w-5xl w-full shadow-2xl glow-gold">
          <div className="p-6 border-b border-gold-500/20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold gold-gradient">Choose Your Path Forward</h3>
                <p className="text-gray-400 text-sm mt-1">Both options accelerate your growth</p>
              </div>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-gold-500/50 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-3 rounded-lg">
                      <Shield className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Profile Retention</h4>
                      <p className="text-sm text-gray-400">Keep the momentum going</p>
                    </div>
                  </div>
                  <span className="text-3xl font-bold gold-gradient">$30</span>
                </div>

                <ul className="space-y-3 mb-6 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>30 days of context retention</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Priority routing to Richard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Seamless conversations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>No re-explaining context</span>
                  </li>
                </ul>

                <button
                  onClick={handleProfilePayment}
                  disabled={isProcessing}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50"
                >
                  Secure Profile - $30
                </button>
              </div>

              <div className="bg-white/5 border-2 border-gold-500/50 rounded-xl p-6 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gold-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                    MOST IMPACT
                  </span>
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-gold-500/20 p-3 rounded-lg">
                      <Video className="w-6 h-6 text-gold-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Strategy Session</h4>
                      <p className="text-sm text-gray-400">Direct access to Richard</p>
                    </div>
                  </div>
                  <span className="text-3xl font-bold gold-gradient">$45</span>
                </div>

                <ul className="space-y-3 mb-6 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Video className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                    <span>60-minute video strategy call</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                    <span>Screen sharing & walkthroughs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                    <span>Personalized action plan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                    <span>Richard's full attention</span>
                  </li>
                </ul>

                <button
                  onClick={handleConsultationClick}
                  className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3 rounded-lg transition-all"
                >
                  Book Session - $45
                </button>
              </div>
            </div>

            {painPoints && (
              <div className="mt-6 bg-gold-500/10 border border-gold-500/30 rounded-xl p-4">
                <p className="text-sm text-gold-300 italic">"{painPoints}"</p>
                <p className="text-xs text-gray-400 mt-2">
                  Most clients find value in both: Profile keeps the conversation alive, consultation provides immediate guidance.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (offerType === 'consultation') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gold-500/30 rounded-2xl max-w-md w-full shadow-2xl glow-gold">
          <div className="p-6 border-b border-gold-500/20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold gold-gradient">Strategy Session with Richard</h3>
                <p className="text-gray-400 text-sm mt-1">60-Minute Video Consultation</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white font-semibold">60-Minute Consultation</span>
                <span className="text-2xl font-bold gold-gradient">$45</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <Video className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                  <span>Live video call with Richard D. Fortune</span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                  <span>Screen sharing for detailed walkthroughs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                  <span>Custom action plan for your situation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                  <span>Immediate answers to urgent questions</span>
                </li>
              </ul>
            </div>

            {painPoints && (
              <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-4">
                <p className="text-sm text-gold-300 italic">"{painPoints}"</p>
                <p className="text-xs text-gray-400 mt-2">
                  Get immediate clarity with direct access to Richard.
                </p>
              </div>
            )}

            <button
              onClick={handleConsultationClick}
              className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-4 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              <span>Schedule Session - $45</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              <span>Secured by Calendly • Satisfaction guaranteed</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gold-500/30 rounded-2xl max-w-md w-full shadow-2xl glow-gold">
        <div className="p-6 border-b border-gold-500/20">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold gold-gradient">Secure Your Strategic Profile</h3>
              <p className="text-gray-400 text-sm mt-1">30-Day Premium Retention</p>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-semibold">30-Day Strategic Profile</span>
              <span className="text-2xl font-bold gold-gradient">$30</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                <span>Complete profile retention for 30 days</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                <span>Priority routing to Richard D. Fortune</span>
              </li>
              <li className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                <span>Seamless continuation of conversations</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-gold-500 mt-0.5 flex-shrink-0" />
                <span>No re-explaining your business context</span>
              </li>
            </ul>
          </div>

          {painPoints && (
            <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-4">
              <p className="text-sm text-gold-300 italic">
                "{painPoints}"
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Don't lose this strategic context. Lock it in now.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleProfilePayment}
              disabled={isProcessing}
              className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-4 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Secure Your Profile - $30</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              <span>Secured by Stripe • 7-day money-back guarantee</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Your profile will be retained for 30 days from payment.</p>
            <p>After 30 days without renewal, your profile will be archived.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
