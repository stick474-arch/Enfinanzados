# Revisa la sintaxis de cada <script> de index.html (no hay Node en este equipo).
import os, re, sys, esprima
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
for i, b in enumerate(re.findall(r"<script>(.*?)</script>", s, re.S)):
    b = b.replace(r"/^\p{Emoji_Presentation}/u", "/^x/")
    esprima.parseScript(b)
    print("script", i, "ok", len(b))
