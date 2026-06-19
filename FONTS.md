# 字体授权说明

本仓库**不分发任何字体文件**。所有字体由 `scripts/fetch-fonts.sh` 在本地从各自的官方或授权来源下载，
切片（subset）后供项目使用。下载的字体文件均被 `.gitignore` 排除，不进版本控制。

这样做的原因：部分字体（如 Satoshi）的授权允许免费使用，但**不允许把字体文件单独再分发**。
仓库只保存「下载脚本 + @font-face 配置」，规避再分发问题，使用者自行从合法来源获取字体。

## 各字体来源与授权

| 字体 | 用途 | 授权 | 来源 |
|---|---|---|---|
| Geist / Geist Mono | dark/editorial 英文 | SIL OFL 1.1 | github.com/vercel/geist-font |
| Satoshi | warm 英文 | Fontshare 免费授权（不可单独再分发） | fontshare.com/fonts/satoshi |
| 得意黑 Smiley Sans | brutalist 中文标题 | SIL OFL 1.1 | github.com/atelier-anchor/smiley-sans |
| 霞鹜文楷 LXGW WenKai | warm 中文 | SIL OFL 1.1 | github.com/lxgw/LxgwWenKai |
| 思源黑体 Noto Sans SC | 中文正文回退 | SIL OFL 1.1 | github.com/notofonts/noto-cjk |
| 思源宋体 Noto Serif SC | editorial 中文 | SIL OFL 1.1 | github.com/notofonts/noto-cjk |
| MiSans | dark 中文 | 小米 MiSans 免费授权 | hyperos.mi.com/font |
| Fraunces / Space Grotesk | editorial/brutalist 标题 | SIL OFL 1.1 | Google Fonts |

## 商用提醒

- OFL 字体可随产品自由分发、商用，无需署名（但不可单独售卖字体本身）。
- **Satoshi**：使用免费，但发布产品时勿将字体文件作为可单独下载的资源暴露。
- **MiSans**：小米免费商用授权；正式商用建议从小米官网 https://hyperos.mi.com/font 下载官方版本，
  本脚本默认从社区镜像下载仅为方便开发。

## 配齐字体

```bash
./scripts/fetch-fonts.sh --subset starter
```

下载全部字体到 `fonts/`（中文原始）和 `starter/public/fonts/`（英文 woff2），
并对中文字体按 starter 实际用字做 subset（24M → ~150K）。
