-- E-mail único para login/reset de clientes (ignora placeholders do agendamento anônimo).
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique_idx
  ON public.clients (lower(email))
  WHERE email IS NOT NULL
    AND btrim(email) <> ''
    AND email NOT ILIKE 'whatsapp\_%@temp.local' ESCAPE '\';

CREATE INDEX IF NOT EXISTS clients_email_lookup_idx
  ON public.clients (lower(email));

COMMENT ON TABLE public.client_password_resets IS
  'Tokens de redefinição de senha do cliente (hash). Envio por e-mail via Resend; phone guarda o WhatsApp da conta no momento do pedido.';
