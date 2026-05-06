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
