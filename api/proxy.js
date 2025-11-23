// api/proxy.js   ← 2025 年最新 Vercel 完全兼容版
import { fetch } from 'undici';

export default async function handler(req, res) {
  // 直接用 req.json() 读取 body（新版 Vercel 唯一合法方式）
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    // GET 请求或空 body 时忽略
  }

  // 路径转换：/api/v1/... → https://api.x.ai/v1/...
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const targetPath = pathname;                     // 现在已经是 /v1/xxx 格式了
  const targetUrl = `https://api.x.ai${targetPath}`;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "缺少 XAI_API_KEY" });

  // 强制清除所有审核字段
  delete body.safety_settings;
  delete body.moderation_level;
  delete body.filters;
  delete body.blocked;

  // 图像生成强制用最新模型
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

  // 直接透传所有 header 和 body
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  response.body.pipe(res);
}

// 关键：关闭 Vercel 自动 bodyParser（必须加这行！！！）
export const config = {
  api: {
    bodyParser: false,        // 必须关掉
    externalResolver: true,   // 必须打开
  },
};