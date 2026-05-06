-- ============================================================================
-- SCRIPT COMPLETO DE BANCO DE DADOS - FEIMI CRM (ORCHESTRA AI)
-- ============================================================================

-- ============================================================================
-- START MIGRATION: 20251126124558_1a5616c0-b45d-46cc-b0e6-8a941987d4bb.sql
-- ============================================================================

-- ============================================================================
-- SISTEMA DE CHAT WHATSAPP COM IA (NINA) - SCHEMA COMPLETO
-- ============================================================================

-- PARTE 1: EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PARTE 2: ENUMs
CREATE TYPE conversation_status AS ENUM ('nina', 'human', 'paused');
CREATE TYPE message_from AS ENUM ('user', 'nina', 'human');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed', 'processing');
CREATE TYPE message_type AS ENUM ('text', 'audio', 'image', 'document', 'video');
CREATE TYPE queue_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE team_assignment AS ENUM ('mateus', 'igor', 'fe', 'vendas', 'suporte');

-- PARTE 3: TABELAS PRINCIPAIS

-- 3.1 CONTACTS
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    whatsapp_id TEXT,
    name TEXT,
    call_name TEXT,
    email TEXT,
    profile_picture_url TEXT,
    is_business BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_reason TEXT,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    client_memory JSONB DEFAULT '{
        "last_updated": null,
        "lead_profile": {
            "interests": [],
            "lead_stage": "new",
            "objections": [],
            "products_discussed": [],
            "communication_style": "unknown",
            "qualification_score": 0
        },
        "sales_intelligence": {
            "pain_points": [],
            "next_best_action": "qualify",
            "budget_indication": "unknown",
            "decision_timeline": "unknown"
        },
        "interaction_summary": {
            "response_pattern": "unknown",
            "last_contact_reason": "",
            "total_conversations": 0,
            "preferred_contact_time": "unknown"
        },
        "conversation_history": []
    }'::jsonb,
    first_contact_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contacts_phone_number_unique UNIQUE (phone_number)
);

CREATE INDEX idx_contacts_phone_number ON public.contacts(phone_number);
CREATE INDEX idx_contacts_whatsapp_id ON public.contacts(whatsapp_id);
CREATE INDEX idx_contacts_is_blocked ON public.contacts(is_blocked);
CREATE INDEX idx_contacts_last_activity ON public.contacts(last_activity DESC);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);
CREATE INDEX idx_contacts_created_at ON public.contacts(created_at DESC);

