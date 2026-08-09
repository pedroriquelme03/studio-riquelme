-- Script para criar os usuários admin
-- Execute este SQL no Supabase SQL Editor

-- Usuário 1: anariquelme
-- Senha: 6YnP0#b0H
-- Hash SHA-256: 79cb9647c9f94a5f082ab755e27d9ea4e0d1247caba0a6d24fc5bd8455f17ac1
INSERT INTO public.admins (username, password_hash, name, email, is_active)
VALUES (
    'anariquelme',
    '79cb9647c9f94a5f082ab755e27d9ea4e0d1247caba0a6d24fc5bd8455f17ac1',
    'Ana Clara Riquelme',
    'ana@studioriquelme.com.br',
    true
)
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Usuário 2: biiariquelme
-- Senha: 53$92H3Fs
-- Hash SHA-256: 460f4be59bdc0f4250d40adc272d856b80b6dfc7e962a1371c9e16ed329c07a5
INSERT INTO public.admins (username, password_hash, name, email, is_active)
VALUES (
    'biiariquelme',
    '460f4be59bdc0f4250d40adc272d856b80b6dfc7e962a1371c9e16ed329c07a5',
    'Ana Beatriz Riquelme',
    'biia@studioriquelme.com.br',
    true
)
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
