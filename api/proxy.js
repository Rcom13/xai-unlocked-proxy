// api/proxy.js  2025 Vercel 路径透传优化版
import { fetch } from 'undici';

export default async function handler(req, res) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    // GET 或空 body 忽略
  }

  // 精确路径解析：从 req.url 提取，避开 /api/ 前缀
  let targetPath = req.url;
  if (targetPath.startsWith('/api/')) {
    targetPath = targetPath.replace('/api/', '/v1/');  // 转成 xAI 标准 /v1/...
  } else if (targetPath.startsWith('/v1/')) {
    // 已标准
  } else {
    return res.status(400).json({ error: "Invalid path" });
  }
  const targetUrl = `https://api.x.ai${targetPath}`;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "XAI_API_KEY 未设置" });

  // 清除审核 + 图像优化（不变）
  delete body.safety_settings;
  delete body.moderation_level;
  delete body.filters;
  delete body.blocked;
  if (targetPath.includes('/images/generations')) {
    body.model = body.model || "grok-2-image-1212";
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: req.method !== "GET" ? JSON.stringify(body) : undefined,
  });

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  response.body.pipe(res);
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};