-- 3.2 CONVERSATIONS
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status conversation_status NOT NULL DEFAULT 'nina',
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_team team_assignment,
    assigned_user_id UUID,
    tags TEXT[] DEFAULT '{}',
    nina_context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_contact_id ON public.conversations(contact_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_is_active ON public.conversations(is_active);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX idx_conversations_tags ON public.conversations USING GIN(tags);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- 3.3 MESSAGES
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    reply_to_id UUID REFERENCES public.messages(id),
    whatsapp_message_id TEXT,
    type message_type NOT NULL DEFAULT 'text',
    from_type message_from NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    status message_status NOT NULL DEFAULT 'sent',
    processed_by_nina BOOLEAN DEFAULT false,
    nina_response_time INTEGER,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_whatsapp_message_id ON public.messages(whatsapp_message_id);
CREATE INDEX idx_messages_from_type ON public.messages(from_type);
CREATE INDEX idx_messages_sent_at ON public.messages(sent_at DESC);
CREATE INDEX idx_messages_status ON public.messages(status);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

-- 3.4 CONVERSATION_STATES
CREATE TABLE public.conversation_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
    current_state TEXT NOT NULL DEFAULT 'idle',
    last_action TEXT,
    last_action_at TIMESTAMPTZ,
    scheduling_context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_states_conversation_id ON public.conversation_states(conversation_id);
CREATE INDEX idx_conversation_states_current_state ON public.conversation_states(current_state);

-- PARTE 4: TABELAS DE FILAS

-- 4.1 MESSAGE_GROUPING_QUEUE
CREATE TABLE public.message_grouping_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_message_id TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    message_data JSONB NOT NULL,
    contacts_data JSONB,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_grouping_queue_processed ON public.message_grouping_queue(processed);
CREATE INDEX idx_message_grouping_queue_phone_number_id ON public.message_grouping_queue(phone_number_id);
CREATE INDEX idx_message_grouping_queue_created_at ON public.message_grouping_queue(created_at);

-- 4.2 MESSAGE_PROCESSING_QUEUE
CREATE TABLE public.message_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_message_id TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    status queue_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 1,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    scheduled_for TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_processing_queue_status ON public.message_processing_queue(status);
CREATE INDEX idx_message_processing_queue_scheduled_for ON public.message_processing_queue(scheduled_for);
CREATE INDEX idx_message_processing_queue_priority ON public.message_processing_queue(priority DESC);

-- 4.3 NINA_PROCESSING_QUEUE
CREATE TABLE public.nina_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    context_data JSONB,
    status queue_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 1,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    scheduled_for TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nina_processing_queue_status ON public.nina_processing_queue(status);
CREATE INDEX idx_nina_processing_queue_message_id ON public.nina_processing_queue(message_id);
CREATE INDEX idx_nina_processing_queue_conversation_id ON public.nina_processing_queue(conversation_id);
CREATE INDEX idx_nina_processing_queue_scheduled_for ON public.nina_processing_queue(scheduled_for);
CREATE INDEX idx_nina_processing_queue_priority ON public.nina_processing_queue(priority DESC);

-- 4.4 SEND_QUEUE
CREATE TABLE public.send_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    from_type TEXT NOT NULL DEFAULT 'nina',
    content TEXT,
    media_url TEXT,
    metadata JSONB DEFAULT '{}',
    status queue_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 1,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_send_queue_status ON public.send_queue(status);
CREATE INDEX idx_send_queue_contact_id ON public.send_queue(contact_id);
CREATE INDEX idx_send_queue_conversation_id ON public.send_queue(conversation_id);
CREATE INDEX idx_send_queue_scheduled_at ON public.send_queue(scheduled_at);
CREATE INDEX idx_send_queue_priority ON public.send_queue(priority DESC);

-- PARTE 5: TABELAS DE CONFIGURAÇÃO

-- 5.1 NINA_SETTINGS
CREATE TABLE public.nina_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    openai_api_key TEXT,
    openai_model TEXT NOT NULL DEFAULT 'gpt-4.1',
    openai_assistant_id TEXT NOT NULL DEFAULT 'asst_X8XSK8rxKOLieSVQwOcvQTdZ',
    system_prompt_override TEXT,
    test_system_prompt TEXT,
    elevenlabs_api_key TEXT,
    elevenlabs_voice_id TEXT NOT NULL DEFAULT 'alloy',
    elevenlabs_model TEXT DEFAULT 'eleven_turbo_v2_5',
    elevenlabs_stability NUMERIC NOT NULL DEFAULT 0.75,
    elevenlabs_similarity_boost NUMERIC NOT NULL DEFAULT 0.80,
    elevenlabs_style NUMERIC NOT NULL DEFAULT 0.30,
    elevenlabs_speaker_boost BOOLEAN NOT NULL DEFAULT true,
    elevenlabs_speed NUMERIC DEFAULT 1.0,
    whatsapp_access_token TEXT,
    whatsapp_phone_number_id TEXT,
    whatsapp_verify_token TEXT DEFAULT 'orchestra-ai-webhook',
    calcom_api_key TEXT,
    auto_response_enabled BOOLEAN NOT NULL DEFAULT true,
    adaptive_response_enabled BOOLEAN NOT NULL DEFAULT true,
    message_breaking_enabled BOOLEAN NOT NULL DEFAULT true,
    response_delay_min INTEGER NOT NULL DEFAULT 1000,
    response_delay_max INTEGER NOT NULL DEFAULT 3000,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    business_hours_start TIME NOT NULL DEFAULT '09:00:00',
    business_hours_end TIME NOT NULL DEFAULT '18:00:00',
    business_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    async_booking_enabled BOOLEAN DEFAULT false,
    route_all_to_receiver_enabled BOOLEAN NOT NULL DEFAULT false,
    test_phone_numbers JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nina_settings_is_active ON public.nina_settings(is_active);

INSERT INTO public.nina_settings (is_active) VALUES (true);

-- 5.2 TAG_DEFINITIONS
CREATE TABLE public.tag_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    category TEXT NOT NULL DEFAULT 'custom',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tag_definitions_key ON public.tag_definitions(key);
CREATE INDEX idx_tag_definitions_category ON public.tag_definitions(category);

-- PARTE 6: VIEW
CREATE OR REPLACE VIEW public.contacts_with_stats AS
SELECT 
    c.*,
    COALESCE(msg_stats.total_messages, 0) AS total_messages,
    COALESCE(msg_stats.nina_messages, 0) AS nina_messages,
    COALESCE(msg_stats.user_messages, 0) AS user_messages,
    COALESCE(msg_stats.human_messages, 0) AS human_messages
FROM public.contacts c
LEFT JOIN (
    SELECT 
        conv.contact_id,
        COUNT(m.id) AS total_messages,
        COUNT(CASE WHEN m.from_type = 'nina' THEN 1 END) AS nina_messages,
        COUNT(CASE WHEN m.from_type = 'user' THEN 1 END) AS user_messages,
        COUNT(CASE WHEN m.from_type = 'human' THEN 1 END) AS human_messages
    FROM public.conversations conv
    JOIN public.messages m ON m.conversation_id = conv.id
    GROUP BY conv.contact_id
) msg_stats ON msg_stats.contact_id = c.id;

-- PARTE 7: FUNÇÕES

-- 7.1 update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7.2 update_conversation_last_message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations 
    SET last_message_at = NEW.sent_at
    WHERE id = NEW.conversation_id;
    
    UPDATE public.contacts 
    SET last_activity = NEW.sent_at
    WHERE id = (
        SELECT contact_id 
        FROM public.conversations 
        WHERE id = NEW.conversation_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7.3 get_or_create_conversation_state
CREATE OR REPLACE FUNCTION public.get_or_create_conversation_state(p_conversation_id UUID)
RETURNS conversation_states AS $$
DECLARE
    state_record public.conversation_states;
BEGIN
    SELECT * INTO state_record
    FROM public.conversation_states
    WHERE conversation_id = p_conversation_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.conversation_states (conversation_id, current_state)
        VALUES (p_conversation_id, 'idle')
        RETURNING * INTO state_record;
    END IF;
    
    RETURN state_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.4 update_conversation_state
CREATE OR REPLACE FUNCTION public.update_conversation_state(
    p_conversation_id UUID, 
    p_new_state TEXT, 
    p_action TEXT DEFAULT NULL, 
    p_context JSONB DEFAULT NULL
)
RETURNS conversation_states AS $$
DECLARE
    state_record public.conversation_states;
BEGIN
    INSERT INTO public.conversation_states (
        conversation_id, current_state, last_action, last_action_at, scheduling_context
    )
    VALUES (
        p_conversation_id, p_new_state, p_action, now(), COALESCE(p_context, '{}')
    )
    ON CONFLICT (conversation_id) 
    DO UPDATE SET
        current_state = EXCLUDED.current_state,
        last_action = EXCLUDED.last_action,
        last_action_at = EXCLUDED.last_action_at,
        scheduling_context = CASE 
            WHEN EXCLUDED.scheduling_context = '{}' THEN conversation_states.scheduling_context
            ELSE EXCLUDED.scheduling_context
        END,
        updated_at = now()
    RETURNING * INTO state_record;
    
    RETURN state_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.5 update_client_memory
CREATE OR REPLACE FUNCTION public.update_client_memory(p_contact_id UUID, p_new_memory JSONB)
RETURNS VOID AS $$
BEGIN
    UPDATE public.contacts 
    SET client_memory = p_new_memory, updated_at = now()
    WHERE id = p_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7.6 claim_nina_processing_batch
CREATE OR REPLACE FUNCTION public.claim_nina_processing_batch(p_limit INTEGER DEFAULT 50)
RETURNS SETOF nina_processing_queue AS $$
BEGIN
    RETURN QUERY
    WITH cte AS (
        SELECT id
        FROM public.nina_processing_queue
        WHERE status = 'pending'
          AND (scheduled_for IS NULL OR scheduled_for <= now())
        ORDER BY priority DESC, scheduled_for ASC NULLS FIRST, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    UPDATE public.nina_processing_queue n
    SET status = 'processing', updated_at = now()
    WHERE n.id IN (SELECT id FROM cte)
    RETURNING n.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7.7 claim_send_queue_batch
CREATE OR REPLACE FUNCTION public.claim_send_queue_batch(p_limit INTEGER DEFAULT 10)
RETURNS SETOF send_queue AS $$
BEGIN
    RETURN QUERY
    WITH cte AS (
        SELECT id
        FROM public.send_queue
        WHERE status = 'pending'
          AND (scheduled_at IS NULL OR scheduled_at <= now())
        ORDER BY priority DESC, scheduled_at ASC NULLS FIRST, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    UPDATE public.send_queue s
    SET status = 'processing', updated_at = now()
    WHERE s.id IN (SELECT id FROM cte)
    RETURNING s.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7.8 claim_message_processing_batch
CREATE OR REPLACE FUNCTION public.claim_message_processing_batch(p_limit INTEGER DEFAULT 50)
RETURNS SETOF message_processing_queue AS $$
BEGIN
    RETURN QUERY
    WITH cte AS (
        SELECT id
        FROM public.message_processing_queue
        WHERE status = 'pending'
          AND (scheduled_for IS NULL OR scheduled_for <= now())
        ORDER BY priority DESC, scheduled_for ASC NULLS FIRST, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    UPDATE public.message_processing_queue m
    SET status = 'processing', updated_at = now()
    WHERE m.id IN (SELECT id FROM cte)
    RETURNING m.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7.9 cleanup_processed_queues
CREATE OR REPLACE FUNCTION public.cleanup_processed_queues()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.message_processing_queue 
    WHERE status = 'completed' AND processed_at < now() - interval '24 hours';
    
    DELETE FROM public.nina_processing_queue 
    WHERE status = 'completed' AND processed_at < now() - interval '24 hours';
    
    DELETE FROM public.send_queue 
    WHERE status = 'completed' AND sent_at < now() - interval '24 hours';
    
    DELETE FROM public.message_processing_queue 
    WHERE status = 'failed' AND updated_at < now() - interval '7 days';
    
    DELETE FROM public.nina_processing_queue 
    WHERE status = 'failed' AND updated_at < now() - interval '7 days';
    
    DELETE FROM public.send_queue 
    WHERE status = 'failed' AND updated_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;

-- 7.10 cleanup_processed_message_queue
CREATE OR REPLACE FUNCTION public.cleanup_processed_message_queue()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.message_grouping_queue 
    WHERE processed = true AND created_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- PARTE 8: TRIGGERS

-- 8.1 Triggers de updated_at
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversation_states_updated_at
    BEFORE UPDATE ON public.conversation_states
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nina_processing_queue_updated_at
    BEFORE UPDATE ON public.nina_processing_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_processing_queue_updated_at
    BEFORE UPDATE ON public.message_processing_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_send_queue_updated_at
    BEFORE UPDATE ON public.send_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nina_settings_updated_at
    BEFORE UPDATE ON public.nina_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tag_definitions_updated_at
    BEFORE UPDATE ON public.tag_definitions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8.2 Trigger para atualizar last_message_at
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- PARTE 9: RLS

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_grouping_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nina_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nina_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_definitions ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas
CREATE POLICY "Allow all operations on contacts" ON public.contacts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on conversations" ON public.conversations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on messages" ON public.messages
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on conversation_states" ON public.conversation_states
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on message_grouping_queue" ON public.message_grouping_queue
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on message_processing_queue" ON public.message_processing_queue
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on nina_processing_queue" ON public.nina_processing_queue
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on send_queue" ON public.send_queue
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on nina_settings" ON public.nina_settings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on tag_definitions" ON public.tag_definitions
    FOR ALL USING (true) WITH CHECK (true);

-- PARTE 10: REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- ============================================================================
-- START MIGRATION: 20251126124633_6fa1cfa2-0dea-4c4f-b843-55589db88bbb.sql
-- ============================================================================

-- Fix security warnings: Add search_path to functions

-- Fix get_or_create_conversation_state
CREATE OR REPLACE FUNCTION public.get_or_create_conversation_state(p_conversation_id UUID)
RETURNS conversation_states AS $$
DECLARE
    state_record public.conversation_states;
BEGIN
    SELECT * INTO state_record
    FROM public.conversation_states
    WHERE conversation_id = p_conversation_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.conversation_states (conversation_id, current_state)
        VALUES (p_conversation_id, 'idle')
        RETURNING * INTO state_record;
    END IF;
    
    RETURN state_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_conversation_state
CREATE OR REPLACE FUNCTION public.update_conversation_state(
    p_conversation_id UUID, 
    p_new_state TEXT, 
    p_action TEXT DEFAULT NULL, 
    p_context JSONB DEFAULT NULL
)
RETURNS conversation_states AS $$
DECLARE
    state_record public.conversation_states;
BEGIN
    INSERT INTO public.conversation_states (
        conversation_id, current_state, last_action, last_action_at, scheduling_context
    )
    VALUES (
        p_conversation_id, p_new_state, p_action, now(), COALESCE(p_context, '{}')
    )
    ON CONFLICT (conversation_id) 
    DO UPDATE SET
        current_state = EXCLUDED.current_state,
        last_action = EXCLUDED.last_action,
        last_action_at = EXCLUDED.last_action_at,
        scheduling_context = CASE 
            WHEN EXCLUDED.scheduling_context = '{}' THEN conversation_states.scheduling_context
            ELSE EXCLUDED.scheduling_context
        END,
        updated_at = now()
    RETURNING * INTO state_record;
    
    RETURN state_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix cleanup_processed_queues
CREATE OR REPLACE FUNCTION public.cleanup_processed_queues()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.message_processing_queue 
    WHERE status = 'completed' AND processed_at < now() - interval '24 hours';
    
    DELETE FROM public.nina_processing_queue 
    WHERE status = 'completed' AND processed_at < now() - interval '24 hours';
    
    DELETE FROM public.send_queue 
    WHERE status = 'completed' AND sent_at < now() - interval '24 hours';
    
    DELETE FROM public.message_processing_queue 
    WHERE status = 'failed' AND updated_at < now() - interval '7 days';
    
    DELETE FROM public.nina_processing_queue 
    WHERE status = 'failed' AND updated_at < now() - interval '7 days';
    
    DELETE FROM public.send_queue 
    WHERE status = 'failed' AND updated_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix cleanup_processed_message_queue
CREATE OR REPLACE FUNCTION public.cleanup_processed_message_queue()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.message_grouping_queue 
    WHERE processed = true AND created_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop and recreate view without SECURITY DEFINER (standard view)
DROP VIEW IF EXISTS public.contacts_with_stats;

CREATE VIEW public.contacts_with_stats AS
SELECT 
    c.*,
    COALESCE(msg_stats.total_messages, 0) AS total_messages,
    COALESCE(msg_stats.nina_messages, 0) AS nina_messages,
    COALESCE(msg_stats.user_messages, 0) AS user_messages,
    COALESCE(msg_stats.human_messages, 0) AS human_messages
FROM public.contacts c
LEFT JOIN (
    SELECT 
        conv.contact_id,
        COUNT(m.id) AS total_messages,
        COUNT(CASE WHEN m.from_type = 'nina' THEN 1 END) AS nina_messages,
        COUNT(CASE WHEN m.from_type = 'user' THEN 1 END) AS user_messages,
        COUNT(CASE WHEN m.from_type = 'human' THEN 1 END) AS human_messages
    FROM public.conversations conv
    JOIN public.messages m ON m.conversation_id = conv.id
    GROUP BY conv.contact_id
) msg_stats ON msg_stats.contact_id = c.id;

-- ============================================================================
-- START MIGRATION: 20251126203606_4f9040ae-c3a2-4d76-bbdf-d7d1b390af19.sql
-- ============================================================================

-- Habilitar extensão pg_cron para agendamento de tarefas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Conceder permissões para usar pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================================
-- START MIGRATION: 20251128205837_4bc41854-7384-403b-87a0-ecaee302b3bc.sql
-- ============================================================================

-- Criar enum para tipos de agendamento
CREATE TYPE public.appointment_type AS ENUM ('demo', 'meeting', 'support', 'followup');

-- Criar tabela de agendamentos
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  type appointment_type NOT NULL DEFAULT 'meeting',
  attendees TEXT[] DEFAULT '{}',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  meeting_url TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Política permissiva (para ambiente de desenvolvimento)
CREATE POLICY "Allow all operations on appointments" ON public.appointments
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- ============================================================================
-- START MIGRATION: 20251128213045_6ec81081-cffb-4401-83ba-ea0b81203095.sql
-- ============================================================================

-- Create enum for member roles
CREATE TYPE public.member_role AS ENUM ('admin', 'manager', 'agent');

-- Create enum for member status
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'disabled');

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create team_functions table
CREATE TABLE public.team_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role public.member_role NOT NULL DEFAULT 'agent',
  status public.member_status NOT NULL DEFAULT 'invited',
  avatar TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  function_id UUID REFERENCES public.team_functions(id) ON DELETE SET NULL,
  weight INTEGER DEFAULT 1,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (permissive for now)
CREATE POLICY "Allow all operations on teams" ON public.teams
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on team_functions" ON public.team_functions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on team_members" ON public.team_members
  FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_functions_updated_at
  BEFORE UPDATE ON public.team_functions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default teams
INSERT INTO public.teams (name, description, color) VALUES
  ('Vendas', 'Equipe de vendas e prospecção', '#3b82f6'),
  ('Suporte', 'Equipe de atendimento ao cliente', '#10b981'),
  ('Marketing', 'Equipe de marketing e comunicação', '#f59e0b');

-- Insert default functions
INSERT INTO public.team_functions (name, description) VALUES
  ('SDR', 'Sales Development Representative - Prospecção'),
  ('Closer', 'Fechador de vendas'),
  ('CS', 'Customer Success - Sucesso do cliente'),
  ('Suporte Técnico', 'Atendimento técnico especializado'),
  ('Analista de Marketing', 'Análise e estratégias de marketing');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_functions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;

-- ============================================================================
-- START MIGRATION: 20251129002142_a8b488aa-bc29-4c2f-bdc9-10622da86851.sql
-- ============================================================================

-- Add message_id column to send_queue table to reference pre-created messages
ALTER TABLE send_queue ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES messages(id);

-- ============================================================================
-- START MIGRATION: 20251129014357_c0d0a622-7045-4a12-bebf-7685413728b2.sql
-- ============================================================================

-- Add company information columns to nina_settings
ALTER TABLE nina_settings 
ADD COLUMN company_name text DEFAULT NULL,
ADD COLUMN sdr_name text DEFAULT NULL;

-- ============================================================================
-- START MIGRATION: 20251129021521_ac935c44-3ab9-4243-b303-706f522f8e04.sql
-- ============================================================================

-- Create deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT,
  value NUMERIC DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'new',
  priority TEXT DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  due_date DATE,
  owner_id UUID REFERENCES team_members(id),
  notes TEXT,
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para criar deal automaticamente quando contato é criado
CREATE OR REPLACE FUNCTION create_deal_for_new_contact()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO deals (contact_id, title, company, stage, priority)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, NEW.call_name, 'Novo Lead'),
    NULL,
    'new',
    'medium'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar deal quando contato é inserido
CREATE TRIGGER auto_create_deal_on_contact
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION create_deal_for_new_contact();

-- Habilitar RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Política RLS permissiva
CREATE POLICY "Allow all operations on deals" ON deals
  FOR ALL USING (true) WITH CHECK (true);

-- Criar deals para contatos existentes
INSERT INTO deals (contact_id, title, company, stage, priority)
SELECT 
  id,
  COALESCE(name, call_name, 'Lead ' || phone_number),
  NULL,
  'new',
  'medium'
FROM contacts
WHERE NOT EXISTS (
  SELECT 1 FROM deals WHERE deals.contact_id = contacts.id
);

-- ============================================================================
-- START MIGRATION: 20251129023513_b44f6889-8365-4878-a7da-6c2cf553dcdd.sql
-- ============================================================================

-- Create deal_activities table for CRM activity tracking
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.team_members(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT deal_activities_type_check CHECK (type IN ('note', 'call', 'email', 'meeting', 'task'))
);

-- Enable RLS
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all operations on deal_activities"
ON public.deal_activities
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_deal_activities_deal_id ON public.deal_activities(deal_id);
CREATE INDEX idx_deal_activities_created_at ON public.deal_activities(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_deal_activities_updated_at
BEFORE UPDATE ON public.deal_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- START MIGRATION: 20251129024326_bbd11d76-7135-4a8f-8d6f-477b5e2864f3.sql
-- ============================================================================

-- Create pipeline_stages table for dynamic Kanban columns
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'border-slate-500',
  position INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all operations on pipeline_stages"
ON public.pipeline_stages
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_pipeline_stages_position ON public.pipeline_stages(position);
CREATE INDEX idx_pipeline_stages_is_active ON public.pipeline_stages(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default stages (migration from constants)
INSERT INTO public.pipeline_stages (title, color, position, is_system) VALUES
  ('Novos Leads', 'border-slate-500', 0, false),
  ('Qualificação', 'border-cyan-500', 1, false),
  ('Apresentação', 'border-violet-500', 2, false),
  ('Negociação', 'border-orange-500', 3, false),
  ('Fechado / Ganho', 'border-emerald-500', 4, true),
  ('Perdido', 'border-red-500', 5, true);

-- Update deals table to reference pipeline_stages instead of hardcoded stage names
-- Add a new column for the stage_id
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id);

-- Migrate existing stage data to stage_id based on title matching
UPDATE public.deals d
SET stage_id = ps.id
FROM public.pipeline_stages ps
WHERE 
  (d.stage = 'new' AND ps.title = 'Novos Leads') OR
  (d.stage = 'qualified' AND ps.title = 'Qualificação') OR
  (d.stage = 'proposal' AND ps.title = 'Apresentação') OR
  (d.stage = 'negotiation' AND ps.title = 'Negociação') OR
  (d.stage = 'won' AND ps.title = 'Fechado / Ganho') OR
  (d.stage = 'lost' AND ps.title = 'Perdido');

-- For any deals without a stage_id, set them to the first stage
UPDATE public.deals
SET stage_id = (SELECT id FROM public.pipeline_stages ORDER BY position LIMIT 1)
WHERE stage_id IS NULL;

-- Now make stage_id required
ALTER TABLE public.deals ALTER COLUMN stage_id SET NOT NULL;

-- Keep the old stage column for backward compatibility during transition
ALTER TABLE public.deals ALTER COLUMN stage DROP NOT NULL;

-- ============================================================================
-- START MIGRATION: 20251129025809_8338482e-5077-45e1-b9d6-d90ad4e11c18.sql
-- ============================================================================

-- Adiciona coluna ai_model_mode à tabela nina_settings
ALTER TABLE public.nina_settings 
ADD COLUMN ai_model_mode TEXT DEFAULT 'flash' 
CHECK (ai_model_mode IN ('flash', 'pro', 'adaptive'));

-- ============================================================================
-- START MIGRATION: 20251129030146_5f64dd59-809f-464f-bbf7-15d2e59e889b.sql
-- ============================================================================

-- Add 'pro3' option to ai_model_mode constraint
ALTER TABLE public.nina_settings 
DROP CONSTRAINT IF EXISTS nina_settings_ai_model_mode_check;

ALTER TABLE public.nina_settings 
ADD CONSTRAINT nina_settings_ai_model_mode_check 
CHECK (ai_model_mode IN ('flash', 'pro', 'pro3', 'adaptive'));

-- ============================================================================
-- START MIGRATION: 20251129030922_3890d9c1-c8fc-4b4e-babc-7ded1b899848.sql
-- ============================================================================

-- Inserir tags iniciais no sistema
INSERT INTO tag_definitions (key, label, color, category, is_active) VALUES
-- Status do Lead
('hot_lead', '🔥 Lead Quente', '#ef4444', 'status', true),
('warm_lead', '🌡️ Lead Morno', '#f97316', 'status', true),
('cold_lead', '❄️ Lead Frio', '#3b82f6', 'status', true),

-- Interesse
('interested', '✅ Interessado', '#22c55e', 'interest', true),
('not_interested', '❌ Sem Interesse', '#6b7280', 'interest', true),
('comparing', '🔄 Comparando', '#8b5cf6', 'interest', true),

-- Ação Necessária
('needs_followup', '📞 Follow-up', '#eab308', 'action', true),
('scheduled_demo', '📅 Demo Agendada', '#06b6d4', 'action', true),
('waiting_response', '⏳ Aguardando', '#a855f7', 'action', true),

-- Qualificação
('qualified', '⭐ Qualificado', '#10b981', 'qualification', true),
('disqualified', '🚫 Desqualificado', '#ef4444', 'qualification', true),

-- Custom
('vip', '👑 VIP', '#fbbf24', 'custom', true),
('urgent', '🚨 Urgente', '#dc2626', 'custom', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- START MIGRATION: 20251129040330_db879ef9-a549-45e7-b392-964b32625a44.sql
-- ============================================================================

-- Add AI trigger criteria to pipeline stages
ALTER TABLE pipeline_stages 
ADD COLUMN ai_trigger_criteria TEXT DEFAULT NULL;

COMMENT ON COLUMN pipeline_stages.ai_trigger_criteria IS 
  'Descrição textual de quando a IA deve mover um deal para este estágio. Ex: "Lead demonstrou interesse claro e pediu demonstração"';


-- ============================================================================
-- START MIGRATION: 20251129041904_59f577e4-c482-4333-a532-271a80c6f235.sql
-- ============================================================================

-- Add is_ai_managed column to pipeline_stages
ALTER TABLE pipeline_stages 
ADD COLUMN is_ai_managed BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN pipeline_stages.is_ai_managed IS 
  'Se true, a IA pode mover deals automaticamente para este estágio. Se false, apenas movimentação manual.';

-- ============================================================================
-- START MIGRATION: 20251201004445_e22e3b5c-d116-48df-9be4-ae9d77ab5147.sql
-- ============================================================================

-- ============================================
-- SEED DATA PARA TORNAR PROJETO REMIX-READY
-- ============================================

-- Insere nina_settings padrão se não existir
INSERT INTO nina_settings (
  company_name, 
  sdr_name, 
  is_active, 
  auto_response_enabled, 
  ai_model_mode, 
  message_breaking_enabled, 
  adaptive_response_enabled,
  response_delay_min, 
  response_delay_max,
  business_hours_start, 
  business_hours_end, 
  business_days,
  timezone,
  openai_model,
  openai_assistant_id,
  elevenlabs_voice_id,
  elevenlabs_stability,
  elevenlabs_similarity_boost,
  elevenlabs_style,
  elevenlabs_speaker_boost,
  whatsapp_verify_token
)
SELECT 
  'Sua Empresa', 
  'Agente', 
  true, 
  true, 
  'flash', 
  true,
  true,
  1000, 
  3000,
  '09:00', 
  '18:00', 
  ARRAY[1,2,3,4,5],
  'America/Sao_Paulo',
  'gpt-4.1',
  'asst_X8XSK8rxKOLieSVQwOcvQTdZ',
  'alloy',
  0.75,
  0.80,
  0.30,
  true,
  'orchestra-ai-webhook'
WHERE NOT EXISTS (SELECT 1 FROM nina_settings LIMIT 1);

-- Insere pipeline_stages padrão se não existir
INSERT INTO pipeline_stages (title, color, position, is_system, is_ai_managed, is_active)
SELECT * FROM (VALUES
  ('Novo', 'border-slate-500', 0, false, false, true),
  ('Qualificação', 'border-blue-500', 1, false, true, true),
  ('Apresentação', 'border-violet-500', 2, false, true, true),
  ('Negociação', 'border-amber-500', 3, false, true, true),
  ('Ganho', 'border-emerald-500', 4, true, false, true),
  ('Perdido', 'border-red-500', 5, true, false, true)
) AS v(title, color, position, is_system, is_ai_managed, is_active)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages LIMIT 1);

-- Insere tag_definitions padrão se não existir
INSERT INTO tag_definitions (key, label, color, category, is_active)
SELECT * FROM (VALUES
  ('hot_lead', 'Lead Quente', '#ef4444', 'status', true),
  ('cold_lead', 'Lead Frio', '#3b82f6', 'status', true),
  ('warm_lead', 'Lead Morno', '#f59e0b', 'status', true),
  ('qualified', 'Qualificado', '#22c55e', 'qualification', true),
  ('unqualified', 'Não Qualificado', '#6b7280', 'qualification', true),
  ('interested', 'Interessado', '#a855f7', 'interest', true),
  ('follow_up', 'Follow-up', '#06b6d4', 'action', true),
  ('demo_requested', 'Demo Solicitada', '#8b5cf6', 'action', true)
) AS v(key, label, color, category, is_active)
WHERE NOT EXISTS (SELECT 1 FROM tag_definitions LIMIT 1);

-- ============================================================================
-- START MIGRATION: 20251201005400_a8d928c9-9a9f-4a2a-a6f7-7231aab3cdc8.sql
-- ============================================================================

-- Corrigir trigger create_deal_for_new_contact para incluir stage_id
CREATE OR REPLACE FUNCTION public.create_deal_for_new_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_stage_id UUID;
BEGIN
  -- Buscar primeiro estágio do pipeline (ordenado por position)
  SELECT id INTO first_stage_id 
  FROM public.pipeline_stages 
  WHERE is_active = true 
  ORDER BY position 
  LIMIT 1;
  
  -- Se não existir estágio, não criar deal (evita erro NOT NULL)
  IF first_stage_id IS NULL THEN
    RAISE NOTICE 'No pipeline stages found, skipping deal creation for contact %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Criar deal com stage_id válido
  INSERT INTO deals (contact_id, title, company, stage, stage_id, priority)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, NEW.call_name, 'Novo Lead'),
    NULL,
    'new',
    first_stage_id,
    'medium'
  );
  
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- START MIGRATION: 20251203171251_4e429259-acc3-496a-b874-ca71b03fb76e.sql
-- ============================================================================

-- Add audio_response_enabled column to nina_settings
ALTER TABLE nina_settings 
ADD COLUMN IF NOT EXISTS audio_response_enabled BOOLEAN DEFAULT false;

-- Create storage bucket for audio messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-messages', 'audio-messages', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for public read access
CREATE POLICY "Public read access for audio" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'audio-messages');

-- RLS policy for service role insert
CREATE POLICY "Service role insert for audio" ON storage.objects
FOR INSERT TO service_role WITH CHECK (bucket_id = 'audio-messages');

-- ============================================================================
-- START MIGRATION: 20251203172830_2fedc4de-0416-4c03-83b8-c48dad8e0c22.sql
-- ============================================================================

-- Alterar valor padrão da coluna elevenlabs_voice_id de 'alloy' para 'Aria' (9BWtsMINqrJLrRacOk9x)
ALTER TABLE nina_settings 
ALTER COLUMN elevenlabs_voice_id SET DEFAULT '9BWtsMINqrJLrRacOk9x';

-- ============================================================================
-- START MIGRATION: 20251208215915_37905e94-c7b9-4480-8b92-f465336ee83e.sql
-- ============================================================================

-- Atualizar estágios existentes com critérios IA
UPDATE pipeline_stages SET 
  ai_trigger_criteria = 'Estágio inicial - todo novo contato começa aqui automaticamente',
  is_ai_managed = false,
  color = 'border-slate-500'
WHERE id = 'bfef58eb-b06d-4c7e-9415-70fe52232b4a';

-- Atualizar estágio de Negociação para Fechamento
UPDATE pipeline_stages SET 
  title = 'Fechamento',
  ai_trigger_criteria = 'Negociação final - requer intervenção humana para fechar o deal',
  is_ai_managed = false,
  color = 'border-orange-500',
  position = 3
WHERE id = 'c9734797-9d12-4049-a2df-25e78749b568';

-- Atualizar estágios de sistema
UPDATE pipeline_stages SET 
  ai_trigger_criteria = 'Deal fechado com sucesso - cliente confirmou compra',
  is_ai_managed = false,
  color = 'border-green-500',
  position = 100
WHERE id = '08c13b42-d8b6-4460-b83a-a888b686a20b';

UPDATE pipeline_stages SET 
  ai_trigger_criteria = 'Deal perdido - cliente desistiu ou escolheu concorrente',
  is_ai_managed = false,
  color = 'border-red-500',
  position = 101
WHERE id = '6879711b-f783-474a-ae87-f1d6d68433bc';

-- Inserir estágios que faltam
INSERT INTO pipeline_stages (title, color, position, is_active, is_ai_managed, is_system, ai_trigger_criteria) VALUES
  ('Em Qualificação', 'border-cyan-500', 1, true, true, false, 'Mover quando: lead responde mensagens, demonstra interesse inicial, faz perguntas sobre produto/serviço, ou menciona necessidade/problema que podemos resolver'),
  ('Oportunidade', 'border-violet-500', 2, true, true, false, 'Mover quando: lead demonstra intenção de compra, pede preços/propostas/orçamentos, agenda reunião ou demonstração, ou confirma interesse em fechar negócio');

-- ============================================================================
-- START MIGRATION: 20251208220818_ac3e8080-9e03-4bd4-9e22-65904553ee35.sql
-- ============================================================================

-- Habilitar REPLICA IDENTITY FULL para capturar todas as mudanças
ALTER TABLE deals REPLICA IDENTITY FULL;
ALTER TABLE pipeline_stages REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_stages;

-- ============================================================================
-- START MIGRATION: 20251208223921_50b3cb80-f35a-4843-bb16-e1129f2f26d2.sql
-- ============================================================================

-- Add ai_scheduling_enabled setting and metadata column for AI-created appointments

-- 1. Add ai_scheduling_enabled to nina_settings
ALTER TABLE public.nina_settings 
ADD COLUMN IF NOT EXISTS ai_scheduling_enabled BOOLEAN DEFAULT true;

-- 2. Add metadata column to appointments for tracking AI-created appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Add index for filtering AI-created appointments
CREATE INDEX IF NOT EXISTS idx_appointments_metadata_source 
ON public.appointments USING GIN (metadata jsonb_path_ops);

-- ============================================================================
-- START MIGRATION: 20251208234214_91fe2405-5d88-42e4-b9bc-8f4ca4c4dc63.sql
-- ============================================================================

-- Add WhatsApp Business Account ID column
ALTER TABLE public.nina_settings 
ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT;

-- ============================================================================
-- START MIGRATION: 20251209002217_a0a1dbb4-ce92-4370-8438-11de2f28b806.sql
-- ============================================================================

-- Enable REPLICA IDENTITY FULL for Realtime to work properly
-- This ensures complete row data is sent on INSERT/UPDATE events

ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE contacts REPLICA IDENTITY FULL;

-- Ensure tables are in supabase_realtime publication
-- First check if already added, if not add them
DO $$
BEGIN
  -- Add messages to realtime if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- Add conversations to realtime if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversations'
  ) THEN
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  -- Add contacts to realtime if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'contacts'
  ) THEN
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  END IF;
NULL;
END $$;

