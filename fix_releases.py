import urllib.request
import json

TOKEN = open(r"C:\Users\HP\.workbuddy\gh_token.txt").read().strip()
REPO = "huqingyuan-Python/MelodyFlow-Music"
BASE = f"https://api.github.com/repos/{REPO}"

def api(method, path, body=None, need_response=True):
    url = f"{BASE}{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("Accept", "application/vnd.github+json")
    resp = urllib.request.urlopen(req)
    content = resp.read()
    return json.loads(content) if content and need_response else {}

def api_raw(method, url, body=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("Accept", "application/vnd.github+json")
    resp = urllib.request.urlopen(req)
    content = resp.read()
    return json.loads(content) if content else {}

# 删除遗留 tag
old_tags = ["v2.1.0", "v2.0.0", "v1.0.0", "0.9.0-beta"]
for tag in old_tags:
    print(f"删除 tag: refs/tags/{tag}")
    try:
        api("DELETE", f"/git/refs/tags/{tag}", need_response=False)
        print(f"  OK")
    except Exception as e:
        print(f"  失败: {e}")

# dac220f 的 commit 信息
commit_info = api("GET", "/commits/dac220f")
print(f"\ndac220f commit: {commit_info.get('sha', 'unknown')[:8]}")

# 创建 0.9.5-beta tag 对象
tag_obj = api("POST", "/git/tags", {
    "tag": "0.9.5-beta",
    "message": "MelodyFlow Music 0.9.5 Beta",
    "object": "dac220f",
    "type": "commit"
})
tag_sha = tag_obj["sha"]
print(f"\n创建 tag 对象: 0.9.5-beta -> {tag_sha[:8]}")

# 创建 git ref
api("POST", "/git/refs", {
    "ref": "refs/tags/0.9.5-beta",
    "sha": tag_sha
}, need_response=False)
print("创建 git ref: refs/tags/0.9.5-beta")

# 创建 release
release = api_raw("POST", f"{BASE}/releases", {
    "tag_name": "0.9.5-beta",
    "name": "MelodyFlow Music 0.9.5 Beta",
    "body": (
        "MelodyFlow Music 0.9.5 Beta\n\n"
        "Beta 测试版发布\n\n"
        "新增功能\n"
        "- 在线音乐搜索（支持多平台）\n"
        "- LX Music API 集成\n"
        "- 网易云音乐搜索播放\n"
        "- QQ音乐搜索播放\n"
        "- 自动获取歌曲封面与歌词\n"
        "- 迷你播放器（悬浮小窗口）\n"
        "- 播放速率控制（0.5x ~ 2.0x）\n"
        "- 键盘快捷键支持\n"
        "- 歌曲下载功能\n"
        "- A-B 重复（适合语言学习）\n"
        "- 睡眠定时器（15/30/45/60 分钟）\n\n"
        "界面增强\n"
        "- 四套主题：深色、浅色、粉色、蓝色\n"
        "- 全屏播放器优化\n"
        "- 歌词翻译支持\n\n"
        "技术升级\n"
        "- Meting API 多备用源自动降级\n"
        "- 播放列表管理增强\n"
        "- 播放统计功能\n"
    ),
    "draft": False,
    "prerelease": True
})
print(f"\n0.9.5-beta release: {release.get('html_url', release)}")

# 验证最终状态
print("\n=== 最终发行版 ===")
releases = api("GET", "/releases")
for r in releases:
    print(f"  {r['tag_name']} - {r['name']}")
print("\n=== 最终 tags ===")
tags = api("GET", "/tags")
for t in tags:
    print(f"  {t['name']}")
