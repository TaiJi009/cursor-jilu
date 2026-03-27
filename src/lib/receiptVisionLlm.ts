import { formatShoppingDateTime } from "./receiptDateFormat";
import type { LlmProviderId } from "./llmProviders";
import type { Receipt } from "../types/receipt";

const RECEIPT_PROMPT =
  "请识别这张超市购物小票，提取以下信息并只返回 JSON，不要任何解释文字或代码块：" +
  '{ "date":"YYYY-MM-DD HH:mm:ss", "storeName":"超市名称", "items":[{"name":"商品名称","price":数字,"quantity":数字,"subtotal":数字}], "total":数字 }' +
  "。规则：①字段缺失返回 null；②数字字段必须是数字类型；" +
  "③若小票上某商品没有单独列出单价或数量，price 和 quantity 均返回 null，subtotal 填该行金额；" +
  "④若小票上只有一个总金额而无商品明细，items 返回空数组。";

function extractJson(text: string): string {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("模型返回内容不是有效 JSON。");
  }
  return cleaned.slice(start, end + 1);
}

function normalizeReceipt(raw: unknown): Receipt {
  const parsed = (raw ?? {}) as {
    storeName?: string | null;
    date?: string | null;
    items?: Array<{
      name?: string;
      price?: number | string | null;
      quantity?: number | string | null;
      subtotal?: number | string | null;
    }>;
    total?: number | string | null;
  };

  const toNumber = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const rawDate = parsed.date != null ? String(parsed.date).trim() : "";
  const formattedDate = rawDate ? formatShoppingDateTime(rawDate) : null;

  return {
    storeName: parsed.storeName ?? null,
    date: formattedDate ?? (rawDate || null),
    items: (parsed.items ?? []).map((item) => {
      const price = toNumber(item.price);
      const quantity = toNumber(item.quantity);
      const subtotal = toNumber(item.subtotal);

      const resolvedQuantity = quantity ?? (price === null ? 1 : null);
      const resolvedPrice = price ?? (resolvedQuantity !== null ? subtotal : null);

      return {
        name: item.name?.trim() || "",
        price: resolvedPrice,
        quantity: resolvedQuantity,
        subtotal
      };
    }),
    total: toNumber(parsed.total)
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.readAsDataURL(file);
  });
}

type VisionMsg = {
  role: "user";
  content: Array<
    | { type: "image_url"; image_url: { url: string } }
    | { type: "text"; text: string }
  >;
};

function visionUserMessage(imageDataUrl: string, prompt: string): VisionMsg {
  return {
    role: "user",
    content: [
      { type: "image_url", image_url: { url: imageDataUrl } },
      { type: "text", text: prompt }
    ]
  };
}

async function postChatCompletion(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`识别失败: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("模型没有返回识别内容。");
  }
  return content;
}

/** 连通性测试（各品牌用最轻量的文本请求） */
export async function testApiKey(provider: LlmProviderId, apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) return false;
  try {
    switch (provider) {
      case "zhipu": {
        const r = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: "glm-4-flash",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5
          })
        });
        return r.ok;
      }
      case "openai": {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5
          })
        });
        return r.ok;
      }
      case "dashscope": {
        const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: "qwen-turbo",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5
          })
        });
        return r.ok;
      }
      case "deepseek": {
        const r = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5
          })
        });
        return r.ok;
      }
    }
  } catch {
    return false;
  }
}

export async function recognizeReceipt(file: File, provider: LlmProviderId, apiKey: string): Promise<Receipt> {
  if (!apiKey.trim()) {
    throw new Error("请先填写并保存 API Key。");
  }

  const imageDataUrl = await fileToDataUrl(file);
  const messages = [visionUserMessage(imageDataUrl, RECEIPT_PROMPT)];

  let content: string;
  switch (provider) {
    case "zhipu":
      content = await postChatCompletion(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        apiKey,
        {
          model: "glm-4v-flash",
          temperature: 0.1,
          messages
        }
      );
      break;
    case "openai":
      content = await postChatCompletion("https://api.openai.com/v1/chat/completions", apiKey, {
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages
      });
      break;
    case "dashscope":
      content = await postChatCompletion(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        apiKey,
        {
          model: "qwen-vl-plus",
          temperature: 0.1,
          messages
        }
      );
      break;
    case "deepseek":
      content = await postChatCompletion("https://api.deepseek.com/chat/completions", apiKey, {
        model: "deepseek-chat",
        temperature: 0.1,
        messages
      });
      break;
  }

  const jsonText = extractJson(content);
  const parsed = JSON.parse(jsonText) as unknown;
  return normalizeReceipt(parsed);
}
