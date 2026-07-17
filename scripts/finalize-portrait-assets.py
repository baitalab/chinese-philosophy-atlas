"""Audit portrait coverage and create conservative head-and-shoulders crops.

This script never changes data/portraits.csv. It only crops rows already marked
as sourced-image, writes versioned assets, and records unresolved people for a
separate generation/review pass.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PORTRAITS_CSV = ROOT / "data" / "portraits.csv"
PEOPLE_CSV = ROOT / "data" / "people.csv"
PEOPLE_I18N_CSV = ROOT / "data" / "people_i18n.csv"
SOURCE_DIR = ROOT / "public" / "portraits"
OUTPUT_DIR = ROOT / "public" / "portraits-finalized-v1"
REPORT_PATH = ROOT / "data" / "reports" / "portrait-finalization.json"
CONTACT_SHEET = ROOT / "artifacts" / "portrait-finalization-contact-sheet.jpg"
SOURCE_CONTACT_SHEET = ROOT / "artifacts" / "portrait-source-audit-contact-sheet.jpg"
OUTPUT_SIZE = 512

# Normalized manual crop boxes for traceable historical images where modern
# frontal-face detection is predictably weak (ink paintings, statues, prints).
MANUAL_CROPS = {
    "shennong": (0.18, 0.00, 0.86, 0.73),
    "king-wen-zhou": (0.19, 0.02, 0.91, 0.69),
    "confucius": (0.31, 0.00, 0.86, 0.73),
    "zengzi": (0.19, 0.17, 0.86, 0.67),
    "mozi": (0.10, 0.05, 0.85, 0.80),
    "shang-yang": (0.25, 0.10, 0.78, 0.46),
    "sun-bin": (0.25, 0.08, 0.80, 0.50),
    "zhuangzi": (0.31, 0.06, 0.82, 0.44),
    "ruan-ji": (0.16, 0.06, 0.85, 0.67),
    "ji-kang": (0.12, 0.08, 0.88, 0.57),
    "ge-hong": (0.22, 0.04, 0.75, 0.39),
    "zhi-dun": (0.48, 0.06, 1.00, 0.43),
    "bodhidharma": (0.22, 0.08, 0.79, 0.48),
    "linji-yixuan": (0.19, 0.06, 0.82, 0.50),
    "su-shi": (0.27, 0.05, 0.82, 0.29),
    "liu-zongzhou": (0.18, 0.06, 0.83, 0.45),
}

# These registered files are traceable, but the represented figure is too
# small, ambiguous, or unsuitable for a defensible circular head portrait.
UNSUITABLE_SOURCED_IMAGES = {
    "guan-zhong": "Low-resolution group scene; no defensible individual head crop.",
    "confucius": "Attributed scene does not provide a clearly identifiable head at avatar size.",
    "zhuangzi": "Faint full-body drawing does not provide a legible head crop.",
    "zheng-xuan": "Landscape painting; the attributed person is not legible at avatar size.",
    "ji-kang": "Figure is obscured by landscape linework; head crop is not legible.",
    "zhi-dun": "Automatic detection selected a foreground figure; the attributed sitter is ambiguous.",
    "jizang": "Full-scroll figure is too small for a reliable head crop.",
}


def detect_faces(image_path: Path) -> list[tuple[int, int, int, int]]:
    # cv2.imread cannot reliably open non-ASCII Windows paths.
    image = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return []
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    faces = detector.detectMultiScale(
        gray,
        scaleFactor=1.08,
        minNeighbors=5,
        minSize=(max(24, image.shape[1] // 16), max(24, image.shape[0] // 16)),
    )
    return [tuple(int(value) for value in face) for face in faces]


def choose_face(faces: list[tuple[int, int, int, int]], width: int, height: int):
    if not faces:
        return None

    def score(face):
        x, y, w, h = face
        area = w * h / (width * height)
        cx = (x + w / 2) / width
        cy = (y + h / 2) / height
        centrality = 1 - min(1, math.hypot(cx - 0.5, cy - 0.38))
        return area * 4 + centrality

    return max(faces, key=score)


def face_crop_box(face, width: int, height: int):
    x, y, fw, fh = face
    center_x = x + fw / 2
    # Put the face slightly above center so shoulders remain visible.
    center_y = y + fh * 0.82
    crop_size = max(fw / 0.46, fh / 0.46)
    crop_size = min(crop_size, width, height)
    left = max(0, min(width - crop_size, center_x - crop_size / 2))
    top = max(0, min(height - crop_size, center_y - crop_size * 0.44))
    return tuple(round(value) for value in (left, top, left + crop_size, top + crop_size))


def crop_sourced_image(source: Path, target: Path, box):
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        crop = image.crop(box)
        crop = ImageOps.fit(crop, (OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        crop.save(target, "WEBP", quality=88, method=6)


def denormalize_box(box, width: int, height: int):
    left, top, right, bottom = box
    return (
        round(left * width),
        round(top * height),
        round(right * width),
        round(bottom * height),
    )


def build_contact_sheet(records):
    candidates = [record for record in records if record.get("output_path")]
    thumb = 150
    label_height = 34
    columns = 8
    rows = max(1, math.ceil(len(candidates) / columns))
    sheet = Image.new("RGB", (columns * thumb, rows * (thumb + label_height)), "#f6f4ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=15)
    for index, record in enumerate(candidates):
        row, column = divmod(index, columns)
        x, y = column * thumb, row * (thumb + label_height)
        target = ROOT / record["output_path"]
        with Image.open(target) as portrait:
            portrait = portrait.convert("RGB").resize((thumb, thumb), Image.Resampling.LANCZOS)
            sheet.paste(portrait, (x, y))
        draw.text((x + 5, y + thumb + 5), record["person_id"], fill="#171715", font=font)
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, "JPEG", quality=90)


def build_source_contact_sheet(records):
    candidates = [record for record in records if record["registry_kind"] == "sourced-image"]
    thumb = 180
    label_height = 44
    columns = 7
    rows = max(1, math.ceil(len(candidates) / columns))
    sheet = Image.new("RGB", (columns * thumb, rows * (thumb + label_height)), "#f6f4ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, record in enumerate(candidates):
        row, column = divmod(index, columns)
        x, y = column * thumb, row * (thumb + label_height)
        source = ROOT / "public" / record["registered_path"].lstrip("/")
        with Image.open(source) as portrait:
            portrait = ImageOps.exif_transpose(portrait).convert("RGB")
            preview = ImageOps.contain(portrait, (thumb, thumb), Image.Resampling.LANCZOS)
            px = x + (thumb - preview.width) // 2
            py = y + (thumb - preview.height) // 2
            sheet.paste(preview, (px, py))
        status = "AUTO" if record["status"] == "cropped" else "MANUAL"
        draw.text((x + 4, y + thumb + 4), record["person_id"], fill="#171715", font=font)
        draw.text((x + 4, y + thumb + 22), status, fill="#27743a" if status == "AUTO" else "#a34c2d", font=font)
    SOURCE_CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SOURCE_CONTACT_SHEET, "JPEG", quality=90)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with PORTRAITS_CSV.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    with PEOPLE_CSV.open(encoding="utf-8-sig", newline="") as handle:
        people = {row["id"]: row for row in csv.DictReader(handle)}
    with PEOPLE_I18N_CSV.open(encoding="utf-8-sig", newline="") as handle:
        names = {row["id"]: row for row in csv.DictReader(handle)}

    records = []
    for row in rows:
        person_id = row["person_id"]
        target = OUTPUT_DIR / f"{person_id}.webp"
        if target.exists():
            # Safe idempotent cleanup inside this script's dedicated output directory.
            target.unlink()
        source_path = ROOT / "public" / row["local_path"].lstrip("/") if row["local_path"] else None
        physical_assets = sorted(
            path for path in SOURCE_DIR.glob(f"{person_id}.*") if path.name != "_neutral.svg"
        )
        record = {
            "person_id": person_id,
            "name_zh": names.get(person_id, {}).get("name_zh", ""),
            "name_en": names.get(person_id, {}).get("name_en", ""),
            "period": people.get(person_id, {}).get("period", ""),
            "dating": people.get(person_id, {}).get("dating", ""),
            "birth_year": people.get(person_id, {}).get("birth_year", ""),
            "death_year": people.get(person_id, {}).get("death_year", ""),
            "traditions": people.get(person_id, {}).get("traditions", ""),
            "domains": people.get(person_id, {}).get("domains", ""),
            "registry_kind": row["kind"],
            "registry_review_status": row["review_status"],
            "source_url": row["source_url"],
            "registered_path": row["local_path"],
            "physical_asset_paths": [path.relative_to(ROOT).as_posix() for path in physical_assets],
        }

        if row["kind"] != "sourced-image":
            record.update(
                status="generated-needed",
                reason="No source-reviewed portrait is registered; any loose asset requires separate provenance review.",
                suggested_object_position="50% 38%",
            )
            records.append(record)
            continue

        if not source_path or not source_path.exists():
            record.update(status="generated-needed", reason="Registered sourced image is missing on disk.")
            records.append(record)
            continue

        with Image.open(source_path) as image:
            image = ImageOps.exif_transpose(image)
            width, height = image.size
        faces = detect_faces(source_path)
        face = choose_face(faces, width, height)
        record.update(source_width=width, source_height=height, detected_faces=faces)
        if person_id in UNSUITABLE_SOURCED_IMAGES:
            record.update(
                status="generated-needed",
                reason=UNSUITABLE_SOURCED_IMAGES[person_id],
                source_is_traceable_but_unsuitable=True,
                suggested_object_position="50% 38%",
            )
            records.append(record)
            continue
        if person_id in MANUAL_CROPS:
            box = denormalize_box(MANUAL_CROPS[person_id], width, height)
            crop_sourced_image(source_path, target, box)
            record.update(
                status="cropped",
                crop_method="curated-manual-box",
                crop_box=list(box),
                suggested_object_position="50% 42%",
                output_path=target.relative_to(ROOT).as_posix(),
                manual_crop_needed=False,
            )
            records.append(record)
            continue
        if face is None:
            record.update(
                status="sourced",
                reason="Source is traceable, but automatic face detection was inconclusive; keep original pending manual crop.",
                suggested_object_position="50% 35%",
                manual_crop_needed=True,
            )
            records.append(record)
            continue

        box = face_crop_box(face, width, height)
        crop_sourced_image(source_path, target, box)
        record.update(
            status="cropped",
            crop_method="opencv-face-detection",
            crop_box=list(box),
            suggested_object_position="50% 42%",
            output_path=target.relative_to(ROOT).as_posix(),
            manual_crop_needed=False,
        )
        records.append(record)

    summary = {
        "people": len(records),
        "registry_sourced": sum(record["registry_kind"] == "sourced-image" for record in records),
        "cropped": sum(record["status"] == "cropped" for record in records),
        "sourced_manual_crop_needed": sum(
            record["status"] == "sourced" and record.get("manual_crop_needed") for record in records
        ),
        "generated_needed": sum(record["status"] == "generated-needed" for record in records),
        "unregistered_loose_assets": sum(
            record["registry_kind"] != "sourced-image" and bool(record["physical_asset_paths"])
            for record in records
        ),
    }
    report = {
        "schema": "portrait-finalization-v1",
        "policy": {
            "central_registry_modified": False,
            "source_images_overwritten": False,
            "generated_images_created": False,
            "crop_rule": "Only registry rows already marked sourced-image are eligible for automatic crop.",
        },
        "summary": summary,
        "people": records,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_contact_sheet(records)
    build_source_contact_sheet(records)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
