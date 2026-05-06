import React from 'react';
import { Link } from 'react-router-dom';

const ULTIMA_ATUALIZACAO = '06 de maio de 2026';

const TermosServicosPage: React.FC = () => (
  <article className="max-w-3xl mx-auto text-gray-800">
    <p className="text-sm text-gray-500 mb-2">
      <Link to="/" className="text-pink-600 hover:text-pink-700">
        Voltar ao início
      </Link>
      <span aria-hidden className="mx-2">
        /
      </span>
      <Link to="/politica-de-privacidade" className="text-pink-600 hover:text-pink-700">
        Política de Privacidade
      </Link>
    </p>
    <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Serviço</h1>
    <p className="text-sm text-gray-600 mb-8">Última atualização: {ULTIMA_ATUALIZACAO}</p>

    <div className="space-y-6 text-[15px] leading-relaxed">
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Aceitação</h2>
        <p>
          Ao acessar ou utilizar este site ou aplicação de agendamento do <strong>Studio Riquelme</strong>,
          você concorda em cumprir estes Termos. Se não concordar, não utilize o serviço digital de
          agendamento.
        </p>
        <p className="mt-2">
          O tratamento de dados pessoais observa também a{' '}
          <Link to="/politica-de-privacidade" className="text-pink-600 hover:text-pink-700 underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Objetivo do serviço digital</h2>
        <p>
          O sistema tem finalidade exclusiva de <strong>facilitar agendamentos de serviços</strong> conforme a
          disponibilidade configurada pela equipe no painel administrativo. A existência do horário no sistema
          não garante disponibilidade em caso indisponibilidade extraordinária; nesses casos, o estabelecimento
          pode contatá-lo para ajustes.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Prestador físico dos serviços</h2>
        <p>
          Corte de cabelo, barba ou demais serviços relacionados são prestados <strong>no estabelecimento</strong>.
          Este site não substitui a relação direta sobre condições de pagamento à vista do atendimento, política
          de garantia pontual conforme combinado ou demais contratos típicos entre consumidor e comerciante nas
          regras do estabelecimento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Precisão das informações</h2>
        <p>
          Você deve fornecer <strong>dados verdadeiros e atualizados</strong>. Telefone incorreto ou inválido
          pode impedir confirmações ou comunicações relacionadas ao agendamento quando esses recursos
          estiverem ativos no sistema (por exemplo notificações automatizadas).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Alterações e cancelamentos</h2>
        <p className="mb-2">
          Regras de cancelamento ou remarcação seguem orientações do próprio Studio Riquelme. Quando disponível
          no sistema:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>O cliente poderá solicitar alterações dentro dos fluxos disponíveis na aplicação, quando configurados;</li>
          <li>O painel administrativo pode aprovar, negar ou ajustar datas e horários, conforme a operação;</li>
          <li>Cancelamentos realizados através do sistema geram registros operacionais coerentes com o projeto.</li>
        </ul>
        <p className="mt-2">
          Informe-se sobre prazos mínimos, multas ou bloqueios por falta (no-show) diretamente com o
          estabelecimento, pois são práticas comerciais específicas.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Uso aceitável</h2>
        <p className="mb-2">É vedado ao usuário:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Utilizar o sistema para fins ilícitos, fraudes ou envio não solicitado;</li>
          <li>Tentar acesso não autorizado a áreas restritas ou contas administrativas;</li>
          <li>Comprometer a segurança ou a estabilidade da plataforma (ataques de negação de serviço, scanners abusivos, etc.).</li>
        </ul>
        <p className="mt-2">
          O Studio Riquelme pode recusar agendamentos, suspender uso ou aplicar filtros ante uso abusivo ou
          fraude presumida.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Credenciais e painel administrativo</h2>
        <p>
          Quem mantém conta de administrador é responsável por senhas seguras e por todas as operações feitas no
          painel, incluindo confirmação de horários ou alterações nos cadastros, conforme as permissões
          concedidas pela operação interna do estabelecimento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Limitação de responsabilidade tecnológica</h2>
        <p className="mb-2">
          O funcionamento da plataforma depende da internet e de prestadores externos (infraestrutura, APIs e
          serviços de mensagem). Nas medidas admitidas pela legislação brasileira:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Não há garantia de disponibilidade ininterrupta nem de ausência de falhas pontuais;</li>
          <li>
            O estabelecimento não responde por danos indiretos de caráter remoto relacionados apenas a indisponibilidade
            momentânea do site, quando não houver dolo ou culpa grave configurada.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Direitos sobre o sistema</h2>
        <p>
          Marca “Studio Riquelme”, textos institucionais, layout desenvolvido para este agendamento e integrações de
          software permanecem de titularidade do estabelecimento e/ou de terceiros licenciantes, salvo código ou
          componentes públicos já regidos pelas suas respectivas licenças.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Legislação e foro</h2>
        <p className="mb-2">
          Estes Termos são interpretados segundo as leis da <strong>República Federativa do Brasil</strong>.
        </p>
        <p>
          Consumidores (art. 2º do CDC quando aplicável) ficam facultados aos foros especiais sobre essa lei;
          demais partes poderão eleger o foro da comarca do domicílio do Studio Riquelme, onde estabelecidos seus
          serviços presenciais, salvo divergência obrigatória da lei.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">11. Contato</h2>
        <p>
          Dúvidas sobre estes Termos podem ser encaminhadas pelos mesmos meios disponibilizados no rodapé do site
          (telefone, WhatsApp ou demais dados que o Studio Riquelme divulgar publicamente nesta aplicação).
        </p>
      </section>
    </div>
  </article>
);

export default TermosServicosPage;
