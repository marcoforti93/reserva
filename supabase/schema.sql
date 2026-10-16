-- ============================================================
-- ESPAÇO ETEC — RESERVA DE LABORATÓRIOS
-- ETEC Dr. Domingos Minicucci Filho (Unidade 051)
-- Script de Criação e Configuração do Banco de Dados SUPABASE (PostgreSQL)
-- ============================================================
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Acesse o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique no ícone "SQL Editor"
-- 3. Clique em "+ New query"
-- 4. Cole TODO o conteúdo deste arquivo e clique no botão verde "Run"
-- 5. Pronto! Suas tabelas, permissões, realtime e dados iniciais estarão configurados.
-- ============================================================

-- Habilita extensão pgcrypto para geração de UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABELA: laboratorios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.laboratorios (
    id TEXT PRIMARY KEY DEFAULT 'lab_' || substr(gen_random_uuid()::text, 1, 8),
    nome TEXT NOT NULL UNIQUE,
    capacidade INTEGER NOT NULL DEFAULT 40,
    descricao TEXT DEFAULT '',
    recursos JSONB DEFAULT '[]'::jsonb,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 2. TABELA: professores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.professores (
    id TEXT PRIMARY KEY DEFAULT 'prof_' || substr(gen_random_uuid()::text, 1, 8),
    nome TEXT NOT NULL,
    email TEXT DEFAULT '',
    disciplinas JSONB DEFAULT '[]'::jsonb,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3. TABELA: cursos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cursos (
    id TEXT PRIMARY KEY DEFAULT 'cur_' || substr(gen_random_uuid()::text, 1, 8),
    nome TEXT NOT NULL UNIQUE,
    sigla TEXT DEFAULT '',
    periodo TEXT DEFAULT '',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 4. TABELA: turmas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.turmas (
    id TEXT PRIMARY KEY DEFAULT 'tur_' || substr(gen_random_uuid()::text, 1, 8),
    nome TEXT NOT NULL UNIQUE,
    turno TEXT DEFAULT '',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 5. TABELA: disciplinas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disciplinas (
    id TEXT PRIMARY KEY DEFAULT 'disc_' || substr(gen_random_uuid()::text, 1, 8),
    nome TEXT NOT NULL,
    sigla TEXT DEFAULT '',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 6. TABELA: atribuicoes (Professor x Curso x Turma x Disciplina x Sigla)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atribuicoes (
    id TEXT PRIMARY KEY DEFAULT 'atr_' || substr(gen_random_uuid()::text, 1, 8),
    professor TEXT NOT NULL,
    curso TEXT DEFAULT '',
    turma TEXT DEFAULT '',
    disciplina TEXT NOT NULL,
    sigla TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 7. TABELA: reservas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reservas (
    id TEXT PRIMARY KEY DEFAULT 'res_' || substr(gen_random_uuid()::text, 1, 10),
    data DATE NOT NULL,
    turno TEXT NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
    lab_id TEXT NOT NULL REFERENCES public.laboratorios(id) ON DELETE CASCADE,
    lab_nome TEXT NOT NULL,
    professor_id TEXT DEFAULT '',
    professor_nome TEXT NOT NULL,
    curso_id TEXT DEFAULT '',
    curso_nome TEXT DEFAULT '',
    turma_id TEXT DEFAULT '',
    turma_nome TEXT DEFAULT '',
    disciplina_id TEXT DEFAULT '',
    disciplina_nome TEXT DEFAULT '',
    disciplina_sigla TEXT DEFAULT '',
    aulas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de números de aula, ex: [1, 2]
    recursos_extras JSONB DEFAULT '[]'::jsonb,
    observacoes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pendente', 'manutencao', 'rejeitado')),
    recorrente BOOLEAN NOT NULL DEFAULT false,
    recorrente_ate DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para consultas ultrarrápidas (<15ms) no calendário
CREATE INDEX IF NOT EXISTS idx_reservas_data_turno ON public.reservas (data, turno);
CREATE INDEX IF NOT EXISTS idx_reservas_lab ON public.reservas (lab_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON public.reservas (status);

-- ============================================================
-- 8. TABELA: usuarios (Controle de Acesso e Perfis)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY DEFAULT 'usr_' || substr(gen_random_uuid()::text, 1, 8),
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    nome TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'professor' CHECK (perfil IN ('admin', 'professor')),
    professor_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 9. CONFIGURAÇÃO DE SEGURANÇA (Row Level Security - RLS)
-- ============================================================
-- Habilita RLS em todas as tabelas
ALTER TABLE public.laboratorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público/anon para a aplicação Single-Page
-- (Permite leitura e escrita via Anon Key para manter compatibilidade com o frontend SPA)
DO $$
BEGIN
    -- laboratorios
    DROP POLICY IF EXISTS "Anon acesso total laboratorios" ON public.laboratorios;
    CREATE POLICY "Anon acesso total laboratorios" ON public.laboratorios FOR ALL USING (true) WITH CHECK (true);

    -- professores
    DROP POLICY IF EXISTS "Anon acesso total professores" ON public.professores;
    CREATE POLICY "Anon acesso total professores" ON public.professores FOR ALL USING (true) WITH CHECK (true);

    -- cursos
    DROP POLICY IF EXISTS "Anon acesso total cursos" ON public.cursos;
    CREATE POLICY "Anon acesso total cursos" ON public.cursos FOR ALL USING (true) WITH CHECK (true);

    -- turmas
    DROP POLICY IF EXISTS "Anon acesso total turmas" ON public.turmas;
    CREATE POLICY "Anon acesso total turmas" ON public.turmas FOR ALL USING (true) WITH CHECK (true);

    -- disciplinas
    DROP POLICY IF EXISTS "Anon acesso total disciplinas" ON public.disciplinas;
    CREATE POLICY "Anon acesso total disciplinas" ON public.disciplinas FOR ALL USING (true) WITH CHECK (true);

    -- atribuicoes
    DROP POLICY IF EXISTS "Anon acesso total atribuicoes" ON public.atribuicoes;
    CREATE POLICY "Anon acesso total atribuicoes" ON public.atribuicoes FOR ALL USING (true) WITH CHECK (true);

    -- reservas
    DROP POLICY IF EXISTS "Anon acesso total reservas" ON public.reservas;
    CREATE POLICY "Anon acesso total reservas" ON public.reservas FOR ALL USING (true) WITH CHECK (true);

    -- usuarios
    DROP POLICY IF EXISTS "Anon acesso total usuarios" ON public.usuarios;
    CREATE POLICY "Anon acesso total usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ============================================================
-- 10. REALTIME — SINCRONIZAÇÃO INSTANTÂNEA VIA WEBSOCKET
-- ============================================================
-- Adiciona a tabela de reservas à publicação realtime do Supabase
-- (Quando qualquer usuário criar, editar ou cancelar uma reserva,
--  o Supabase notifica instantaneamente todas as telas abertas!)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ============================================================
-- 11. CARGA INICIAL DE DADOS PADRÃO (SEED DATA)
-- ============================================================

-- 11.1 Laboratórios Oficiais da ETEC (conforme a grade do sistema)
INSERT INTO public.laboratorios (id, nome, capacidade, descricao, ativo) VALUES
    ('lab_23', 'LAB 23', 40, 'Laboratório de Informática / Desenvolvimento', true),
    ('lab_40', 'LAB 40', 40, 'Laboratório de Redes e Manutenção', true),
    ('lab_47', 'LAB 47', 40, 'Laboratório Multidisciplinar', true),
    ('lab_48', 'LAB 48', 40, 'Laboratório de Informática Geral', true),
    ('lab_50', 'LAB 50', 40, 'Laboratório de Hardware / Projetos', true),
    ('lab_51', 'LAB 51', 40, 'Laboratório de Informática', true),
    ('lab_53', 'LAB 53', 40, 'Laboratório de Desenvolvimento de Sistemas', true),
    ('lab_54', 'LAB 54', 40, 'Laboratório de Sistemas Embarcados', true),
    ('lab_55', 'LAB 55', 40, 'Laboratório de Informática Avançada', true),
    ('lab_56', 'LAB 56', 40, 'Laboratório de Automação / Mecânica', true),
    ('lab_57', 'LAB 57', 40, 'Laboratório de Informática para Internet', true),
    ('lab_58', 'LAB 58', 40, 'Laboratório de Apoio e Projetos', true)
ON CONFLICT (nome) DO UPDATE SET ativo = true;

-- 11.2 Usuário Administrador Padrão
INSERT INTO public.usuarios (id, email, senha, nome, perfil) VALUES
    ('usr_admin_principal', 'admin@escola.edu.br', 'admin123', 'Administrador TI / Coordenação', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 11.3 Cursos Padrão da ETEC
INSERT INTO public.cursos (nome, sigla, periodo, ativo) VALUES
    ('M-TEC Desenvolvimento de Sistemas', 'M-DS', 'Integrado', true),
    ('M-TEC Informática para Internet', 'M-INFO', 'Integrado', true),
    ('M-TEC Administração', 'M-ADM', 'Integrado', true),
    ('M-TEC Logística', 'M-LOG', 'Integrado', true),
    ('M-TEC Recursos Humanos', 'M-RH', 'Integrado', true),
    ('M-TEC Marketing', 'M-MKT', 'Integrado', true),
    ('M-TEC Contabilidade', 'M-CONT', 'Integrado', true),
    ('Desenvolvimento de Sistemas (Noturno)', 'DS (N)', 'Noturno', true),
    ('Informática para Internet (Noturno)', 'INFO (N)', 'Noturno', true),
    ('Administração (Noturno)', 'ADM (N)', 'Noturno', true),
    ('Logística (Noturno)', 'LOG (N)', 'Noturno', true),
    ('Recursos Humanos (Noturno)', 'RH (N)', 'Noturno', true),
    ('Enfermagem', 'ENF', 'Tarde', true)
ON CONFLICT (nome) DO NOTHING;

-- 11.4 Turmas Padrão
INSERT INTO public.turmas (nome, turno, ativo) VALUES
    ('1º M-TEC Informática para Internet', 'manha', true),
    ('2º M-TEC Informática para Internet', 'manha', true),
    ('3º M-TEC Informática para Internet', 'manha', true),
    ('1º M-TEC Desenvolvimento de Sistemas', 'manha', true),
    ('2º M-TEC Desenvolvimento de Sistemas', 'manha', true),
    ('3º M-TEC Desenvolvimento de Sistemas', 'manha', true),
    ('1º M-TEC Administração', 'manha', true),
    ('2º M-TEC Administração', 'manha', true),
    ('3º M-TEC Administração', 'manha', true),
    ('1º M-TEC Logística', 'manha', true),
    ('2º M-TEC Logística', 'manha', true),
    ('3º M-TEC Logística', 'manha', true),
    ('1º Desenvolvimento de Sistemas (Noturno)', 'noite', true),
    ('2º Desenvolvimento de Sistemas (Noturno)', 'noite', true),
    ('3º Desenvolvimento de Sistemas (Noturno)', 'noite', true),
    ('1º Informática para Internet (Noturno)', 'noite', true),
    ('2º Informática para Internet (Noturno)', 'noite', true),
    ('3º Informática para Internet (Noturno)', 'noite', true)
ON CONFLICT (nome) DO NOTHING;