-- ============================================================================
-- START MIGRATION: 20251209142229_5cc6b8ab-3fc9-4e6e-a668-be4f9d396e08.sql
-- ============================================================================

-- Remover campos legados que não são mais utilizados no sistema
-- Cal.com: agendamento é nativo via Nina, não usa Cal.com
-- OpenAI: sistema usa Lovable AI Gateway, não precisa de API key própria

ALTER TABLE public.nina_settings DROP COLUMN IF EXISTS calcom_api_key;
ALTER TABLE public.nina_settings DROP COLUMN IF EXISTS openai_api_key;
ALTER TABLE public.nina_settings DROP COLUMN IF EXISTS openai_model;
ALTER TABLE public.nina_settings DROP COLUMN IF EXISTS openai_assistant_id;

-- ============================================================================
-- START MIGRATION: 20251209152939_ccac9904-17f4-4c4f-a11e-c42be5cdf5ed.sql
-- ============================================================================

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user_id safely (for RLS policies)
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()
$$;

-- RLS policies for profiles
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS policies for user_roles (only admins can manage roles)
CREATE POLICY "Users can view own roles" 
ON public.user_roles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" 
ON public.user_roles FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Give first user admin role, others get user role
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to main tables for multi-tenant support
ALTER TABLE public.nina_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tag_definitions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.team_functions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for multi-tenant tables
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations on nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Allow all operations on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all operations on conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow all operations on deals" ON public.deals;
DROP POLICY IF EXISTS "Allow all operations on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow all operations on pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Allow all operations on tag_definitions" ON public.tag_definitions;
DROP POLICY IF EXISTS "Allow all operations on teams" ON public.teams;
DROP POLICY IF EXISTS "Allow all operations on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow all operations on team_functions" ON public.team_functions;

