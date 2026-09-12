import os
import zipfile
import hashlib
from typing import Dict, Iterable, List, Tuple


def _is_within_directory(directory: str, target: str) -> bool:
    abs_directory = os.path.abspath(directory)
    abs_target = os.path.abspath(target)
    return os.path.commonpath([abs_directory]) == os.path.commonpath([abs_directory, abs_target])


def safe_extract_zip(zip_path: str, extract_to: str) -> List[str]:
    os.makedirs(extract_to, exist_ok=True)
    extracted_paths: List[str] = []
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.infolist():
            member_path = os.path.join(extract_to, member.filename)
            if not _is_within_directory(extract_to, member_path):
                continue
            if member.is_dir():
                os.makedirs(member_path, exist_ok=True)
                continue
            parent = os.path.dirname(member_path)
            os.makedirs(parent, exist_ok=True)
            with zf.open(member, 'r') as src, open(member_path, 'wb') as dst:
                for chunk in iter(lambda: src.read(1024 * 1024), b""):
                    dst.write(chunk)
            extracted_paths.append(member_path)
    return extracted_paths


def write_uploaded_file(uploaded_file, target_path: str) -> str:
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, 'wb') as f:
        for chunk in uploaded_file.chunks() if hasattr(uploaded_file, 'chunks') else iter(lambda: uploaded_file.read(1024 * 1024), b""):
            if not chunk:
                break
            f.write(chunk)
    return target_path


def build_manifest(root_dir: str, ignore_dirs: Iterable[str] = (".git", "node_modules", "dist", "build", "venv", ".venv"),
                   max_file_size_mb: int = 20) -> List[Dict]:
    manifest: List[Dict] = []
    max_bytes = max_file_size_mb * 1024 * 1024
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in ignore_dirs]
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            try:
                size = os.path.getsize(fpath)
            except OSError:
                continue
            if size > max_bytes:
                continue
            manifest.append({
                "path": fpath,
                "size": size,
                "ext": os.path.splitext(fname)[1].lower(),
            })
    return manifest


def file_sha1(path: str, chunk_size: int = 1024 * 1024) -> str:
    sha1 = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            if not chunk:
                break
            sha1.update(chunk)
    return sha1.hexdigest()