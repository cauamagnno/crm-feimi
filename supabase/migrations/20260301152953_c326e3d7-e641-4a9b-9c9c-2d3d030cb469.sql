
-- ============================================
-- 1. REALTIME: Add tables to supabase_realtime
-- ============================================
DO $$
BEGIN
  -- Safely add each table (ignore if already added)
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teams; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.team_functions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments; EXCEPTION WHEN duplicate_object THEN NULL; END;
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