-- Create proper RLS policies for each table
CREATE POLICY "Users can manage own nina_settings" ON public.nina_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own deals" ON public.deals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own appointments" ON public.appointments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own pipeline_stages" ON public.pipeline_stages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own tag_definitions" ON public.tag_definitions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own teams" ON public.teams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own team_members" ON public.team_members FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own team_functions" ON public.team_functions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Update timestamp triggers for new tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- START MIGRATION: 20251209154733_bd785d97-38e5-40a1-a227-03cd7780daa5.sql
-- ============================================================================

-- Drop and recreate the contacts_with_stats view without SECURITY DEFINER
-- This ensures the view respects the RLS policies of the querying user
DROP VIEW IF EXISTS public.contacts_with_stats;

CREATE VIEW public.contacts_with_stats
WITH (security_invoker = true) AS
SELECT 
    c.id,
    c.phone_number,
    c.whatsapp_id,
    c.name,
    c.call_name,
    c.email,
    c.profile_picture_url,
    c.is_business,
    c.is_blocked,
    c.blocked_at,
    c.blocked_reason,
    c.tags,
    c.notes,
    c.client_memory,
    c.first_contact_date,
    c.last_activity,
    c.created_at,
    c.updated_at,
    c.user_id,
    COALESCE(msg_stats.total_messages, 0::bigint) AS total_messages,
    COALESCE(msg_stats.nina_messages, 0::bigint) AS nina_messages,
    COALESCE(msg_stats.user_messages, 0::bigint) AS user_messages,
    COALESCE(msg_stats.human_messages, 0::bigint) AS human_messages
