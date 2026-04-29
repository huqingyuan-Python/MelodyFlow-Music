/**
 * MelodyFlow 多平台音乐API服务
 * 基于 Meting-API，支持VIP歌曲解析
 */

const http = require('http');
const https = require('https');
const url = require('url');

// 配置
const PORT = process.env.PORT || 3000;

// 外部免费API - 支持VIP解析
const METING_API = 'https://api.qijieya.cn/meting/';

// 创建 HTTP 请求的 Promise 封装
function request(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = targetUrl.startsWith('https') ? https : http;
    const req = protocol.get(targetUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          // 如果不是JSON，可能直接返回字符串（如歌词）
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// 获取外部API数据
async function fetchMeting(type, id, options = {}) {
  try {
    let apiUrl = `${METING_API}?type=${type}&id=${id}`;
    if (options.br) apiUrl += `&br=${options.br}`;
    if (options.limit) apiUrl += `&limit=${options.limit}`;
    if (options.page) apiUrl += `&page=${options.page}`;

    const data = await request(apiUrl);
    return { success: true, data };
  } catch (e) {
    console.error(`Meting API error (${type}):`, e.message);
    return { success: false, error: e.message };
  }
}

// 搜索接口 - 使用 Meting-API
async function searchSongs(keywords, platform = 'netease', limit = 30) {
  const server = platform === 'qqmusic' || platform === 'tencent' ? 'tencent' : 'netease';
  const result = await fetchMeting('search', encodeURIComponent(keywords), { limit, server });

  if (!result.success) {
    return { success: false, error: result.error, list: [] };
  }

  try {
    let songs = [];
    const data = result.data;

    // 兼容不同格式
    if (typeof data === 'string') {
      // 可能返回的是字符串，尝试解析
      return { success: true, list: [] };
    }

    // Meting-API 返回格式：可能是数组或包含 songs 属性的对象
    if (Array.isArray(data)) {
      songs = data;
    } else if (data.songs) {
      songs = data.songs;
    } else if (data.result && data.result.songs) {
      songs = data.result.songs;
    }

    return {
      success: true,
      list: songs.map(song => normalizeSong(song, platform))
    };
  } catch (e) {
    console.error('Parse search result error:', e);
    return { success: false, error: e.message, list: [] };
  }
}

// 标准化歌曲数据
function normalizeSong(song, platform) {
  return {
    id: song.id || song.songid || song.song_id || 0,
    name: song.name || song.title || song.songname || '未知歌曲',
    artist: Array.isArray(song.artists) ? song.artists.map(a => a.name).join(' / ') :
            song.artist || song.ar?.map(a => a.name).join(' / ') ||
            song.singer?.map(s => s.name).join(' / ') || '未知艺术家',
    album: song.album?.name || song.albumName || song.album || '未知专辑',
    duration: song.duration || song.interval * 1000 || 0,
    cover: song.cover || song.pic || song.picUrl || song.album?.picUrl || null,
    platform: platform
  };
}

// 获取歌曲直链 - 使用 Meting-API
async function getSongUrl(id, platform = 'netease') {
  const server = platform === 'qqmusic' || platform === 'tencent' ? 'tencent' : 'netease';

  // 先用最高音质尝试
  let result = await fetchMeting('url', id, { br: 2000, server });

  // 如果失败，尝试较低音质
  if (!result.success || !result.data) {
    result = await fetchMeting('url', id, { br: 320, server });
  }

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Meting-API 直接返回直链字符串
  let songUrl = result.data;
  if (typeof songUrl === 'object' && songUrl.url) {
    songUrl = songUrl.url;
  }

  if (songUrl && typeof songUrl === 'string' && songUrl.startsWith('http')) {
    return { success: true, url: songUrl, quality: '320k' };
  }

  return { success: false, error: '无法获取播放链接' };
}

// 获取歌词
async function getSongLyrics(id, platform = 'netease') {
  const server = platform === 'qqmusic' || platform === 'tencent' ? 'tencent' : 'netease';
  const result = await fetchMeting('lrc', id, { server });

  if (!result.success) {
    return { success: true, lyrics: [], translation: [] };
  }

  const lrcText = result.data;
  if (typeof lrcText === 'string') {
    return {
      success: true,
      lyrics: parseLRC(lrcText),
      translation: []
    };
  }

  return { success: true, lyrics: [], translation: [] };
}

// 获取封面
async function getSongCover(id, platform = 'netease') {
  const server = platform === 'qqmusic' || platform === 'tencent' ? 'tencent' : 'netease';
  const result = await fetchMeting('pic', id, { cover: 500, server });

  if (!result.success) {
    return null;
  }

  let cover = result.data;
  if (typeof cover === 'object' && cover.url) {
    cover = cover.url;
  }

  return cover || null;
}

// 解析LRC歌词
function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split('\n');
  const result = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result;
}

// HTTP 服务器
const server = http.createServer(async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // 设置 JSON 响应头
  res.setHeader('Content-Type', 'application/json');

  try {
    // 健康检查
    if (pathname === '/health' || pathname === '/status') {
      res.writeHead(200);
      res.end(JSON.stringify({
        ok: true,
        msg: 'MelodyFlow Music API Server Running',
        platforms: ['netease (网易云)', 'tencent (QQ音乐)'],
        vipSupport: true
      }));
      return;
    }

    // 搜索接口
    if (pathname === '/api/search') {
      const keywords = query.keywords || query.words;
      const platform = query.platform || 'netease';
      const limit = parseInt(query.limit) || 30;

      if (!keywords) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing keywords parameter' }));
        return;
      }

      const result = await searchSongs(keywords, platform, limit);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // 获取歌曲URL
    if (pathname === '/api/music/urls') {
      const id = query.id;
      const platform = query.platform || 'netease';

      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing id parameter' }));
        return;
      }

      const result = await getSongUrl(id, platform);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // 获取歌词
    if (pathname === '/api/music/lyrics') {
      const id = query.id;
      const platform = query.platform || 'netease';

      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing id parameter' }));
        return;
      }

      const result = await getSongLyrics(id, platform);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // 获取封面
    if (pathname === '/api/music/cover') {
      const id = query.id;
      const platform = query.platform || 'netease';

      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing id parameter' }));
        return;
      }

      const cover = await getSongCover(id, platform);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, cover }));
      return;
    }

    // 获取歌曲详情
    if (pathname === '/api/music/song') {
      const id = query.id;
      const platform = query.platform || 'netease';

      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing id parameter' }));
        return;
      }

      const server = platform === 'qqmusic' || platform === 'tencent' ? 'tencent' : 'netease';
      const result = await fetchMeting('song', id, { server });

      if (result.success) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result.data }));
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
      return;
    }

    // 获取支持的平台列表
    if (pathname === '/api/platforms') {
      res.writeHead(200);
      res.end(JSON.stringify({
        platforms: [
          { value: 'netease', label: '网易云音乐', vipSupport: true },
          { value: 'tencent', label: 'QQ音乐', vipSupport: true }
        ]
      }));
      return;
    }

    // 获取歌单
    if (pathname === '/api/playlist') {
      const id = query.id;
      const platform = query.platform || 'netease';

      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing id parameter' }));
        return;
      }

      const server = platform === 'qqmusic' || platform === 'tencent' ? 'tencent' : 'netease';
      const result = await fetchMeting('playlist', id, { server });

      if (result.success && Array.isArray(result.data)) {
        const list = result.data.map(song => normalizeSong(song, platform));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, list }));
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Failed to fetch playlist' }));
      }
      return;
    }

    // 未知路由
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: 'Not found' }));

  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`
========================================
   MelodyFlow 音乐API服务
   (基于 Meting-API)
========================================
   服务地址: http://127.0.0.1:${PORT}
   VIP支持: 是
   支持平台: 网易云音乐 / QQ音乐
========================================
   API 文档:
   - GET /api/search?keywords=关键词&platform=平台
   - GET /api/music/urls?id=歌曲ID&platform=平台
   - GET /api/music/lyrics?id=歌曲ID&platform=平台
   - GET /api/music/cover?id=歌曲ID&platform=平台
   - GET /api/playlist?id=歌单ID&platform=平台
   - GET /health

   平台参数:
   - netease: 网易云音乐
   - tencent: QQ音乐

========================================
  `);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在停止服务...');
  server.close(() => {
    console.log('服务已停止');
    process.exit(0);
  });
});
