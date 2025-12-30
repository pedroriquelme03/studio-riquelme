import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface DateTimePickerProps {
  onBack: () => void;
  onDateTimeSelect: (date: Date, time: string) => void;
  serviceDuration: number;
}

const Calendar: React.FC<{ selectedDate: Date; onDateSelect: (date: Date) => void }> = ({ selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const days = [];
  let day = new Date(startDate);
  while (day <= endOfMonth || days.length % 7 !== 0) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();
  const isSelected = (date: Date) => selectedDate.toDateString() === date.toDateString();
  const isPast = (date: Date) => date < new Date() && !isToday(date);

  const changeMonth = (amount: number) => {
    setCurrentMonth(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(newDate.getMonth() + amount);
        return newDate;
    });
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronLeftIcon className="w-5 h-5" /></button>
        <h3 className="font-bold text-lg">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronRightIcon className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-400 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => !isPast(d) && onDateSelect(d)}
            disabled={isPast(d)}
            className={`w-10 h-10 rounded-full transition-colors duration-200
              ${isPast(d) ? 'text-gray-600 cursor-not-allowed' : 'hover:bg-amber-500 hover:text-gray-900'}
              ${d.getMonth() !== currentMonth.getMonth() ? 'text-gray-500' : 'text-white'}
              ${isToday(d) && !isSelected(d) ? 'border border-amber-500' : ''}
              ${isSelected(d) ? 'bg-amber-500 text-gray-900 font-bold' : ''}
            `}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
};

const generateTimeSlots = (serviceDuration: number): { morning: string[], afternoon: string[], evening: string[] } => {
    // Mock availability
    const morning = ['09:00', '09:30', '10:00', '10:45', '11:30'];
    const afternoon = ['13:00', '13:30', '14:15', '15:00', '15:45', '16:30', '17:15'];
    const evening = ['18:00', '18:45', '19:30'];
    return { morning, afternoon, evening };
};

const DateTimePicker: React.FC<DateTimePickerProps> = ({ onBack, onDateTimeSelect, serviceDuration }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const availableSlots = useMemo(() => generateTimeSlots(serviceDuration), [serviceDuration]);
  
  const handleNext = () => {
    if (selectedDate && selectedTime) {
      onDateTimeSelect(selectedDate, selectedTime);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-800/50 p-6 md:p-8 rounded-2xl border border-gray-700 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">Escolha a Data e Hora</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>
        <div className="max-h-[400px] overflow-y-auto pr-2">
            <h3 className="font-bold text-lg mb-4">Horários disponíveis para {selectedDate.toLocaleDateString('pt-BR')}</h3>
            {Object.entries(availableSlots).map(([period, slots]) => (
                <div key={period} className="mb-4">
                    <h4 className="font-semibold text-amber-400 mb-2 capitalize">{period === 'morning' ? 'Manhã' : period === 'afternoon' ? 'Tarde' : 'Noite'}</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {/* Fix: Use Array.isArray as a type guard to ensure 'slots' is treated as an array, resolving the 'unknown' type issue. */}
                        {Array.isArray(slots) && slots.map(time => (
                            <button 
                                key={time} 
                                onClick={() => setSelectedTime(time)}
                                className={`p-2 rounded-lg transition-colors duration-200 border-2
                                    ${selectedTime === time ? 'bg-amber-500 text-gray-900 border-amber-500 font-bold' : 'bg-gray-700 border-gray-600 hover:border-amber-400'}
                                `}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>
      <div className="flex justify-between mt-8 border-t border-gray-700 pt-6">
        <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors">Voltar</button>
        <button 
            onClick={handleNext}
            disabled={!selectedTime}
            className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400"
        >
            Próximo
        </button>
      </div>
    </div>
  );
};

export default DateTimePicker;