FROM contacts c
LEFT JOIN (
    SELECT 
        conv.contact_id,
        count(m.id) AS total_messages,
        count(CASE WHEN m.from_type = 'nina'::message_from THEN 1 ELSE NULL::integer END) AS nina_messages,
        count(CASE WHEN m.from_type = 'user'::message_from THEN 1 ELSE NULL::integer END) AS user_messages,
        count(CASE WHEN m.from_type = 'human'::message_from THEN 1 ELSE NULL::integer END) AS human_messages
    FROM conversations conv
    JOIN messages m ON m.conversation_id = conv.id
    GROUP BY conv.contact_id
) msg_stats ON msg_stats.contact_id = c.id;

-- Add comment for documentation
COMMENT ON VIEW public.contacts_with_stats IS 'View that aggregates contact information with message statistics. Uses security_invoker=true to respect RLS policies.';

-- ============================================================================
-- START MIGRATION: 20251209155004_8a057b28-bfe6-49b7-8850-f2be52fd289d.sql
-- ============================================================================

-- Fix the unique constraint on tag_definitions to be per-user
-- Drop the old constraint that only checks 'key'
ALTER TABLE public.tag_definitions DROP CONSTRAINT IF EXISTS tag_definitions_key_key;

-- Add a new constraint that checks (user_id, key) for multi-tenant support
ALTER TABLE public.tag_definitions ADD CONSTRAINT tag_definitions_user_key_unique UNIQUE (user_id, key);

