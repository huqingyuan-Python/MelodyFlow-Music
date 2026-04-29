/**
 * MelodyFlow Music - 用户路由
 * 注册、登录、头像、用户名验证
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

// ==================== 敏感词过滤 ====================

// 敏感词列表（阻止注册为用户名）
const SENSITIVE_WORDS = new Set([
  'fuck', 'shit', 'asshole', 'bitch', 'damn', 'bastard', 'crap', 'piss', 'dick', 'cock',
  'suck', 'sucks', 'wtf', 'omfg', 'lmao', 'lmfao', 'nigger', 'nigga', 'faggot', 'retard',
  '弱智', '智障', '脑残', '傻逼', '煞笔', '傻比', 'sb', 'SB', '傻b',
  '我操', '我艹', '我草', '我曹', '卧槽', '尼玛', '你妈', '他妈',
  '去你妈', '操你', '草你', '艹你', '肏你', '我日', '干你', '干你妈',
  '死妈', '狗妈', '贱人', '贱货', '骚货', '贱逼', '贱比', '臭逼', '臭比',
  '滚蛋', '滚你', '滚远', '死开', '去死', '你死', '必死', '找死',
  '恶心', '恶臭', '下头', '普信', '下贱', '卑微', '舔狗',
  '嫖客', '鸭子', '人妖', '变态', '黄片', '色情', '黄色',
  '人渣', '畜生', '禽兽', '王八', '王八蛋', '乌龟', '绿帽',
  '狗东西', '狗杂种', '野种', '杂种', '私生子',
  'admin', 'root', 'administrator', 'system'
]);

function containsSensitiveWord(text) {
  const lower = text.toLowerCase();
  for (const word of SENSITIVE_WORDS) {
    if (lower.includes(word)) return true;
  }
  return false;
}

// ==================== 用户名验证 ====================

// 允许的字符：小写字母、数字、中文（\u4e00-\u9fff）、日文平片假名（\u3040-\u30ff）、拉丁字母
function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 2 || username.length > 20) return false;
  // 只允许：中文、字母（大小写）、数字、下划线
  return /^[a-zA-Z0-9_\u4e00-\u9fff\u3040-\u30ff]+$/.test(username) && !/^[0-9_]+$/.test(username);
}

function isUsernameAvailable(db, username) {
  const stmt = db.prepare('SELECT id FROM users WHERE username = ?');
  return !stmt.get(username);
}

// ==================== 随机用户名生成 ====================

function generateRandomSuffix(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 避免 I,O,0,1,1 易混淆字符
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateDefaultUsername(db, createdAt) {
  // 格式: MF_YYMMDDSUFFIX
  const date = new Date(createdAt);
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`;

  for (let len = 4; len <= 6; len++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const suffix = generateRandomSuffix(len);
      const username = `MF_${datePart}${suffix}`;
      if (isUsernameAvailable(db, username)) {
        return username;
      }
    }
  }
  // 兜底：用 UUID
  return `MF_${datePart}${uuidv4().replace(/-/g, '').slice(0, 6)}`;
}

// ==================== 头像上传配置 ====================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return cb(new Error('只允许上传图片文件'));
    }
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 JPG/PNG/GIF/WEBP 格式图片'));
    }
  }
});

// ==================== API 路由 ====================

// POST /api/users/register - 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 参数校验
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, msg: '密码至少需要6个字符' });
    }

    const db = getDb();
    const createdAt = new Date().toISOString();
    let finalUsername = username;

    // 如果没有提供用户名，生成默认用户名
    if (!username || !username.trim()) {
      finalUsername = generateDefaultUsername(db, createdAt);
    } else {
      finalUsername = username.trim();

      // 验证用户名格式
      if (!isValidUsername(finalUsername)) {
        return res.status(400).json({
          ok: false,
          msg: '用户名只能使用中文、英文字母、数字和下划线，长度2-20位'
        });
      }

      // 敏感词检查
      if (containsSensitiveWord(finalUsername)) {
        return res.status(400).json({
          ok: false,
          msg: '用户名包含敏感词，请换一个'
        });
      }

      // 检查是否已存在
      if (!isUsernameAvailable(db, finalUsername)) {
        return res.status(409).json({
          ok: false,
          msg: '用户名已被占用，请换一个'
        });
      }
    }

    // 密码哈希
    const password_hash = await bcrypt.hash(password, 10);

    // 插入用户
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, avatar, created_at, updated_at)
      VALUES (?, ?, '', ?, ?)
    `);
    const result = stmt.run(finalUsername, password_hash, createdAt, createdAt);

    // 初始化用户数据
    const dataStmt = db.prepare(`
      INSERT INTO user_data (user_id, data, updated_at) VALUES (?, '{}', ?)
    `);
    dataStmt.run(result.lastInsertRowid, createdAt);

    // 返回用户信息（不含密码）
    res.status(201).json({
      ok: true,
      user: {
        id: result.lastInsertRowid,
        username: finalUsername,
        avatar: '',
        created_at: createdAt
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ ok: false, msg: '用户名已被占用' });
    }
    console.error('Register error:', err);
    res.status(500).json({ ok: false, msg: '服务器错误，请稍后重试' });
  }
});

// POST /api/users/login - 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ ok: false, msg: '请填写用户名和密码' });
    }

    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username.trim());

    if (!user) {
      return res.status(401).json({ ok: false, msg: '用户名或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, msg: '用户名或密码错误' });
    }

    // 更新最后活跃时间
    const updateStmt = db.prepare('UPDATE users SET updated_at = ? WHERE id = ?');
    updateStmt.run(new Date().toISOString(), user.id);

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ ok: false, msg: '服务器错误，请稍后重试' });
  }
});

// GET /api/users/me - 获取当前用户信息（需要传 id 和 username）
router.get('/me', (req, res) => {
  const { id, username } = req.query;
  if (!id || !username) {
    return res.status(400).json({ ok: false, msg: '缺少参数' });
  }
  const db = getDb();
  const stmt = db.prepare('SELECT id, username, avatar, created_at FROM users WHERE id = ? AND username = ?');
  const user = stmt.get(Number(id), username);
  if (!user) {
    return res.status(404).json({ ok: false, msg: '用户不存在' });
  }
  res.json({ ok: true, user });
});

// POST /api/users/update-username - 更新用户名
router.post('/update-username', (req, res) => {
  const { id, oldUsername, newUsername } = req.body;

  if (!id || !oldUsername || !newUsername) {
    return res.status(400).json({ ok: false, msg: '缺少参数' });
  }

  if (!isValidUsername(newUsername)) {
    return res.status(400).json({
      ok: false,
      msg: '用户名只能使用中文、英文字母、数字和下划线，长度2-20位'
    });
  }

  if (containsSensitiveWord(newUsername)) {
    return res.status(400).json({ ok: false, msg: '用户名包含敏感词，请换一个' });
  }

  const db = getDb();

  // 验证旧用户名
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND username = ?').get(Number(id), oldUsername);
  if (!user) {
    return res.status(403).json({ ok: false, msg: '用户验证失败' });
  }

  // 检查新用户名是否被占用
  if (!isUsernameAvailable(db, newUsername)) {
    return res.status(409).json({ ok: false, msg: '用户名已被占用，请换一个' });
  }

  db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
    .run(newUsername, new Date().toISOString(), Number(id));

  res.json({ ok: true, username: newUsername });
});

// POST /api/users/upload-avatar - 上传头像
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  const { userId, username } = req.body;

  if (!req.file) {
    return res.status(400).json({ ok: false, msg: '请上传图片文件' });
  }

  const db = getDb();

  // 验证用户
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND username = ?')
    .get(Number(userId), username);
  if (!user) {
    return res.status(403).json({ ok: false, msg: '用户验证失败' });
  }

  const avatarPath = `/uploads/${req.file.filename}`;

  // 删除旧头像文件
  const oldUser = db.prepare('SELECT avatar FROM users WHERE id = ?').get(Number(userId));
  if (oldUser && oldUser.avatar) {
    const oldPath = path.join(__dirname, '..', oldUser.avatar);
    try {
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (e) { /* 忽略删除错误 */ }
  }

  db.prepare('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?')
    .run(avatarPath, new Date().toISOString(), Number(userId));

  res.json({ ok: true, avatar: avatarPath });
});

// POST /api/users/change-password - 修改密码
router.post('/change-password', async (req, res) => {
  const { id, username, oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ ok: false, msg: '新密码至少需要6个字符' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND username = ?')
    .get(Number(id), username);

  if (!user) return res.status(403).json({ ok: false, msg: '用户验证失败' });

  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) return res.status(401).json({ ok: false, msg: '原密码错误' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hash, new Date().toISOString(), Number(id));

  res.json({ ok: true, msg: '密码修改成功' });
});

module.exports = router;
