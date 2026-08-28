import React from 'react';
import { Link } from 'react-router-dom';

const MonthlyPlansPromoCard: React.FC = () => (
  <Link
    to="/planos-mensais"
    className="monthly-plans-promo block mb-6 group"
  >
    <div className="monthly-plans-promo__inner relative overflow-hidden rounded-xl bg-surface-raised p-5 md:p-6 transition-transform duration-300 group-hover:scale-[1.01]">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold/80 mb-1">Assinatura mensal</p>
          <h3 className="text-lg md:text-xl font-bold text-white">Conheça nossos Planos Mensais</h3>
          <p className="text-sm text-zinc-300 mt-1">Benefícios exclusivos e economia em serviços recorrentes.</p>
        </div>
        <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gold text-white font-semibold text-sm whitespace-nowrap">
          Ver planos
        </span>
      </div>
    </div>
    <style>{`
      .monthly-plans-promo {
        position: relative;
        padding: 2px;
        border-radius: 0.85rem;
        background: linear-gradient(90deg, #b8860b, #f5d67b, #b8860b, #f5d67b);
        background-size: 300% 100%;
        animation: monthlyPlanBorder 6s linear infinite;
      }
      .monthly-plans-promo__inner {
        border-radius: calc(0.85rem - 2px);
      }
      @keyframes monthlyPlanBorder {
        0% { background-position: 0% 50%; }
        100% { background-position: 300% 50%; }
      }
    `}</style>
  </Link>
);

export default MonthlyPlansPromoCard;
