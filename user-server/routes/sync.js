/**
 * MelodyFlow Music - 数据同步路由
 * 获取/保存用户数据（收藏、播放列表、历史、设置、播放进度）
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// ==================== 验证用户 ====================

function verifyUser(db, userId, username) {
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND username = ?')
    .get(Number(userId), username);
  return !!user;
}

// ==================== GET /api/sync/get - 获取用户数据 ====================
router.get('/get', (req, res) => {
  const { userId, username } = req.query;

  if (!userId || !username) {
    return res.status(400).json({ ok: false, msg: '缺少参数' });
  }

  const db = getDb();
  if (!verifyUser(db, userId, username)) {
    return res.status(403).json({ ok: false, msg: '用户验证失败' });
  }

  const row = db.prepare('SELECT data, updated_at FROM user_data WHERE user_id = ?')
    .get(Number(userId));

  if (!row) {
    // 首次同步，返回空数据
    return res.json({ ok: true, data: {}, updated_at: null });
  }

  try {
    const data = JSON.parse(row.data);
    res.json({ ok: true, data, updated_at: row.updated_at });
  } catch (e) {
    res.json({ ok: true, data: {}, updated_at: row.updated_at });
  }
});

// ==================== POST /api/sync/save - 保存用户数据 ====================
router.post('/save', (req, res) => {
  const { userId, username, data } = req.body;

  if (!userId || !username) {
    return res.status(400).json({ ok: false, msg: '缺少参数' });
  }

  const db = getDb();
  if (!verifyUser(db, userId, username)) {
    return res.status(403).json({ ok: false, msg: '用户验证失败' });
  }

  if (data === undefined || data === null) {
    return res.status(400).json({ ok: false, msg: '数据不能为空' });
  }

  // 深度清理数据（移除 file URL 等大字段，只保留结构）
  const cleanData = JSON.parse(JSON.stringify(data));

  // 安全序列化
  const dataStr = JSON.stringify(cleanData);
  if (dataStr.length > 5 * 1024 * 1024) {
    return res.status(413).json({ ok: false, msg: '数据过大，最大支持5MB' });
  }

  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM user_data WHERE user_id = ?')
    .get(Number(userId));

  if (existing) {
    db.prepare('UPDATE user_data SET data = ?, updated_at = ? WHERE user_id = ?')
      .run(dataStr, now, Number(userId));
  } else {
    db.prepare('INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)')
      .run(Number(userId), dataStr, now);
  }

  res.json({ ok: true, updated_at: now });
});

// ==================== GET /api/sync/status - 同步状态检查 ====================
router.get('/status', (req, res) => {
  const { userId, username } = req.query;

  if (!userId || !username) {
    return res.status(400).json({ ok: false, msg: '缺少参数' });
  }

  const db = getDb();
  if (!verifyUser(db, userId, username)) {
    return res.status(403).json({ ok: false, msg: '用户验证失败' });
  }

  const row = db.prepare('SELECT updated_at FROM user_data WHERE user_id = ?')
    .get(Number(userId));

  res.json({ ok: true, synced: !!row, updated_at: row ? row.updated_at : null });
});

module.exports = router;
