from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "outputs" / "portrait-sheets"
OUT = ROOT / "public" / "portraits-generated-v1"
PORTRAITS_CSV = ROOT / "data" / "portraits.csv"


SHEET_SPECS = [
    ("preqin.png", 5, 4, [
        "shun", "duke-zhou", "laozi", "sunzi", "zisi",
        "liezi", "yang-zhu", "shen-buhai", "mencius", "hui-shi",
        "gaozi", "xu-xing", "shen-dao", "gongsun-long", "zou-yan",
        "xunzi", "han-fei", "lu-buwei", "li-si",
    ]),
    ("han-tang.png", 7, 4, [
        "liu-an", "sima-tan", "sima-qian", "yang-xiong", "huan-tan", "wang-chong", "wang-fu",
        "he-yan", "wang-bi", "xiang-xiu", "guo-xiang", "pei-wei", "huiyuan", "sengzhao",
        "daosheng", "fan-zhen", "du-shun", "xuanzang", "kuiji", "shenxiu", "huineng",
        "fazang", "shenhui", "mazu-daoyi", "liu-zongyuan", "li-ao", "zongmi", "huangbo-xiyun",
    ]),
    ("song-qing.png", 8, 4, [
        "shao-yong", "zhou-dunyi", "zhang-zai", "cheng-hao", "hu-hong", "lv-zuqian", "zhu-xi", "lu-jiuyuan",
        "chen-liang", "ye-shi", "xu-heng", "wang-yinglin", "wu-cheng", "wu-yubi", "chen-xianzhang", "wang-yangming",
        "zhan-ruoshui", "wang-gen", "qian-dehong", "wang-ji", "luo-rufang", "li-zhi", "wang-daiyu", "huang-zongxi",
        "wang-fuzhi", "ma-zhu", "li-gong", "liu-zhi", "dai-zhen", "zhang-xuecheng", "jiao-xun",
    ]),
    ("late-and-new.png", 7, 4, [
        "gong-zizhen", "tan-sitong", "kang-youwei", "he-zhen", "cai-yuanpei", "liang-shuming", "ma-yifu",
        "xiong-shili", "feng-youlan", "jin-yuelin", "he-lin",
        "yan-ying", "zhongchang-tong", "lu-sheng", "lv-cai", "wang-tong-sui", "wunengzi", "lv-kun",
        "luo-qinshun", "wang-tingxiang", "fang-yizhi", "gao-panlong", "gu-xiancheng", "tang-zhen", "feng-guifen", "lu-xun",
    ]),
    ("contemporary.png", 5, 4, [
        "li-da", "ai-siqi", "fang-dongmei", "mou-zongsan", "feng-qi",
        "zhang-dainian", "lao-sze-kwang", "wang-ruoshui", "zhang-shiying", "li-zehou",
        "cheng-chung-ying", "tu-weiming", "chen-lai", "huang-yong", "jiang-qing",
        "robin-wang", None, "zhao-tingyang", "li-chenyang", "bai-tongdong",
    ]),
    ("audit-replacements.png", 4, 2, [
        "guan-zhong", "confucius", "zhuangzi", "zheng-xuan",
        "ji-kang", "zhi-dun", "jizang", "yang-guorong",
    ]),
]


def crop_sheet(filename: str, columns: int, rows: int, people: list[str | None]) -> list[str]:
    image = Image.open(SHEETS / filename).convert("RGB")
    cell_width = image.width / columns
    cell_height = image.height / rows
    written: list[str] = []
    for index, person_id in enumerate(people):
        if not person_id:
            continue
        column = index % columns
        row = index // columns
        bounds = (
            round(column * cell_width),
            round(row * cell_height),
            round((column + 1) * cell_width),
            round((row + 1) * cell_height),
        )
        cell = image.crop(bounds)
        # The generation prompts place eyes slightly above center. Centering the
        # square crop at 44% keeps hair/headwear while removing excess torso.
        portrait = ImageOps.fit(cell, (512, 512), method=Image.Resampling.LANCZOS, centering=(0.5, 0.44))
        portrait.save(OUT / f"{person_id}.webp", "WEBP", quality=88, method=6)
        written.append(person_id)
    return written


def update_registry(generated_ids: set[str]) -> None:
    with PORTRAITS_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    finalized = ROOT / "public" / "portraits-finalized-v1"
    for row in rows:
        person_id = row["person_id"]
        if person_id in generated_ids:
            row.update({
                "kind": "generated-illustration",
                "local_path": f"/portraits-generated-v1/{person_id}.webp",
                "wikidata_id": "",
                "source_url": "",
                "file_title": f"AI interpretive portrait of {person_id}",
                "author": "OpenAI image generation",
                "license": "Project-generated illustration",
                "license_url": "",
                "review_status": "reviewed-generated",
                "match_method": "period-biography-illustrative-prompt",
                "notes": "AI-generated interpretive head-and-shoulders illustration; not a historical likeness or documentary image.",
            })
        elif (finalized / f"{person_id}.webp").exists():
            row["local_path"] = f"/portraits-finalized-v1/{person_id}.webp"
            row["review_status"] = "reviewed-head-crop"
            row["notes"] = (row.get("notes", "") + " Head-and-shoulders crop visually reviewed for circular display.").strip()

    with PORTRAITS_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_contact_sheet(person_ids: set[str]) -> None:
    ordered = sorted(person_ids)
    columns = 12
    thumb = 112
    rows = (len(ordered) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * thumb, rows * thumb), "#f4f0e8")
    for index, person_id in enumerate(ordered):
        portrait = Image.open(OUT / f"{person_id}.webp").convert("RGB").resize((thumb, thumb), Image.Resampling.LANCZOS)
        sheet.paste(portrait, ((index % columns) * thumb, (index // columns) * thumb))
    artifacts = ROOT / "artifacts"
    artifacts.mkdir(exist_ok=True)
    sheet.save(artifacts / "portrait-generated-contact-sheet.jpg", quality=88, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    generated: set[str] = set()
    for spec in SHEET_SPECS:
        generated.update(crop_sheet(*spec))
    update_registry(generated)
    write_contact_sheet(generated)
    print(f"Installed {len(generated)} generated portraits into {OUT}.")


if __name__ == "__main__":
    main()
