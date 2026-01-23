import React, { useState } from 'react';
import { X, CreditCard, Shield, Clock } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientEmail: string;
  clientName: string;
  painPoints?: string;
  onPaymentSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientEmail,
  clientName,
  painPoints,
  onPaymentSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayment = async () => {
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
              onClick={handlePayment}
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
