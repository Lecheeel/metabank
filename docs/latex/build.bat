@echo off
REM MetaBank 操作手册 - XeLaTeX 编译脚本 (Windows)
echo Compiling manual.tex with XeLaTeX...
xelatex -interaction=nonstopmode manual.tex
xelatex -interaction=nonstopmode manual.tex
echo Done. Output: manual.pdf
