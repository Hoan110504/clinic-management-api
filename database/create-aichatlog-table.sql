-- Create AiChatLog table for AI chatbot audit trail
-- This is a manual SQL script to create the table if migration fails

-- Drop table if exists (for clean recreation)
IF OBJECT_ID('AiChatLog', 'U') IS NOT NULL
    DROP TABLE AiChatLog;
GO

-- Create table
CREATE TABLE AiChatLog (
    id INTEGER IDENTITY(1,1) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_role INTEGER NOT NULL,
    user_message NVARCHAR(500) NOT NULL,
    ai_response NVARCHAR(MAX) NOT NULL,
    selected_query_ids NVARCHAR(MAX) NULL,
    timestamp DATETIMEOFFSET NOT NULL DEFAULT GETDATE(),
    ip_address NVARCHAR(45) NULL,
    session_id NVARCHAR(100) NULL,
    response_time_ms INTEGER NULL,
    error_message NVARCHAR(MAX) NULL,
    is_blocked BIT NOT NULL DEFAULT 0,
    is_rate_limited BIT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Add column descriptions
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'User role: 1=admin, 2=doctor, 3=receptionist, 4=pharmacist, 5=patient, 6=labtech', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'user_role';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'User input message to AI chatbot', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'user_message';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'AI generated response', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'ai_response';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'JSON array of query IDs selected by AI in Pass 1', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'selected_query_ids';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Timestamp of interaction', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'timestamp';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Client IP address (supports IPv4 and IPv6)', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'ip_address';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'User session identifier', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'session_id';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'AI response time in milliseconds', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'response_time_ms';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Error message if request failed', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'error_message';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Flag for blocked requests (e.g., prompt injection detected)', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'is_blocked';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Flag for rate-limited requests', 
    @level0type = N'Schema', @level0name = 'dbo', 
    @level1type = N'Table', @level1name = 'AiChatLog', 
    @level2type = N'Column', @level2name = 'is_rate_limited';
GO

-- Create indexes
CREATE INDEX idx_aichatlog_user ON AiChatLog(user_id);
GO

CREATE INDEX idx_aichatlog_timestamp ON AiChatLog(timestamp);
GO

-- Create filtered index for security monitoring
CREATE INDEX idx_aichatlog_blocked ON AiChatLog(is_blocked) WHERE is_blocked = 1;
GO

PRINT 'AiChatLog table created successfully';
