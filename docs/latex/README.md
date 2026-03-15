# MetaBank 操作手册 (LaTeX)

本目录包含 MetaBank 操作手册的 LaTeX 源文件，使用 **XeLaTeX** 编译以支持中文。

## 编译方式

### 方式一：命令行

```bash
xelatex manual.tex
xelatex manual.tex   # 第二次生成目录
```

### 方式二：TeX Live / MiKTeX

在 TeXworks 或 TeXstudio 中打开 `manual.tex`，将编译器设置为 **XeLaTeX**，然后编译。

### 方式三：VS Code + LaTeX Workshop

在 `settings.json` 中配置：

```json
"latex-workshop.latex.tools": [
  {
    "name": "xelatex",
    "command": "xelatex",
    "args": ["-synctex=1", "-interaction=nonstopmode", "%DOC%"]
  }
],
"latex-workshop.latex.recipes": [
  {
    "name": "xelatex",
    "tools": ["xelatex", "xelatex"]
  }
]
```

## 字体说明

文档默认使用 `SimSun`（宋体）。若系统无该字体，可修改 `manual.tex` 中的：

```latex
\setCJKmainfont{SimSun}[AutoFakeBold=true]
```

改为系统中已有的中文字体，例如：
- Windows: `SimSun`, `Microsoft YaHei`, `KaiTi`
- macOS: `Songti SC`, `Heiti SC`, `STKaiti`
- Linux: `Noto Serif CJK SC`, `WenQuanYi Micro Hei`

## 依赖

- TeX Live 或 MiKTeX（含 `xeCJK`, `amsmath`, `hyperref` 等）
- 中文字体
