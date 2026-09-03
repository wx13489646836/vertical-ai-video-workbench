# AI 视频工作台前端接口契约

## 通用约定

- API 前缀：`/api/v1`；当前前端不发送 Cookie 或 Authorization。
- 成功响应：`{ "data": <payload>, "requestId": "可选" }`。
- 失败响应：HTTP 非 2xx，并返回 `{ "code": "ERROR_CODE", "message": "面向用户的说明", "requestId": "可选" }`。
- 时间使用带时区的 ISO 8601；金额使用整数分；时长使用秒；额度数量使用非负整数。
- 游标页统一为 `{ "items": [], "nextCursor": "下一页游标或 null" }`，默认 `limit=20`，最大 50。

## 一周热榜

### `GET /api/v1/trending/categories`

`data` 是行业数组：

```json
[
  {
    "id": "home",
    "name": "家居日用",
    "children": [{ "id": "furniture", "name": "家具" }]
  }
]
```

行业必须至少包含一个子类。该接口失败时前端会使用本地类目；其他业务接口失败不会回退模拟数据。

### `GET /api/v1/trending/videos`

参数：`industryId`、`subcategoryId`、`duration`、`cursor`、`limit`。`duration` 可取 `all | lte_15 | lte_60 | gt_60`。

```json
{
  "data": {
    "items": [
      {
        "id": "video-id",
        "platform": "douyin",
        "rank": 1,
        "title": "视频标题",
        "creator": { "name": "作者", "avatarUrl": "https://...", "level": 5 },
        "coverUrl": "https://...",
        "product": { "name": "商品名称", "url": "https://..." },
        "publishedAt": "2026-09-02T15:40:20+08:00",
        "durationSeconds": 101,
        "metrics": {
          "playCount": { "value": 10000000, "label": "1000万+" },
          "settlementAmount": { "minFen": 5000000, "maxFen": 10000000, "label": "50万-100万" },
          "likeCount": { "value": 30000, "label": "3万+" }
        },
        "sourceUrl": "https://www.douyin.com/video/...",
        "videoUrl": "https://... 或 null"
      }
    ],
    "nextCursor": null
  }
}
```

前端当前展示 `metrics.*.label`，原始数值供后续排序和统计使用。

## 历史任务

### `GET /api/v1/video-tasks?cursor=&limit=20`

```json
{
  "data": {
    "items": [
      {
        "id": "task-id",
        "title": "任务名称",
        "sourceUrl": "https://... 或 null",
        "videoUrl": "https://... 或 null",
        "coverUrl": "https://... 或 null",
        "generatedAt": "2026-09-02T13:48:00+08:00",
        "durationSeconds": 31,
        "status": "queued | processing | completed | failed",
        "progress": 68,
        "failureReason": null,
        "playbackAvailable": false,
        "inputSnapshot": {
          "sourceVideo": {
            "kind": "link",
            "videoUrl": "https://cdn.example.com/original.mp4",
            "coverUrl": "https://cdn.example.com/original.jpg",
            "durationSeconds": 36,
            "fileName": null
          },
          "products": [{
            "id": "product-map-1",
            "original": { "id": "product-original-1", "label": "原产品", "imageUrl": "https://..." },
            "replacement": { "id": "product-new-1", "label": "新产品", "imageUrl": "https://..." }
          }],
          "characters": [{
            "id": "character-map-1",
            "original": { "id": "character-original-1", "label": "原人物", "imageUrl": "https://..." },
            "replacement": { "id": "character-new-1", "label": "新人物", "imageUrl": "https://..." }
          }],
          "scenes": [{
            "id": "scene-map-1",
            "original": { "id": "scene-original-1", "label": "原场景", "imageUrl": "https://..." },
            "replacement": { "id": "scene-new-1", "label": "新场景", "imageUrl": "https://..." }
          }]
        }
      }
    ],
    "nextCursor": null
  }
}
```

- `progress` 可省略，但存在时必须为 0–100。
- `failureReason`、`videoUrl`、`coverUrl`、`sourceUrl` 可为 `null` 或省略。
- 失败任务通常不返回 `coverUrl` 和 `sourceUrl`；前端会显示失败占位，并隐藏来源链接。
- 只有 `playbackAvailable=true` 且 `videoUrl` 有值时，前端启用封面播放与下载。
- `inputSnapshot` 是任务开始生成时固化的输入快照；不存在时前端禁用“查看”。
- `sourceVideo.kind` 为 `link | file`，`videoUrl`、`coverUrl`、`fileName` 可为 `null` 或省略；时长统一使用秒。
- `products`、`characters`、`scenes` 必须返回替换映射数组，没有指定对应素材时返回空数组；每组映射必须包含稳定 `id` 以及完整的 `original`、`replacement` 素材。
- 同一种素材允许返回多组映射，前端会按数组顺序展示明确的 `original (A) → replacement (B)` 关系。
- 为兼容旧接口，前端仍可读取直接由 `MediaReference` 组成的数组，但会把原素材标记为“原素材未记录”；后端新实现应始终返回完整映射。
- “查看”展示 `inputSnapshot` 中的原视频及产品、人物、场景替换映射；生成结果仍通过封面播放。
- 只有 `sourceUrl` 有值时，前端启用“做同款”。

### `DELETE /api/v1/video-tasks/{id}`

成功返回 HTTP 204。前端仅在成功后移除记录。

### `POST /api/v1/video-tasks/{id}/download-url`

```json
{
  "data": {
    "url": "https://signed-download-url",
    "filename": "生成视频.mp4",
    "expiresAt": "2026-09-02T16:00:00+08:00 或 null"
  }
}
```

## 我的

### `GET /api/v1/account/summary`

```json
{
  "data": {
    "avatarUrl": "https://...",
    "nickname": "昵称",
    "maskedPhone": "138 **** 5628",
    "userId": "FC-2086-0914",
    "balanceFen": 8650,
    "quotaRemaining": 28,
    "quotaUsedThisMonth": 12
  }
}
```

### `GET /api/v1/account/quota-usages?cursor=&limit=20`

`data` 使用通用游标页，记录结构如下：

```json
{
  "id": "usage-id",
  "occurredAt": "2026-09-01T14:32:00+08:00",
  "taskTitle": "城市夜游氛围片",
  "amount": 4,
  "status": "consumed | refunded"
}
```

`amount` 始终为非负整数，前端根据 `status` 显示减号或加号。

## 前端切换方式

```bash
# 本地演示
VITE_DATA_MODE=mock

# 联调
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://127.0.0.1:8080/
```

修改 Vite 环境变量后需要重启开发服务器。
