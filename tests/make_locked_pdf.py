# Genera tests/.cache/locked.pdf: una página en blanco con contraseña "1234" (para probar ese flujo).
import os
from pypdf import PdfWriter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(ROOT, "tests", ".cache", "locked.pdf")
os.makedirs(os.path.dirname(out), exist_ok=True)
w = PdfWriter()
w.add_blank_page(width=200, height=200)
w.encrypt(user_password="1234", owner_password="dueno-1234", algorithm="RC4-128")
with open(out, "wb") as f:
    w.write(f)
print(out)