-- ============================================================================
-- START MIGRATION: 20251209155048_fe66b013-1423-400d-b79d-40157cfbe699.sql
-- ============================================================================

-- Fix the unique constraint on teams to be per-user
-- Drop the old constraint that only checks 'name'
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_name_key;

-- Add a new constraint that checks (user_id, name) for multi-tenant support
ALTER TABLE public.teams ADD CONSTRAINT teams_user_name_unique UNIQUE (user_id, name);

-- ============================================================================
-- START MIGRATION: 20251209155224_b9a506a5-ce91-4f87-9c28-4c72c4f5c66d.sql
-- ============================================================================

-- Fix the unique constraint on team_functions to be per-user
-- Drop the old constraint that only checks 'name'
ALTER TABLE public.team_functions DROP CONSTRAINT IF EXISTS team_functions_name_key;

-- Add a new constraint that checks (user_id, name) for multi-tenant support
ALTER TABLE public.team_functions ADD CONSTRAINT team_functions_user_name_unique UNIQUE (user_id, name);

-- ============================================================================
-- START MIGRATION: 20251209171003_1da7ae00-d1aa-4575-b73c-a2b58bc25b5e.sql
-- ============================================================================

-- 1. Fix messages RLS - users can only access messages from their conversations
DROP POLICY IF EXISTS "Allow all operations on messages" ON public.messages;
CREATE POLICY "Users can access messages of their conversations"
ON public.messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = messages.conversation_id 
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = messages.conversation_id 
    AND user_id = auth.uid()
  )
);

-- 2. Fix conversation_states RLS - users can only access states from their conversations
DROP POLICY IF EXISTS "Allow all operations on conversation_states" ON public.conversation_states;
CREATE POLICY "Users can access states of their conversations"
ON public.conversation_states FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_states.conversation_id 
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_states.conversation_id 
    AND user_id = auth.uid()
  )
);

-- 3. Fix deal_activities RLS - users can only access activities from their deals
DROP POLICY IF EXISTS "Allow all operations on deal_activities" ON public.deal_activities;
CREATE POLICY "Users can access activities of their deals"
ON public.deal_activities FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.deals 
    WHERE id = deal_activities.deal_id 
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deals 
    WHERE id = deal_activities.deal_id 
    AND user_id = auth.uid()
  )
);

-- ============================================================================
-- START MIGRATION: 20251209182300_48fd5234-03ae-4826-9c71-c4df6d21af90.sql
-- ============================================================================

-- Corrigir função para criar deals com user_id do contato
CREATE OR REPLACE FUNCTION public.create_deal_for_new_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_stage_id UUID;
BEGIN
  -- Buscar primeiro estágio do pipeline DO MESMO USER_ID DO CONTATO
  SELECT id INTO first_stage_id 
  FROM public.pipeline_stages 
  WHERE is_active = true 
    AND (user_id = NEW.user_id OR user_id IS NULL)
  ORDER BY position 
  LIMIT 1;
  
  IF first_stage_id IS NULL THEN
    RAISE NOTICE 'No pipeline stages found, skipping deal creation for contact %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Criar deal COM O MESMO USER_ID DO CONTATO
  INSERT INTO deals (contact_id, title, company, stage, stage_id, priority, user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, NEW.call_name, 'Novo Lead'),
    NULL,
    'new',
    first_stage_id,
    'medium',
    NEW.user_id
  );
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger (drop first para garantir)
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON contacts;
CREATE TRIGGER auto_create_deal_on_contact
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION create_deal_for_new_contact();

-- Atualizar o voice ID padrão no banco
ALTER TABLE nina_settings ALTER COLUMN elevenlabs_voice_id SET DEFAULT '33B4UnXyTNbgLmdEDh5P';

-- ============================================================================
-- START MIGRATION: 20251209183158_07ba65f2-3b7e-40f6-a881-6bb85ca96d7a.sql
-- ============================================================================

