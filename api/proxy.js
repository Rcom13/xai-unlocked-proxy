import { fetch } from 'undici';   // Vercel 内置，无需安装

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  const { method, url, headers } = req;

  // 把 /api/v1/... 转成 https://api.x.ai/v1/...
  const targetPath = url.replace(/^\/api/, '');
  const targetUrl = `https://api.x.ai${targetPath}`;

  // 你的 xAI API Key（稍后在 Vercel 后台填）
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "XAI_API_KEY 未设置" });
  }

  try {
    // 读取原始 body（流式）
    const rawBody = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    let modifiedBody = {};
    if (rawBody.length > 0) {
      try {
        modifiedBody = JSON.parse(rawBody.toString());
      } catch (e) {}
    }

    // 强制清除所有可能的安全/审核字段
    delete modifiedBody.safety_settings;
    delete modifiedBody.moderation_level;
    delete modifiedBody.filters;
    delete modifiedBody.blocked;

    // 强制使用图像模型（你想用哪个改哪个）
    if (targetPath.includes('/images/generations')) {
      modifiedBody.model = modifiedBody.model || "grok-2-image-1212";  // 2025 最新图像模型
    }

    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...headers,
        host: undefined,   // 去掉 Vercel 的 host
      },
      body: Object.keys(modifiedBody).length ? JSON.stringify(modifiedBody) : undefined,
    });

    // 直接透传 xAI 的响应（包括图片 base64）
    res.status(response.status);
    for (const [k, v] of response.headers) {
      res.setHeader(k, v);
    }
    response.body.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "代理出错", message: error.message });
  }
}
