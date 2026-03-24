'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const steps = [
  'Finding the best flights...',
  'Curating activities for your vibe...',
  'Matching hotels to your style...',
  'Building your perfect itinerary...',
];

export default function LoadingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <style>{`
        @keyframes orb {
          to { transform: rotate(360deg); }
        }
        @keyframes orb-reverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes core-pulse {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.85); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.9); }
          50% { opacity: 0.35; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center min-h-screen px-9 bg-[#08080c]">
        {/* Subtitle */}
        <div
          className="text-[10px] uppercase tracking-[0.03em] text-[#4a4a55] mb-9"
          style={{ animation: 'fade-up 0.6s ease-out 0.3s both' }}
        >
          Building your trip
        </div>

        {/* Orbital animation */}
        <div className="relative w-[120px] h-[120px] mb-11">
          {/* Glow behind */}
          <div
            className="absolute top-1/2 left-1/2 w-[140px] h-[140px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(200,164,78,0.12), transparent 70%)',
              animation: 'glow-pulse 2.5s ease-in-out infinite',
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'transparent',
              borderTopColor: '#c8a44e',
              animation: 'orb 3s linear infinite',
            }}
          />

          {/* Middle ring */}
          <div
            className="absolute rounded-full"
            style={{
              inset: '14px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'transparent',
              borderRightColor: 'rgba(200,164,78,0.35)',
              animation: 'orb-reverse 2s linear infinite',
            }}
          />

          {/* Inner ring */}
          <div
            className="absolute rounded-full"
            style={{
              inset: '28px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'transparent',
              borderBottomColor: 'rgba(200,164,78,0.15)',
              animation: 'orb 1.4s linear infinite',
            }}
          />

          {/* Core pulse */}
          <div
            className="absolute top-1/2 left-1/2 w-[44px] h-[44px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(200,164,78,0.1), transparent)',
              animation: 'core-pulse 2s ease-in-out infinite',
            }}
          />

          {/* D logo */}
          <div
            className="absolute inset-0 flex items-center justify-center font-serif text-[24px] font-light text-[#c8a44e]"
            style={{ letterSpacing: '-0.02em' }}
          >
            D
          </div>
        </div>

        {/* Steps */}
        <div className="w-full max-w-[250px]">
          {steps.map((text, i) => {
            const isActive = i === activeStep;
            const isDone = i < activeStep;
            const isVisible = i <= activeStep;

            return (
              <div
                key={i}
                className="flex items-center gap-2.5 py-2 transition-all duration-500"
                style={{
                  opacity: isVisible ? (isDone ? 0.25 : 1) : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(6px)',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0 transition-all duration-400"
                  style={{
                    background: isActive ? '#c8a44e' : '#4a4a55',
                    boxShadow: isActive ? '0 0 10px rgba(200,164,78,0.5)' : 'none',
                  }}
                />
                <div
                  className="text-[13px] leading-snug"
                  style={{
                    color: isActive ? '#c8a44e' : '#7a7a88',
                    letterSpacing: '0.01em',
                  }}
                >
                  {text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancel */}
        <div className="mt-8 text-[12px] text-[#4a4a55] tracking-[0.02em]">
          Taking longer than usual?{' '}
          <button
            onClick={() => router.push('/m/plan/destinations')}
            aria-label="Cancel trip generation"
            className="text-[#c8a44e] font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