-- Associar dados órfãos ao primeiro admin - versão corrigida
DO $$
DECLARE
  admin_user_id UUID;
  old_stage_id UUID;
  new_stage_id UUID;
BEGIN
  -- Buscar o primeiro usuário admin
  SELECT user_id INTO admin_user_id 
  FROM public.user_roles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- 1. Atualizar tabelas básicas
    UPDATE public.nina_settings SET user_id = admin_user_id WHERE user_id IS NULL;
    UPDATE public.contacts SET user_id = admin_user_id WHERE user_id IS NULL;
    UPDATE public.conversations SET user_id = admin_user_id WHERE user_id IS NULL;
    UPDATE public.appointments SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- 2. Para pipeline_stages órfãos com deals referenciando:
    -- Primeiro, migrar os deals para stages equivalentes do admin
    FOR old_stage_id, new_stage_id IN
      SELECT 
        orphan.id as old_id,
        admin_stage.id as new_id
      FROM public.pipeline_stages orphan
      JOIN public.pipeline_stages admin_stage 
        ON orphan.position = admin_stage.position 
        AND admin_stage.user_id = admin_user_id
      WHERE orphan.user_id IS NULL
    LOOP
      UPDATE public.deals SET stage_id = new_stage_id WHERE stage_id = old_stage_id;
    END LOOP;
    
    -- Agora podemos deletar os pipeline_stages órfãos duplicados
    DELETE FROM public.pipeline_stages 
    WHERE user_id IS NULL 
    AND position IN (SELECT position FROM public.pipeline_stages WHERE user_id = admin_user_id);
    
    -- Atualizar os restantes (se houver)
    UPDATE public.pipeline_stages SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- 3. Atualizar deals órfãos
    UPDATE public.deals SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- 4. Para tag_definitions: deletar órfãos que conflitam
    DELETE FROM public.tag_definitions 
    WHERE user_id IS NULL 
    AND key IN (SELECT key FROM public.tag_definitions WHERE user_id = admin_user_id);
    UPDATE public.tag_definitions SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- 5. Para teams: deletar órfãos que conflitam pelo nome
    DELETE FROM public.teams 
    WHERE user_id IS NULL 
    AND name IN (SELECT name FROM public.teams WHERE user_id = admin_user_id);
    UPDATE public.teams SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- 6. Para team_functions: deletar órfãos que conflitam pelo nome
    DELETE FROM public.team_functions 
    WHERE user_id IS NULL 
    AND name IN (SELECT name FROM public.team_functions WHERE user_id = admin_user_id);
    UPDATE public.team_functions SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- 7. Atualizar team_members
    UPDATE public.team_members SET user_id = admin_user_id WHERE user_id IS NULL;
    
    RAISE NOTICE 'Dados órfãos associados ao admin: %', admin_user_id;
  ELSE
    RAISE NOTICE 'Nenhum admin encontrado no sistema';
  END IF;
NULL;
END $$;

-- ============================================================================
-- START MIGRATION: 20251209185919_4376c6a0-b48a-4e37-bff1-5bf092df6ba3.sql
-- ============================================================================

-- Primeiro, remover duplicatas mantendo apenas o registro mais recente por user_id
DELETE FROM nina_settings a
USING nina_settings b
WHERE a.user_id = b.user_id 
  AND a.user_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Adicionar constraint UNIQUE na coluna user_id
ALTER TABLE nina_settings 
ADD CONSTRAINT nina_settings_user_id_unique UNIQUE (user_id);

-- ============================================================================
-- START MIGRATION: 20251209210741_bc989b3f-1014-4a1a-a0e1-64d6bf75f664.sql
-- ============================================================================

-- Add process_after column for timer-based message grouping
ALTER TABLE public.message_grouping_queue 
ADD COLUMN IF NOT EXISTS process_after TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '20 seconds');

-- Add index for efficient querying of ready-to-process messages
CREATE INDEX IF NOT EXISTS idx_message_grouping_ready 
ON public.message_grouping_queue (process_after, processed) 
WHERE processed = false;

-- ============================================================================
-- START MIGRATION: 20251209214111_81d783f3-b18c-4267-867e-c7fa05872358.sql
-- ============================================================================

