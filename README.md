# Vinted Seller Workbench

Cut `VINTED-SELLER-CUT-2026-11-05-v1`

Source of truth: [Binding cut — Vinted 卖家工作台 (2026-11-05)](https://app.notion.com/p/40f7b9009fcd8149919afeae07d49048)

Not an official Vinted product. Automating a seller account can violate Vinted's terms. You use this extension at your own risk.

## English

### What this is

A Chrome extension (Manifest V3) for people who already sell on Vinted. It reads the wardrobe from the browser tab you are signed in to, previews a bulk price change, applies it one listing at a time, and exports a UTF-8 CSV.

It does not ask for your Vinted password. It does not upload cookies or CSRF tokens to a server we run. There is no companion dashboard and no pairing code. Auto / scheduled Relist is out of this version.

### Feature Map

| Feature | v1 free | Later |
| --- | --- | --- |
| Wardrobe list | Yes, unlimited reads | Yes |
| Bulk reprice (percent, or fixed add / subtract / set) with preview | 25 successful items / local day | Higher or unlimited |
| CSV `id,title,price,currency,status,url,exported_at` | 100 rows / local day | Higher or unlimited |
| Local unlock stub | Yes | Real license later |
| Auto / scheduled Relist | No | Separate cut |
| Companion dashboard / pairing | No | Separate cut |
| Creem checkout | No | Separate cut |

The same map is in [FEATURE_MAP.md](FEATURE_MAP.md).

### Free limits

Locked by Shane Decision 2026-11-05:

- Bulk reprice: **25** items per local day. Only a successful price write counts. A failed listing does not use the cap and does not stop the others.
- CSV export: **100** data rows per local day. The header row is free. An export that would pass the cap is refused as a whole; it is not silently trimmed.
- Wardrobe read: unlimited, aside from a safety stop of 50 pages so a broken response cannot loop forever. That stop is not the free cap.

The counters live in `chrome.storage.local` on this browser. The numbers are defined only in `src/core/constants.ts`.

When a cap is hit, the popup shows a call to action and a local unlock field. Card checkout is not in this version.

### Local unlock stub

This is not a purchase and it does not contact a payment server.

Enter this exact code in the popup (surrounding spaces are ignored, letter case is not):

```text
VSW-STUB-UNLIMITED
```

The extension then stores `{ "unlocked": true }` under `localLicense` in `chrome.storage.local`. Daily free caps are lifted on this browser until you press **Remove local unlock**. The code itself is not stored.

### Creem later

Creem is the intended payment provider for a later cut. This repository does not include the Creem SDK, Stripe, PayPal, or any other checkout library. v1 cannot charge a card.

### Session and privacy

1. Open the Vinted site you sell on and sign in there.
2. Open the extension. It looks for an https Vinted tab and asks that page to call Vinted.
3. Requests stay in the tab (`credentials: "include"`). The CSRF meta tag, when the page has one, is sent only back to that same Vinted origin.
4. Listing text and the license flag stay in the browser. The wardrobe snapshot is not written to disk by the extension.

There is no password field.

### Assumptions

Cut unknowns U3 and U4 are not treated as extra product requirements.

- **Hosts.** `src/core/vinted-hosts.json` lists public country sites so the extension can run on more than one Vinted market. A country site that is not in the list will not be detected. That list is an assumption, not a claim that every market was re-checked on 2026-11-05.
- **Read path.** The signed-in page is asked for `GET /api/v2/users/current`, then `GET /api/v2/users/{id}/items?page=&per_page=96`. These are the website's own JSON routes described in public write-ups. This project does not call Vinted Pro or any paid third-party Vinted API.
- **Price field.** A listing price is taken only from `price` (number, string, or `{ amount, currency_code }`) or, when `price` is absent, from `price_numeric`. Buyer-protection totals are ignored. A missing price stays blank. It is never filled with a guess.
- **Status.** `active`, `reserved`, `hidden`, `closed`, or `draft` are derived only from boolean flags on the payload. The public `status` string is often the item's condition ("Very good") and is not copied into this column. If no flag is present, status is blank.
- **Write path.** A price change loads `GET /api/v2/item_upload/items/{id}` and sends that draft back with only the price changed. If Vinted has changed that route, the listing is left untouched and the popup shows the HTTP status or a short message. One failure does not cancel the rest of the batch. There is a short pause between writes (`REPRICE_REQUEST_GAP_MS` in `src/core/constants.ts`).
- **Link.** If the payload has no https Vinted `url` or `path`, the row links to `{origin}/items/{id}`.

### Develop and test

```bash
npm install
npm test
npm run build
```

`npm test` runs the unit tests and the TypeScript check. Load the unpacked extension from `dist/` in `chrome://extensions` (Developer mode).

`npm run preview` serves a fixture popup at `http://127.0.0.1:4173`. That page is for local UI checks. It is not a live Vinted session and it is not a product dashboard.

### Disclaimer

This project is not affiliated with Vinted. Vinted's name is used only to identify the site the extension talks to. Bulk editing may break Vinted's terms of service or house rules, and it can affect your account. You are responsible for how you use it. The author does not guarantee that the unpublished website routes above will keep working.

## 中文

### 这是什么

这是一个 Chrome MV3 扩展，给已经在浏览器里登录 Vinted 的卖家用。它读取当前衣柜，按百分比或固定金额预览批量改价，确认后逐条写回，并导出 UTF-8 CSV。

扩展不会向你要 Vinted 密码，也不会把 cookie 或 CSRF 上传到我们自己的服务器。没有配套后台，没有配对码。自动 / 定时 Relist 不在这一版。

### 功能地图

| 功能 | v1 免费 | 以后 |
| --- | --- | --- |
| 衣柜一览 | 有，读取不限 | 有 |
| 批量改价（百分比，或固定金额加 / 减 / 设），含预览 | 每个本地日成功 25 件 | 提高或取消上限 |
| CSV `id,title,price,currency,status,url,exported_at` | 每个本地日 100 行 | 提高或取消上限 |
| 本地解锁占位 | 有 | 以后换成真许可证 |
| 自动 / 定时 Relist | 不做 | 另开切割 |
| 配套后台 / 配对 | 不做 | 另开切割 |
| Creem 收款 | 不做 | 另开切割 |

同一张表见 [FEATURE_MAP.md](FEATURE_MAP.md)。

### 免费额度

按 Shane Decision 2026-11-05 锁定：

- 批量改价：每个本地日 **25** 件。只计算成功写回。失败的那一条不占额度，也不挡住其他商品。
- CSV：每个本地日 **100** 行数据。表头不计。一次导出会超出剩余额度时，整次拒绝，不偷偷截断。
- 衣柜读取：不限。另外有 50 页的安全停，避免坏掉的分页死循环。那不是免费帽。

计数存在这台浏览器的 `chrome.storage.local`。数字只写在 `src/core/constants.ts`。

触顶时弹层给出说明，并留本地解锁输入框。这一版不能刷卡付款。

### 本地解锁占位

这不是购买，也不会连到支付服务器。

在弹层里输入下面这一串（可以有首尾空格，大小写必须一致）：

```text
VSW-STUB-UNLIMITED
```

扩展只在 `chrome.storage.local` 的 `localLicense` 里记下 `{ "unlocked": true }`，不保存这串码。本机的每日免费帽随之取消，直到你点 **Remove local unlock**。

### Creem（后续）

以后的收款打算走 Creem。这个仓库没有接入 Creem SDK，也没有 Stripe、PayPal 或其他结账库。v1 不能真实扣款。

### 会话与隐私

1. 先打开你自己在卖货的 Vinted 站点并登录。
2. 再打开扩展。扩展寻找一个 https 的 Vinted 标签页，让那个页面自己去请求 Vinted。
3. 请求带页面自己的登录态（`credentials: "include"`）。页面上若有 CSRF meta，只随请求回到同一个 Vinted 源。
4. 商品文案和许可证标记留在浏览器里。扩展不把衣柜快照写进自己的服务器。

界面里没有密码框。

### 假设

切割里的未知项 U3、U4 不写成额外需求。

- **站点。** `src/core/vinted-hosts.json` 列出公开的国家站，便于在多个 Vinted 市场使用。不在名单里的国家站不会被认出来。这份名单是假设，不是 2026-11-05 当天对每个市场的复核结论。
- **读取。** 已登录页面会请求 `GET /api/v2/users/current`，再请求 `GET /api/v2/users/{id}/items?page=&per_page=96`。这些是公开资料里描述过的网站自身 JSON 路径。本项目不调用 Vinted Pro，也不调用付费的第三方 Vinted API。
- **价格。** 只读取 `price`（数字、字符串，或 `{ amount, currency_code }`）；没有 `price` 时才读 `price_numeric`。买家保障费不算卖家标价。缺价格就留空，不编造。
- **状态。** `active`、`reserved`、`hidden`、`closed`、`draft` 只根据载荷里的布尔标记推导。公开接口里的 `status` 经常是成色（例如 “Very good”），不会抄进这一列。没有标记时状态留空。
- **写回。** 改价会先 `GET /api/v2/item_upload/items/{id}`，再把这份草稿原样送回，只改价格。若 Vinted 改了这条路径，该商品保持原价，弹层显示 HTTP 状态或一句短错误。某一条失败不会取消其余商品。两次写回之间有一段短暂停（`src/core/constants.ts` 里的 `REPRICE_REQUEST_GAP_MS`）。
- **链接。** 载荷里没有 https 的 Vinted `url` 或 `path` 时，链接用 `{origin}/items/{id}`。

### 开发与测试

```bash
npm install
npm test
npm run build
```

`npm test` 会跑单元测试并做 TypeScript 检查。在 `chrome://extensions` 打开开发者模式，加载 `dist/` 未打包扩展。

`npm run preview` 在 `http://127.0.0.1:4173` 打开夹具弹层，只用于本地看界面。它不是真实的 Vinted 会话，也不是产品后台。

### 免责声明

本项目与 Vinted 无关。出现 Vinted 的名字，只是为了说明扩展在跟哪个网站说话。批量改价可能违反 Vinted 的服务条款或站内规则，也可能影响你的账号。你要为自己的使用方式负责。上文那些未公开的网站路径不保证一直可用。
