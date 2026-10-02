"""Resume Text Extractor Utility
Supports extracting plain text from PDF and DOCX files/buffers.
"""

import io
import re
import logging
from typing import Union, BinaryIO

logger = logging.getLogger("TextExtractor")

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    logger.warning("pypdf is not available.")

try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    logger.warning("python-docx is not available.")


def extract_text_from_pdf(file_source: Union[bytes, BinaryIO, str]) -> str:
    """Extract plain text from a PDF file buffer or path."""
    if not PYPDF_AVAILABLE:
        raise RuntimeError("pypdf is required to extract text from PDF files.")

    if isinstance(file_source, bytes):
        stream = io.BytesIO(file_source)
    elif isinstance(file_source, str):
        stream = open(file_source, "rb")
    else:
        stream = file_source

    reader = pypdf.PdfReader(stream)
    pages_text = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages_text.append(text.strip())

    if isinstance(file_source, str):
        stream.close()

    raw_text = "\n\n".join(pages_text)
    return clean_extracted_text(raw_text)


def extract_text_from_docx(file_source: Union[bytes, BinaryIO, str]) -> str:
    """Extract plain text from a DOCX file buffer or path."""
    if not DOCX_AVAILABLE:
        raise RuntimeError("python-docx is required to extract text from DOCX files.")

    if isinstance(file_source, bytes):
        stream = io.BytesIO(file_source)
    else:
        stream = file_source

    doc = docx.Document(stream)
    full_text = []

    # Paragraphs
    for para in doc.paragraphs:
        if para.text.strip():
            full_text.append(para.text.strip())

    # Tables
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                full_text.append(row_text)

    raw_text = "\n".join(full_text)
    return clean_extracted_text(raw_text)


def extract_text_from_resume(file_bytes: bytes, filename: str) -> str:
    """Auto-detect format by filename extension and extract clean text."""
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif lower_name.endswith((".docx", ".doc")):
        try:
            return extract_text_from_docx(file_bytes)
        except Exception as e:
            logger.warning(f"DOCX extraction failed: {e}. Trying raw decode.")
            return clean_extracted_text(file_bytes.decode("utf-8", errors="ignore"))
    else:
        # Fallback to UTF-8 text decode
        return clean_extracted_text(file_bytes.decode("utf-8", errors="ignore"))


def clean_extracted_text(text: str) -> str:
    """Normalize extracted text whitespace and formatting."""
    # Replace non-breaking spaces and excessive empty lines
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
