import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface CalendlyEmbedProps {
  url: string;
  prefill?: {
    name?: string;
    email?: string;
    customAnswers?: Record<string, string>;
  };
  utm?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  };
  onClose?: () => void;
  onEventScheduled?: () => void;
}

export const CalendlyEmbed: React.FC<CalendlyEmbedProps> = ({
  url,
  prefill,
  utm,
  onClose,
  onEventScheduled,
}) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);

    const handleMessage = (e: MessageEvent) => {
      if (e.data.event && e.data.event === 'calendly.event_scheduled') {
        onEventScheduled?.();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      document.body.removeChild(script);
      window.removeEventListener('message', handleMessage);
    };
  }, [onEventScheduled]);

  const buildCalendlyUrl = () => {
    const params = new URLSearchParams();

    if (prefill?.name) {
      params.append('name', prefill.name);
    }
    if (prefill?.email) {
      params.append('email', prefill.email);
    }

    if (prefill?.customAnswers) {
      Object.entries(prefill.customAnswers).forEach(([key, value], index) => {
        params.append(`a${index + 1}`, value);
      });
    }

    if (utm?.utmSource) params.append('utm_source', utm.utmSource);
    if (utm?.utmMedium) params.append('utm_medium', utm.utmMedium);
    if (utm?.utmCampaign) params.append('utm_campaign', utm.utmCampaign);
    if (utm?.utmContent) params.append('utm_content', utm.utmContent);

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] relative overflow-hidden shadow-2xl">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
        <div
          className="calendly-inline-widget h-full w-full"
          data-url={buildCalendlyUrl()}
          style={{ minWidth: '320px', height: '100%' }}
        />
      </div>
    </div>
  );
};
