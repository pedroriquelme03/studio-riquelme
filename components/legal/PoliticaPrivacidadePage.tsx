import React from 'react';
import { Link } from 'react-router-dom';

const ULTIMA_ATUALIZACAO = '06 de maio de 2026';

const PoliticaPrivacidadePage: React.FC = () => (
  <article className="max-w-3xl mx-auto text-gray-800">
    <p className="text-sm text-gray-500 mb-2">
      <Link to="/" className="text-pink-600 hover:text-pink-700">
        Voltar ao início
      </Link>
      <span aria-hidden className="mx-2">
        /
      </span>
      <Link to="/termos-de-servicos" className="text-pink-600 hover:text-pink-700">
        Termos de Serviço
      </Link>
    </p>
    <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
    <p className="text-sm text-gray-600 mb-8">Última atualização: {ULTIMA_ATUALIZACAO}</p>

    <div className="space-y-6 text-[15px] leading-relaxed">
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Controlador dos dados</h2>
        <p>
          O presente site de agendamento online está vinculado ao estabelecimento <strong>Studio Riquelme</strong>.
          Esta Política descreve como tratamos dados pessoais quando você utiliza este sistema (agendamento
          público, área administrativa quando aplicável e área do cliente, quando configurada).
        </p>
        <p className="mt-2">
          Para solicitações sobre privacidade, utilize os canais de contato disponíveis nas informações do
          estabelecimento (rodapé do site ou canais institucionais informados pela equipe).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Que dados tratamos</h2>
        <p className="mb-2">Dependendo do uso da plataforma, podemos tratar:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Dados de agendamento:</strong> nome, telefone, e-mail (quando informado), serviços
            escolhidos, data e horário, observações opcionais, profissional vinculado quando selecionado.
          </li>
          <li>
            <strong>Dados técnicos e operacionais:</strong> identificadores de registros na base de dados,
            histórico operacional relacionado a agendamentos (por exemplo cancelamentos ou pedidos de
            alteração, quando disponíveis no sistema), registros gerados pela aplicação.
          </li>
          <li>
            <strong>Autenticação de administradores ou clientes:</strong> quando o sistema utiliza
            provedores de login (por exemplo serviços de autenticação de terceiros), dados tratados ficam
            também sujeitos às políticas desses prestadores.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Para que usamos seus dados</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Viabilizar a marcação, alteração ou cancelamento de horários conforme disponibilidade.</li>
          <li>
            Comunicações operacionais sobre o seu agendamento (por exemplo confirmação ou aviso quando esta
            função estiver ativa via WhatsApp utilizando números fornecidos).
          </li>
          <li>Administração interna da agenda, suporte aos profissionais e melhor funcionamento do serviço.</li>
          <li>Cumprir obrigações legais quando exigidas e responder a solicitações legítimas de autoridades.</li>
          <li>Segurança da plataforma, prevenção a abuso e cumprimento de boas práticas técnicas.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Como compartilhamos dados</h2>
        <p className="mb-2">
          Para operação do sistema utilizamos prestadores tecnológicos, que tratam dados em nome ou em
          apoio ao estabelecimento, sempre limitados ao necessário:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Supabase</strong> ou infraestrutura equivalente configurada pelo projeto para banco de
            dados e serviços de backend.
          </li>
          <li>
            <strong>Hospedagem e APIs</strong> na nuvem (por exemplo plataforma de deploy utilizada pela
            aplicação para entregar páginas e rotas da API quando aplicável).
          </li>
          <li>
            <strong>WhatsApp Cloud API (Meta)</strong>, quando mensagens automatizadas forem disparadas pela
            operação (por exemplo mensagem enviada após confirmação no painel ou fluxos relacionados ao
            agendamento); o tratamento também observa políticas da Meta.
          </li>
          <li>
            <strong>Ferramentas de automação (por exemplo webhook n8n)</strong>, apenas se estiver ativo na
            implantação, para encaminhar eventos do sistema quando configurado pela equipe técnica.
          </li>
        </ul>
        <p className="mt-2">
          Não vendemos suas informações pessoais. Prestadores ficam obrigados via contratos e configurações
          técnicas de uso adequado aos fins descritos aqui.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Base legal (LGPD — Lei 13.709/2018)</h2>
        <p className="mb-2">
          Tratamos dados com base aplicável conforme cada situação, em especial execução de procedimentos
          relacionados a serviços agendados, legítimo interesse onde cabível para funcionamento seguro da
          plataforma e comunicações operacionais proporcionais, cumprimento de obrigações legais ou
          consentimento quando exigido (por exemplo certas comunicações de marketing quando existirem e forem
          opcionais).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Cookies, armazenamento local e sessão</h2>
        <p>
          A aplicação pode utilizar armazenamento local no navegador estritamente necessário ao funcionamento,
          inclusive para manutenção de sessão em áreas restritas quando existirem. Recomenda-se consultar os
          ajustes do navegador para gestão desses dados.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Prazos de conservação</h2>
        <p>
          Mantemos os dados pelo período necessário para prestação dos serviços contratados, cumprimento de
          obrigações legais quando aplicável, resolução de disputas e histórico operacional compatível com a
          atividade da barbearia/salão, salvo quando a lei ou ordem válida estabeleça outra regra.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Seus direitos</h2>
        <p className="mb-2">
          Nos termos da legislação aplicável, você pode solicitar informações sobre o tratamento, acesso,
          correção ou atualização de dados inexatos, limitação quando cabível e outras garantias conforme a
          LGPD e regulamentação relacionada.
        </p>
        <p className="mb-2">
          Para exercer seus direitos, procure o Studio Riquelme pelos mesmos meios disponibilizados no site
          (por exemplo dados de contato no rodapé) e inclua dados que ajudem a localizar seus agendamentos
          (nome e telefone).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Segurança</h2>
        <p>
          Adotamos medidas razoáveis de segurança no limite técnico e organizacional típico de um sistema como
          este (controle de acesso administrativo, ambiente hospedado, comunicações configuradas pela
          operação). Nenhum método de transmissão ou armazenamento é livre de risco.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Transferência internacional</h2>
        <p>
          Alguns prestadores tecnológicos podem processar dados em servidores fora do Brasil. Quando esse for
          o caso, aplicam-se garantias compatíveis com a legislação aplicável conforme configurado pela
          operação e obrigações legais.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">11. Alterações desta política</h2>
        <p>
          Podemos atualizar este texto quando houver mudanças relevantes no sistema ou na legislação. A nova
          versão será divulgada nesta página com data de atualização revisada no topo do documento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">12. Aviso importante</h2>
        <p className="text-gray-600 italic">
          Este texto tem caráter informativo e foi elaborado com base nos recursos típicos do sistema de
          agendamento. Não substitui orientação jurídica personalizada ao estabelecimento.
        </p>
      </section>
    </div>
  </article>
);

export default PoliticaPrivacidadePage;
