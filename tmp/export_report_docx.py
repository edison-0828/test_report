from pathlib import Path
import json
import sys
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


COLOR_RED = RGBColor(204, 61, 61)
COLOR_ORANGE = RGBColor(199, 130, 16)
COLOR_GREEN = RGBColor(22, 121, 74)
COLOR_GRAY = RGBColor(95, 107, 122)

FILL_RED = "FFF0F0"
FILL_ORANGE = "FFF5E8"
FILL_GREEN = "EAF8EF"
FILL_GRAY = "F2F5F9"
FILL_HEADER = "EAF0F8"
FILL_LABEL = "F3F6FB"
FILL_ROW_RISK = "FFF7F7"
FILL_ROW_WARN = "FFF9F0"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_run_font(run, size, bold=False, color=None):
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = "Microsoft YaHei"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    if color:
        run.font.color.rgb = color


def get_status_style(value):
    text = str(value or "").strip()
    if text in ["有风险", "失败", "新建", "严重", "P0"]:
        return COLOR_RED, FILL_RED
    if text in ["需关注", "阻塞", "已提交", "中", "P1"]:
        return COLOR_ORANGE, FILL_ORANGE
    if text in ["可发布", "通过", "已修复", "已验证", "已关闭", "低", "P2"]:
        return COLOR_GREEN, FILL_GREEN
    return COLOR_GRAY, FILL_GRAY


