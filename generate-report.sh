#!/usr/bin/env bash
set -euo pipefail

INPUT_FILE="${1:-./raporty/raport.docx}"
OUTPUT_DIR="${2:-./raporty}"

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
  cd "$REPO_ROOT"
fi

INPUT_PATH="$(realpath "$INPUT_FILE")"
OUTPUT_PATH="$(realpath -m "$OUTPUT_DIR")"

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Nie znaleziono pliku wejściowego: $INPUT_PATH" >&2
  exit 1
fi

mkdir -p "$OUTPUT_PATH"

DATE_PART="$(date +%y-%m-%d)"
TEMP_PDF="$OUTPUT_PATH/raport.pdf"
TARGET_PDF="$OUTPUT_PATH/Raport_Z6_${DATE_PART}.pdf"

if command -v soffice >/dev/null 2>&1; then
  echo "==> Generowanie PDF przez LibreOffice"
  soffice --headless --convert-to pdf --outdir "$OUTPUT_PATH" "$INPUT_PATH"
else
  echo "Brak LibreOffice ('soffice') w systemie." >&2
  exit 1
fi

if [[ ! -f "$TEMP_PDF" ]]; then
  echo "LibreOffice nie wygenerował pliku PDF." >&2
  exit 1
fi

mv -f "$TEMP_PDF" "$TARGET_PDF"
echo "==> Gotowe: $TARGET_PDF"
