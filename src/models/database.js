const Database = require('better-sqlite3');
const path = require('path');

class ChatDatabase {
  constructor(dbPath = './data/chat.db') {
    this.db = new Database(path.resolve(dbPath));
    this.init();
  }

  init() {
    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        reply_to TEXT,
        behavior_type TEXT,
        tool_calls TEXT,
        emotion_state TEXT
      )
    `);

    // Agent states table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_states (
        agent_id TEXT PRIMARY KEY,
        emotion_valence REAL DEFAULT 0.5,
        emotion_arousal REAL DEFAULT 0.5,
        emotion_dominance REAL DEFAULT 0.5,
        last_active INTEGER,
        message_count INTEGER DEFAULT 0,
        relationships TEXT
      )
    `);

    // Memory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        accessed_at INTEGER
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
    `);
  }

  // Message operations
  saveMessage(message) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages 
      (id, sender_id, sender_type, content, timestamp, reply_to, behavior_type, tool_calls, emotion_state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      message.id,
      message.senderId,
      message.senderType,
      message.content,
      message.timestamp,
      message.replyTo || null,
      message.behaviorType || null,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.emotionState ? JSON.stringify(message.emotionState) : null
    );
  }

  getRecentMessages(limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit).reverse();
  }

  getMessagesSince(timestamp, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE timestamp > ?
      ORDER BY timestamp ASC 
      LIMIT ?
    `);
    return stmt.all(timestamp, limit);
  }

  // Agent state operations
  saveAgentState(agentId, state) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_states 
      (agent_id, emotion_valence, emotion_arousal, emotion_dominance, last_active, message_count, relationships)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      agentId,
      state.emotionValence,
      state.emotionArousal,
      state.emotionDominance,
      state.lastActive,
      state.messageCount,
      JSON.stringify(state.relationships)
    );
  }

  getAgentState(agentId) {
    const stmt = this.db.prepare('SELECT * FROM agent_states WHERE agent_id = ?');
    const row = stmt.get(agentId);
    if (!row) return null;
    
    return {
      ...row,
      relationships: JSON.parse(row.relationships)
    };
  }

  getAllAgentStates() {
    const stmt = this.db.prepare('SELECT * FROM agent_states');
    return stmt.all();
  }

  // Memory operations
  saveMemory(memory) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories 
      (id, agent_id, content, importance, created_at, accessed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      memory.id,
      memory.agentId,
      memory.content,
      memory.importance,
      memory.createdAt,
      memory.accessedAt || memory.createdAt
    );
  }

  getMemories(agentId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM memories 
      WHERE agent_id = ?
      ORDER BY accessed_at DESC 
      LIMIT ?
    `);
    return stmt.all(agentId, limit);
  }

  updateMemoryAccess(memoryId) {
    const stmt = this.db.prepare(`
      UPDATE memories SET accessed_at = ? WHERE id = ?
    `);
    stmt.run(Date.now(), memoryId);
  }

  // Utility
  close() {
    this.db.close();
  }
}

module.exports = ChatDatabase;