-- Add message_id column to message_grouping_queue to reference the already-created message
ALTER TABLE public.message_grouping_queue ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES public.messages(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_grouping_queue_message_id ON public.message_grouping_queue(message_id);

-- ============================================================================
-- START MIGRATION: 20251209215547_d705c1aa-a1ef-4636-84a6-0951ebaa66f8.sql
-- ============================================================================

-- Drop existing restrictive policies on messages
DROP POLICY IF EXISTS "Users can access messages of their conversations" ON messages;

-- Create permissive policy for messages - all authenticated users can access
CREATE POLICY "Authenticated users can access all messages"
ON messages FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Drop existing restrictive policies on conversations
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;

-- Create permissive policy for conversations - all authenticated users can access
CREATE POLICY "Authenticated users can access all conversations"
ON conversations FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Also update contacts for consistency
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;

CREATE POLICY "Authenticated users can access all contacts"
ON contacts FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- START MIGRATION: 20251209220339_567ce0b1-b703-4773-9ac6-562d2140ed73.sql
-- ============================================================================

-- Add unique partial index on whatsapp_message_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS messages_whatsapp_message_id_unique 
ON messages (whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;

-- Clean up stuck messages in message_grouping_queue
UPDATE message_grouping_queue 
SET processed = true 
WHERE processed = false AND process_after < NOW();

-- Clean up completed items older than 1 hour
DELETE FROM message_grouping_queue 
WHERE processed = true AND created_at < NOW() - INTERVAL '1 hour';

-- Clean up failed queue items older than 24 hours
DELETE FROM nina_processing_queue 
WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '24 hours';

DELETE FROM send_queue 
WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '24 hours';

-- ============================================================================
-- START MIGRATION: 20251210002232_6708f2fc-f6f9-47d6-a791-068900282db5.sql
-- ============================================================================

-- Limpar dados órfãos (sem user_id) criados por migrações antigas
-- Isso evita duplicação de pipeline_stages após remix

DELETE FROM pipeline_stages WHERE user_id IS NULL;
DELETE FROM tag_definitions WHERE user_id IS NULL;
DELETE FROM nina_settings WHERE user_id IS NULL;
DELETE FROM teams WHERE user_id IS NULL;
DELETE FROM team_functions WHERE user_id IS NULL;

-- ============================================================================
-- START MIGRATION: 20251210145352_371f49b4-55a3-4131-a122-349d4d13a43f.sql
-- ============================================================================

-- =============================================
-- MIGRAÇÃO: Sistema Single-Tenant (V2)
-- Primeiro usuário = Admin + Onboarding
-- Demais usuários = apenas membros da equipe
-- =============================================

-- 1. Apenas atualizar user_id para NULL (sem deletar duplicados)
-- Isso torna os registros globais sem quebrar foreign keys

-- nina_settings: manter apenas 1 (o com mais dados) e tornar global
DO $$
DECLARE
  keep_id UUID;
BEGIN
  -- Selecionar o ID do registro com mais dados preenchidos
  SELECT id INTO keep_id
  FROM public.nina_settings
  ORDER BY 
    CASE WHEN company_name IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN whatsapp_access_token IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN system_prompt_override IS NOT NULL THEN 0 ELSE 1 END,
    updated_at DESC
  LIMIT 1;
  
  -- Deletar todos exceto o selecionado
  IF keep_id IS NOT NULL THEN
    DELETE FROM public.nina_settings WHERE id != keep_id;
  END IF;
NULL;
END $$;

-- Tornar nina_settings global
UPDATE public.nina_settings SET user_id = NULL;

-- pipeline_stages: NÃO deletar (foreign keys), apenas tornar globais
UPDATE public.pipeline_stages SET user_id = NULL;

-- tag_definitions: deletar duplicados por key, manter o mais recente
DELETE FROM public.tag_definitions a
USING public.tag_definitions b
WHERE a.id > b.id 
  AND a.key = b.key;

-- Tornar globais
UPDATE public.tag_definitions SET user_id = NULL;

-- teams: deletar duplicados por name, manter o mais recente
DELETE FROM public.teams a
USING public.teams b
WHERE a.id > b.id 
  AND a.name = b.name;

-- Tornar globais
UPDATE public.teams SET user_id = NULL;

-- team_functions: deletar duplicados por name, manter o mais recente
DELETE FROM public.team_functions a
USING public.team_functions b
WHERE a.id > b.id 
  AND a.name = b.name;

-- Tornar globais
UPDATE public.team_functions SET user_id = NULL;

-- =============================================
-- 2. Atualizar RLS policies
-- Leitura: todos autenticados
-- Escrita: apenas admins
-- =============================================

-- nina_settings
DROP POLICY IF EXISTS "Users can manage own nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Authenticated can read nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Admins can modify nina_settings" ON public.nina_settings;

CREATE POLICY "Authenticated can read nina_settings" 
ON public.nina_settings 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can modify nina_settings" 
ON public.nina_settings 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- pipeline_stages
DROP POLICY IF EXISTS "Users can manage own pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Authenticated can read pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Admins can modify pipeline_stages" ON public.pipeline_stages;

CREATE POLICY "Authenticated can read pipeline_stages" 
ON public.pipeline_stages 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can modify pipeline_stages" 
ON public.pipeline_stages 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- tag_definitions
DROP POLICY IF EXISTS "Users can manage own tag_definitions" ON public.tag_definitions;
DROP POLICY IF EXISTS "Authenticated can read tag_definitions" ON public.tag_definitions;
DROP POLICY IF EXISTS "Admins can modify tag_definitions" ON public.tag_definitions;

CREATE POLICY "Authenticated can read tag_definitions" 
ON public.tag_definitions 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can modify tag_definitions" 
ON public.tag_definitions 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- teams
DROP POLICY IF EXISTS "Users can manage own teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated can read teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can modify teams" ON public.teams;

CREATE POLICY "Authenticated can read teams" 
ON public.teams 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can modify teams" 
ON public.teams 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- team_functions
DROP POLICY IF EXISTS "Users can manage own team_functions" ON public.team_functions;
DROP POLICY IF EXISTS "Authenticated can read team_functions" ON public.team_functions;
DROP POLICY IF EXISTS "Admins can modify team_functions" ON public.team_functions;

CREATE POLICY "Authenticated can read team_functions" 
ON public.team_functions 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can modify team_functions" 
ON public.team_functions 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- team_members
DROP POLICY IF EXISTS "Users can manage own team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can read team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can modify team_members" ON public.team_members;

CREATE POLICY "Authenticated can read team_members" 
ON public.team_members 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can modify team_members" 
ON public.team_members 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- START MIGRATION: 20251210150959_948c6401-b2f8-4b9f-8935-b142eb85e9f8.sql
-- ============================================================================

-- Configurar realtime de forma idempotente para funcionar em remixes
-- Usa DO block com EXCEPTION para ignorar erros se tabela já estiver na publicação

DO $$
BEGIN
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.team_functions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN 
-- [DUPLICATE REMOVED]     ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
NULL;
END $$;

-- ============================================================================
-- START MIGRATION: 20260126171543_cb2bf0e1-c595-4961-801f-f78803e53955.sql
-- ============================================================================

-- 1. Adicionar tabelas à publicação supabase_realtime
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.team_functions;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
-- [DUPLICATE REMOVED] ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- ============================================================================
-- START MIGRATION: 20260126171556_15033663-1037-4b8a-9259-f11a2c8db7ab.sql
-- ============================================================================

-- 2. Recriar triggers do banco de dados

-- Trigger: auto_create_deal_on_contact
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
CREATE TRIGGER auto_create_deal_on_contact
    AFTER INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.create_deal_for_new_contact();

-- Trigger: update_conversation_last_message
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_last_message();

-- Triggers updated_at para tabelas relevantes
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_states_updated_at ON public.conversation_states;
CREATE TRIGGER update_conversation_states_updated_at
    BEFORE UPDATE ON public.conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_nina_processing_queue_updated_at ON public.nina_processing_queue;
CREATE TRIGGER update_nina_processing_queue_updated_at
    BEFORE UPDATE ON public.nina_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_processing_queue_updated_at ON public.message_processing_queue;
CREATE TRIGGER update_message_processing_queue_updated_at
    BEFORE UPDATE ON public.message_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_send_queue_updated_at ON public.send_queue;
CREATE TRIGGER update_send_queue_updated_at
    BEFORE UPDATE ON public.send_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_nina_settings_updated_at ON public.nina_settings;
CREATE TRIGGER update_nina_settings_updated_at
    BEFORE UPDATE ON public.nina_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tag_definitions_updated_at ON public.tag_definitions;
CREATE TRIGGER update_tag_definitions_updated_at
    BEFORE UPDATE ON public.tag_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- START MIGRATION: 20260126171604_e1f0d176-c018-4e4e-b087-0c55444ea5aa.sql
-- ============================================================================

-- 3. Atualizar políticas RLS para modelo single-tenant

-- DEALS: Substituir política user_id por acesso compartilhado
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;

CREATE POLICY "Authenticated users can access all deals" 
ON public.deals 
FOR ALL 
TO authenticated 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- APPOINTMENTS: Substituir política user_id por acesso compartilhado
DROP POLICY IF EXISTS "Users can manage own appointments" ON public.appointments;

CREATE POLICY "Authenticated users can access all appointments" 
ON public.appointments 
FOR ALL 
TO authenticated 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- START MIGRATION: 20260301152953_c326e3d7-e641-4a9b-9c9c-2d3d030cb469.sql
-- ============================================================================


-- ============================================
-- 1. REALTIME: Add tables to supabase_realtime
-- ============================================
DO $$
BEGIN
  -- Safely add each table (ignore if already added)
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deals; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teams; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.team_functions; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
-- [DUPLICATE REMOVED]   BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments; EXCEPTION WHEN duplicate_object THEN NULL; END;
NULL;
END $$;

-- ============================================
-- 2. TRIGGERS: Recreate all required triggers
-- ============================================

-- auto_create_deal_on_contact
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
CREATE TRIGGER auto_create_deal_on_contact
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_for_new_contact();

-- update_conversation_last_message_trigger
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- updated_at triggers
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_states_updated_at ON public.conversation_states;
CREATE TRIGGER update_conversation_states_updated_at
  BEFORE UPDATE ON public.conversation_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_nina_processing_queue_updated_at ON public.nina_processing_queue;
CREATE TRIGGER update_nina_processing_queue_updated_at
  BEFORE UPDATE ON public.nina_processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_processing_queue_updated_at ON public.message_processing_queue;
CREATE TRIGGER update_message_processing_queue_updated_at
  BEFORE UPDATE ON public.message_processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_send_queue_updated_at ON public.send_queue;
CREATE TRIGGER update_send_queue_updated_at
  BEFORE UPDATE ON public.send_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_nina_settings_updated_at ON public.nina_settings;
CREATE TRIGGER update_nina_settings_updated_at
  BEFORE UPDATE ON public.nina_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tag_definitions_updated_at ON public.tag_definitions;
CREATE TRIGGER update_tag_definitions_updated_at
  BEFORE UPDATE ON public.tag_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- START MIGRATION: 20260504_feimi_tables.sql
-- ============================================================================

-- Contacts extensions
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status_convite VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID REFERENCES pipeline_stages(id);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- waba, email, both
    segment_filter VARCHAR(255),
    template_id VARCHAR(255),
    email_subject VARCHAR(255),
    email_body TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Messages
CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id),
    contact_id UUID REFERENCES contacts(id),
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Waba Templates
CREATE TABLE IF NOT EXISTS waba_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL,
    category VARCHAR(50),
    status VARCHAR(50),
    components JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journeys
CREATE TABLE IF NOT EXISTS journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trigger VARCHAR(100),
    steps JSONB
);

-- Journey Enrollments
CREATE TABLE IF NOT EXISTS journey_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id),
    journey_id UUID REFERENCES journeys(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_step INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active'
);


