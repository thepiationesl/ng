const Database = require('better-sqlite3');
const path = require('path');

class DatabaseService {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  initializeTables() {
    // 国家表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS countries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        population INTEGER,
        gdp REAL,
        government_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 角色表（动态生成）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT,
        department TEXT,
        personality TEXT,
        technical_knowledge TEXT,
        email TEXT,
        phone TEXT,
        metadata TEXT,
        triggered_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 设备表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        status TEXT DEFAULT 'broken',
        failure_rate REAL DEFAULT 0.8,
        last_failure DATETIME,
        repair_count INTEGER DEFAULT 0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 邮件表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        is_read INTEGER DEFAULT 0,
        is_player_sent INTEGER DEFAULT 0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 讨论记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS discussions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country_id INTEGER,
        participants TEXT,
        topic TEXT,
        content TEXT,
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (country_id) REFERENCES countries(id)
      )
    `);

    // 随机事件表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country_id INTEGER,
        type TEXT,
        title TEXT,
        description TEXT,
        impact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (country_id) REFERENCES countries(id)
      )
    `);

    // API 配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key TEXT,
        base_url TEXT,
        model TEXT,
        style_weight REAL DEFAULT 0.5,
        random_seed TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 会话状态表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        current_country_id INTEGER,
        setup_completed INTEGER DEFAULT 0,
        first_email_sent INTEGER DEFAULT 0,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (current_country_id) REFERENCES countries(id)
      )
    `);

    this.db.pragma('journal_mode = WAL');
  }

  // 通用 CRUD 方法
  insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const stmt = this.db.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
    );
    
    return stmt.run(...values);
  }

  select(table, conditions = {}, limit = null) {
    let query = `SELECT * FROM ${table}`;
    const params = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      params.push(...Object.values(conditions));
    }
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  selectOne(table, conditions = {}) {
    const results = this.select(table, conditions, 1);
    return results.length > 0 ? results[0] : null;
  }

  update(table, data, conditions = {}) {
    const keys = Object.keys(data);
    const values = [...Object.values(data)];
    
    let query = `UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')}`;
    
    if (Object.keys(conditions).length > 0) {
      const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      values.push(...Object.values(conditions));
    }
    
    const stmt = this.db.prepare(query);
    return stmt.run(...values);
  }

  delete(table, conditions = {}) {
    let query = `DELETE FROM ${table}`;
    const params = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      params.push(...Object.values(conditions));
    }
    
    const stmt = this.db.prepare(query);
    return stmt.run(...params);
  }

  // 特殊查询方法
  getAllCharacters() {
    return this.select('characters');
  }

  getCharacterByDepartment(department) {
    return this.selectOne('characters', { department });
  }

  getAllDevices() {
    return this.select('devices');
  }

  getEmails(recipient = null, limit = 20) {
    const conditions = recipient ? { recipient } : {};
    return this.select('emails', conditions, limit);
  }

  getDiscussions(countryId = null, limit = 10) {
    const conditions = countryId ? { country_id: countryId } : {};
    return this.select('discussions', conditions, limit);
  }

  getEvents(countryId = null, limit = 10) {
    const conditions = countryId ? { country_id: countryId } : {};
    return this.select('events', conditions, limit);
  }

  getApiConfig() {
    return this.selectOne('api_config', { id: 1 });
  }

  getSessionState() {
    return this.selectOne('session_state', { id: 1 });
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseService;
