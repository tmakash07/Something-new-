-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channels & Groups managed by the bot
CREATE TABLE IF NOT EXISTS channels (
    channel_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    post_interval_seconds INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    header_branding TEXT DEFAULT '🧠 Daily Admission Quiz',
    footer_branding TEXT DEFAULT '— Admission Quiz Bot',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master Question Bank (stores all extracted/generated questions for duplicate checking)
CREATE TABLE IF NOT EXISTS quiz_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_hash TEXT UNIQUE NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option_index INTEGER NOT NULL,
    explanation TEXT,
    topic TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
    language TEXT CHECK (language IN ('bangla', 'english', 'mixed')),
    source_reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active Scheduled Queue for Auto-Posting
CREATE TABLE IF NOT EXISTS quiz_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    scheduled_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES quiz_bank(id) ON DELETE CASCADE
);

-- Admin Session Settings (temporary state for inline configuration menus)
CREATE TABLE IF NOT EXISTS admin_settings (
    admin_id INTEGER PRIMARY KEY,
    target_channel_id TEXT,
    difficulty TEXT DEFAULT 'medium',
    language TEXT DEFAULT 'bangla',
    question_count INTEGER DEFAULT 10,
    explanation_enabled INTEGER DEFAULT 1,
    custom_prompt TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lookup indexes for fast queue retrieval and duplicate checking
CREATE INDEX IF NOT EXISTS idx_quiz_queue_status_time ON quiz_queue(channel_id, status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_quiz_bank_hash ON quiz_bank(question_hash);
  
