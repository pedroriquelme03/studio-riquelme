
import React from 'react';

interface StepIndicatorProps {
  currentStep: 'services' | 'datetime' | 'details';
}

const steps = [
  { id: 'services', title: '1. Serviços' },
  { id: 'datetime', title: '2. Data & Hora' },
  { id: 'details', title: '3. Seus Dados' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                <p className={`mt-2 text-xs md:text-sm font-semibold ${isActive ? 'text-amber-500' : 'text-gray-500'}`}>
                  {step.title.split('. ')[1]}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                  isActive && index < currentStepIndex ? 'bg-amber-500' : 'bg-gray-300'
                }`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
