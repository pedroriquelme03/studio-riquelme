#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para converter arquivos JSON ou CSV de serviços em SQL INSERT
Uso: python convert-services-to-sql.py [arquivo.json|arquivo.csv]
"""

import json
import csv
import sys
import os

def escape_sql_string(value):
    """Escapa aspas simples para SQL"""
    if value is None:
        return ''
    return str(value).replace("'", "''")

def convert_json_to_sql(json_file):
    """Converte arquivo JSON para SQL INSERT"""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            services = json.load(f)
    except Exception as e:
        print(f"❌ Erro ao ler arquivo JSON: {e}")
        return None
    
    sql_values = []
    for idx, service in enumerate(services, 1):
        # Validar campos obrigatórios
        if 'name' not in service or 'price' not in service or 'duration_minutes' not in service:
            print(f"⚠️  Aviso: Serviço #{idx} está faltando campos obrigatórios (name, price, duration_minutes)")
            continue
        
        name = escape_sql_string(service['name'])
        description = escape_sql_string(service.get('description', ''))
        price = float(service['price'])
        duration = int(service['duration_minutes'])
        professional_id = service.get('responsible_professional_id')
        
        # Formatar professional_id
        if professional_id and professional_id != 'NULL' and professional_id != '':
            professional_id_str = f"'{professional_id}'"
        else:
            professional_id_str = 'NULL'
        
        sql_values.append(f"    ('{name}', {price}, {duration}, '{description}', {professional_id_str})")
    
    if not sql_values:
        print("❌ Nenhum serviço válido encontrado!")
        return None
    
    sql = f"""-- ============================================
-- SQL gerado automaticamente a partir de: {os.path.basename(json_file)}
-- Total de serviços: {len(sql_values)}
-- ============================================

INSERT INTO public.services (name, price, duration_minutes, description, responsible_professional_id)
VALUES
{',\n'.join(sql_values)}
ON CONFLICT DO NOTHING;

-- Verificar serviços inseridos
SELECT 
    id,
    name,
    price,
    duration_minutes,
    description,
    created_at
FROM public.services
ORDER BY name;
"""
    
    return sql

def convert_csv_to_sql(csv_file):
    """Converte arquivo CSV para SQL INSERT"""
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            services = list(reader)
    except Exception as e:
        print(f"❌ Erro ao ler arquivo CSV: {e}")
        return None
    
    sql_values = []
    for idx, service in enumerate(services, 1):
        # Validar campos obrigatórios
        if 'name' not in service or 'price' not in service or 'duration_minutes' not in service:
            print(f"⚠️  Aviso: Linha #{idx} está faltando campos obrigatórios")
            continue
        
        name = escape_sql_string(service['name'].strip())
        description = escape_sql_string(service.get('description', '').strip())
        
        try:
            price = float(service['price'].strip())
            duration = int(service['duration_minutes'].strip())
        except ValueError as e:
            print(f"⚠️  Aviso: Linha #{idx} tem valores inválidos (price ou duration_minutes): {e}")
            continue
        
        professional_id = service.get('responsible_professional_id', '').strip()
        
        # Formatar professional_id
        if professional_id and professional_id.upper() != 'NULL' and professional_id != '':
            professional_id_str = f"'{professional_id}'"
        else:
            professional_id_str = 'NULL'
        
        sql_values.append(f"    ('{name}', {price}, {duration}, '{description}', {professional_id_str})")
    
    if not sql_values:
        print("❌ Nenhum serviço válido encontrado!")
        return None
    
    sql = f"""-- ============================================
-- SQL gerado automaticamente a partir de: {os.path.basename(csv_file)}
-- Total de serviços: {len(sql_values)}
-- ============================================

INSERT INTO public.services (name, price, duration_minutes, description, responsible_professional_id)
VALUES
{',\n'.join(sql_values)}
ON CONFLICT DO NOTHING;

-- Verificar serviços inseridos
SELECT 
    id,
    name,
    price,
    duration_minutes,
    description,
    created_at
FROM public.services
ORDER BY name;
"""
    
    return sql

def main():
    if len(sys.argv) < 2:
        print("📋 Conversor de Serviços para SQL")
        print("=" * 50)
        print("\nUso:")
        print(f"  python {sys.argv[0]} <arquivo.json>")
        print(f"  python {sys.argv[0]} <arquivo.csv>")
        print("\nExemplos:")
        print(f"  python {sys.argv[0]} services-template.json")
        print(f"  python {sys.argv[0]} meus-servicos.csv")
        print("\nO SQL será exibido no terminal e salvo em 'output-services.sql'")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    if not os.path.exists(input_file):
        print(f"❌ Arquivo não encontrado: {input_file}")
        sys.exit(1)
    
    # Detectar tipo de arquivo
    file_ext = os.path.splitext(input_file)[1].lower()
    
    if file_ext == '.json':
        print(f"📄 Convertendo JSON: {input_file}")
        sql = convert_json_to_sql(input_file)
    elif file_ext == '.csv':
        print(f"📄 Convertendo CSV: {input_file}")
        sql = convert_csv_to_sql(input_file)
    else:
        print(f"❌ Formato não suportado: {file_ext}")
        print("   Use arquivos .json ou .csv")
        sys.exit(1)
    
    if sql:
        # Salvar em arquivo
        output_file = 'output-services.sql'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sql)
        
        print(f"\n✅ SQL gerado com sucesso!")
        print(f"📁 Arquivo salvo em: {output_file}")
        print("\n" + "=" * 50)
        print("SQL Gerado:")
        print("=" * 50)
        print(sql)
        print("\n💡 Próximos passos:")
        print("   1. Copie o SQL acima")
        print("   2. Cole no SQL Editor do Supabase")
        print("   3. Execute o script")
    else:
        print("❌ Falha ao gerar SQL")
        sys.exit(1)

if __name__ == '__main__':
    main()