def set_cell_text(cell, text, bold=False, size=10.5, color=None, fill=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(str(text))
    set_run_font(run, size, bold=bold, color=color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    if fill:
        set_cell_shading(cell, fill)


def add_heading(doc, text, size=14):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    set_run_font(run, size, bold=True)


def add_kv_table(doc, rows):
    table = doc.add_table(rows=0, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    for row in rows:
        key = row[0]
        value = row[1]
        highlight = bool(row[2]) if len(row) > 2 else False
        cells = table.add_row().cells
        set_cell_text(cells[0], key, bold=True, fill=FILL_LABEL)
        if highlight:
            color, fill = get_status_style(value)
            set_cell_text(cells[1], value, color=color, fill=fill)
        else:
            set_cell_text(cells[1], value)
    return table


def add_matrix_table(doc, headers, rows, status_columns=None, row_fill_fn=None):
    status_columns = status_columns or set()
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for idx, header in enumerate(headers):
        set_cell_text(table.rows[0].cells[idx], header, bold=True, size=10, fill=FILL_HEADER)
    for row in rows:
        cells = table.add_row().cells
        row_fill = row_fill_fn(row) if row_fill_fn else None
        for idx, value in enumerate(row):
            if idx in status_columns:
                color, fill = get_status_style(value)
                set_cell_text(cells[idx], value, size=10, color=color, fill=fill)
            else:
                set_cell_text(cells[idx], value, size=10, fill=row_fill)
    return table


def failed_case_row_fill(_row):
    return FILL_ROW_RISK


def bug_row_fill(row):
    status = str(row[2] or "").strip()
    severity = str(row[3] or "").strip()
    if severity == "严重" or status == "新建":
        return FILL_ROW_RISK
    if status == "已提交" or severity == "中":
        return FILL_ROW_WARN
    return None


def main():
    payload_path = Path(sys.argv[1])
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    report = payload["report"]
    conclusion = payload.get("reportConclusion") or "暂无补充结论。"
    output_path = Path(payload["outputPath"])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    release_label = report.get("releaseDecision", {}).get("label", "")
    release_desc = report.get("releaseDecision", {}).get("desc", "")

    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2)
    section.right_margin = Cm(2)

    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    style.font.size = Pt(10.5)

    title = doc.add_paragraph()
    title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
    title_run = title.add_run("测试报告")
    set_run_font(title_run, 20, bold=True)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
    subtitle_run = subtitle.add_run(report.get("heroTitle") or "当前测试范围")
    set_run_font(subtitle_run, 12, color=COLOR_GRAY)

    doc.add_paragraph("")

    sections = [
        (
            "文档信息",
            [
                ["报告名称", "测试报告"],
                ["版本号", report.get("batchVersion", "")],
                ["测试任务", report.get("taskName", "")],
                ["测试负责人", "、".join(report.get("testOwners", [])) or "未分配"],
                ["生成时间", report.get("generatedAt", "")],
                ["报告范围", report.get("scopeLabel", "")],
                ["当前结论", release_label, True],
            ],
        ),
        ("测试范围摘要", [[item[0], item[1]] for item in report.get("scopeSummaryItems", [])]),
        (
            "用例执行统计",
            [
                ["测试用例总数", report.get("total", 0)],
                ["执行用例数", report.get("executed", 0)],
                ["成功用例数", report.get("passed", 0), True],
                ["失败用例数", report.get("statusCounts", {}).get("失败", 0), True],
                ["阻塞用例数", report.get("statusCounts", {}).get("阻塞", 0), True],
                ["未执行用例数", report.get("statusCounts", {}).get("未执行", 0)],
                ["通过率", report.get("passRate", "0%"), True],
            ],
        ),
        (
            "缺陷统计",
            [
                ["BUG总数", len(report.get("scope", {}).get("bugs", []))],
                ["待跟进BUG", report.get("openBugs", 0), True],
                ["失败用例对应BUG数", report.get("failedCaseBugCount", 0), True],
                ["新建", report.get("bugStatusCounts", {}).get("新建", 0), True],
                ["已提交", report.get("bugStatusCounts", {}).get("已提交", 0), True],
                ["已修复", report.get("bugStatusCounts", {}).get("已修复", 0), True],
                ["待回归", report.get("bugStatusCounts", {}).get("待回归", 0), True],
                ["已验证", report.get("bugStatusCounts", {}).get("已验证", 0), True],
                ["已关闭", report.get("bugStatusCounts", {}).get("已关闭", 0), True],
                ["严重", report.get("bugSeverityCounts", {}).get("严重", 0), True],
                ["中", report.get("bugSeverityCounts", {}).get("中", 0), True],
                ["低", report.get("bugSeverityCounts", {}).get("低", 0), True],
            ],
        ),
        (
            "风险与结论",
            [
                ["发布建议", release_label, True],
                ["结论说明", release_desc],
                ["补充结论", conclusion],
            ],
        ),
        (
            "阻塞原因汇总",
            [
                ["阻塞说明", report.get("blockedSummary", "当前没有阻塞用例。")],
            ],
        ),
        (
            "测试结论与建议",
            [
                [item[0], item[1], item[0] == "当前判断"]
                for item in report.get("conclusionAdviceItems", [])
            ],
        ),
    ]

    for heading, rows in sections:
        add_heading(doc, heading, size=14)
        add_kv_table(doc, rows)
        doc.add_paragraph("")

    add_heading(doc, "重点关注", size=14)
    add_heading(doc, "失败的用例", size=12)
    failed_rows = [
        [
            idx,
            item.get("title") or "",
            item.get("taskName") or "未分任务",
            item.get("batchVersion") or report.get("batchVersion", ""),
            item.get("module") or "未标记",
            "失败",
            len([bug for bug in report.get("unresolvedBugs", []) if bug.get("caseId") == item.get("id")]),
        ]
        for idx, item in enumerate(report.get("failedCases", []), 1)
    ]
    if not failed_rows:
        failed_rows = [["-", "当前没有失败用例", "", "", "", "", ""]]
    add_matrix_table(
        doc,
        ["序号", "用例标题", "任务", "版本", "业务", "状态", "关联BUG数"],
        failed_rows,
        status_columns={5},
        row_fill_fn=failed_case_row_fill if report.get("failedCases") else None,
    )

    doc.add_paragraph("")
    add_heading(doc, "未修复的BUG", size=12)
    bug_rows = [
        [
            idx,
            item.get("title") or "",
            item.get("status") or "",
            item.get("severity") or "",
            item.get("taskName") or "未分任务",
            item.get("owner") or "未填写",
            item.get("link") or "未填写",
            item.get("note") or "暂无补充说明",
            "来源于失败用例" if item.get("caseId") and any(case.get("id") == item.get("caseId") for case in report.get("failedCases", [])) else "",
        ]
        for idx, item in enumerate(report.get("unresolvedBugs", []), 1)
    ]
    if not bug_rows:
        bug_rows = [["-", "当前没有未修复BUG", "", "", "", "", "", "", ""]]
    add_matrix_table(
        doc,
        ["序号", "BUG标题", "状态", "严重级别", "任务", "负责人", "Lark链接", "详情", "来源标识"],
        bug_rows,
        status_columns={2, 3},
        row_fill_fn=bug_row_fill if report.get("unresolvedBugs") else None,
    )

    doc.save(output_path)
    print(str(output_path))


if __name__ == "__main__":
    main()
