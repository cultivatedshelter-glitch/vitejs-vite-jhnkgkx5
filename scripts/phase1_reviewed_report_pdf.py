#!/usr/bin/env python3
import json
import sys
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, NextPageTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether, HRFlowable

data = json.load(open(sys.argv[1], encoding="utf-8"))
brief = data.get("decisionBrief") or {}
if not brief.get("groups"):
    raise ValueError("Reviewed report decision brief is missing.")

styles = getSampleStyleSheet()
green, forest, ink = colors.HexColor("#174C35"), colors.HexColor("#0F3927"), colors.HexColor("#17251D")
muted, rule, soft = colors.HexColor("#637067"), colors.HexColor("#D7DED9"), colors.HexColor("#F4F7F4")
mint, amber, red_soft = colors.HexColor("#EAF2ED"), colors.HexColor("#F7F1E6"), colors.HexColor("#F8ECE9")
styles.add(ParagraphStyle(name="Brand", parent=styles["Normal"], textColor=green, fontName="Helvetica-Bold", fontSize=9, leading=11, spaceAfter=5))
styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], textColor=ink, fontName="Times-Bold", fontSize=23, leading=26, spaceAfter=5))
styles.add(ParagraphStyle(name="Address", parent=styles["Heading2"], textColor=ink, fontName="Helvetica-Bold", fontSize=12, leading=15, spaceAfter=9))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], textColor=forest, fontName="Helvetica-Bold", fontSize=13, leading=16, spaceBefore=10, spaceAfter=5))
styles.add(ParagraphStyle(name="FindingTitle", parent=styles["Heading3"], textColor=ink, fontName="Helvetica-Bold", fontSize=9.8, leading=11.5, spaceAfter=2))
styles.add(ParagraphStyle(name="Label", parent=styles["Normal"], textColor=muted, fontName="Helvetica-Bold", fontSize=6.2, leading=7, spaceAfter=1))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], textColor=ink, fontSize=7.4, leading=8.8, spaceAfter=2))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], textColor=muted, fontSize=6.2, leading=7.3, spaceAfter=1))
styles.add(ParagraphStyle(name="Price", parent=styles["BodyText"], textColor=green, fontName="Helvetica-Bold", fontSize=10, leading=11.5, spaceAfter=0))
styles.add(ParagraphStyle(name="Next", parent=styles["BodyText"], textColor=forest, fontName="Helvetica-Bold", fontSize=8, leading=9.4, spaceAfter=1))
styles.add(ParagraphStyle(name="RightSmall", parent=styles["Small"], alignment=TA_RIGHT))


def esc(value):
    return str("" if value is None else value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def money(value):
    return "${:,.0f}".format(value) if isinstance(value, (int, float)) else "Not yet sourced"


def date_label(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%B %-d, %Y")
    except (ValueError, TypeError):
        return str(value or "Not stated")


def range_label(path):
    if path.get("status") != "priced":
        return "Not yet sourced"
    suffix = "" if path.get("unit") in (None, "", "project") else " / {}".format(esc(path.get("unit")))
    return "{}-{}{}".format(money(path.get("low")), money(path.get("high")), suffix)


def link_or_text(source):
    label = esc(source.get("name") or source.get("reference") or source.get("id"))
    return '<link href="{}" color="#174C35">{}</link>'.format(esc(source.get("url")), label) if source.get("url") else label


def status_color(status):
    if status == "rejected":
        return red_soft
    if status == "needs_more_information":
        return amber
    return mint


def summary_box(label, value):
    return [Paragraph(esc(value), styles["FindingTitle"]), Paragraph(esc(label), styles["Small"])]


def overview_list(title, rows):
    body = [Paragraph(esc(title), styles["Label"])]
    body.extend(Paragraph("- " + esc(row), styles["Small"]) for row in rows[:6])
    if len(body) == 1:
        body.append(Paragraph("No items returned.", styles["Small"]))
    return body


def compact_finding(finding):
    source = finding.get("inspectionSource") or {}
    source_bits = ["Inspection report"]
    if source.get("page"):
        source_bits.append("Page {}".format(source["page"]))
    if source.get("item"):
        source_bits.append("Item {}".format(source["item"]))
    status = finding.get("status") or "approved"
    tags = " - ".join([finding.get("statusLabel") or "Reviewed"] + (finding.get("priorityLabels") or []))
    content = [
        Table([[Paragraph(esc(tags), styles["Small"]), Paragraph(esc(finding.get("trade")), styles["RightSmall"])]], colWidths=[2.2*inch, 1.3*inch], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), status_color(status)), ("BOX", (0, 0), (-1, -1), 0.5, rule), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)])),
        Spacer(1, 2),
        Paragraph('<a name="brief-{}"/>{}'.format(esc(finding.get("id")), esc(finding.get("title"))), styles["FindingTitle"]),
        Paragraph("WHAT WAS FOUND", styles["Label"]), Paragraph(esc(finding.get("found")), styles["Body"]),
        Paragraph("SHELTER PREP VIEW", styles["Label"]), Paragraph(esc(finding.get("view")), styles["Body"]),
    ]
    if finding.get("paths") and status != "rejected":
        path_rows = []
        for path in finding["paths"]:
            details = "Confidence: {} - Pricing sources: {}".format(path.get("confidence") or "Low", path.get("sourceCount") or 0)
            path_rows.append([[Paragraph(esc(path.get("label")), styles["Body"]), Paragraph(esc(details), styles["Small"])], Paragraph(range_label(path), styles["Price"])])
        content += [Paragraph("LIKELY PATHS", styles["Label"]), Table(path_rows, colWidths=[2.15*inch, 1.35*inch], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -2), 0.35, rule), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 3), ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))]
    unknowns = finding.get("keyUnknowns") or []
    if unknowns:
        content += [Paragraph("KEY UNKNOWN", styles["Label"]), Paragraph(esc(unknowns[0]), styles["Body"])]
    content += [
        Table([[[Paragraph("NEXT STEP", styles["Label"]), Paragraph(esc(finding.get("nextStep")), styles["Next"]), Paragraph("WHY THIS MATTERS", styles["Label"]), Paragraph(esc(finding.get("why")), styles["Small"])]]], colWidths=[3.5*inch], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), soft), ("BOX", (0, 0), (-1, -1), 0.5, rule), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)])),
        Spacer(1, 2),
        Paragraph("{} - Research sources: {} - <link href=\"#appendix-{}\" color=\"#174C35\">Technical details</link>".format(esc(" - ".join(source_bits)), len(finding.get("researchSources") or []), esc(finding.get("id"))), styles["Small"]),
        Spacer(1, 3), HRFlowable(width="100%", thickness=0.6, color=rule), Spacer(1, 3),
    ]
    return KeepTogether(content)


def appendix_finding(finding):
    source = finding.get("inspectionSource") or {}
    technical = finding.get("technicalDetails") or {}
    rows = [
        Paragraph('<a name="appendix-{}"/>{}'.format(esc(finding.get("id")), esc(finding.get("title"))), styles["FindingTitle"]),
        Paragraph("{} - {} - Reviewed event {}".format(esc(finding.get("statusLabel")), esc(finding.get("trade")), esc(finding.get("reviewEventId") or "not returned")), styles["Small"]),
        Paragraph("INSPECTION SOURCE", styles["Label"]),
        Paragraph("Inspection report - Page {} - Item {} - {}".format(esc(source.get("page") or "not stated"), esc(source.get("item") or "not stated"), esc(source.get("section") or "section not stated")), styles["Small"]),
        Paragraph(esc(technical.get("fullSourceText") or finding.get("found")), styles["Body"]),
        Paragraph("REVIEWED INTERPRETATION", styles["Label"]), Paragraph(esc(technical.get("fullInterpretation") or finding.get("view")), styles["Body"]),
    ]
    known, unknowns = technical.get("known") or [], technical.get("unknowns") or []
    if known:
        rows += [Paragraph("FULL KNOWN DETAIL", styles["Label"]), Paragraph("<br/>".join("- " + esc(value) for value in known), styles["Small"])]
    if unknowns:
        rows += [Paragraph("FULL UNKNOWN DETAIL", styles["Label"]), Paragraph("<br/>".join("- " + esc(value) for value in unknowns), styles["Small"])]
    if finding.get("researchSources"):
        rows += [Paragraph("RESEARCH SOURCES", styles["Label"])]
        for source_item in finding["researchSources"]:
            detail = " - ".join(str(value) for value in [source_item.get("geography"), source_item.get("date"), source_item.get("scopeBasis")] if value)
            rows.append(Paragraph("{}{}".format(link_or_text(source_item), " - " + esc(detail) if detail else ""), styles["Small"]))
    for path in finding.get("paths") or []:
        rows += [Paragraph("{} - {} - Confidence: {}".format(esc(path.get("label")), range_label(path), esc(path.get("confidence"))), styles["Body"])]
        for source_item in path.get("sources") or []:
            detail = " - ".join(str(value) for value in [source_item.get("geography"), source_item.get("date"), source_item.get("scopeBasis")] if value)
            rows.append(Paragraph("Pricing source: {}{}".format(link_or_text(source_item), " - " + esc(detail) if detail else ""), styles["Small"]))
        if path.get("assumptions"):
            rows.append(Paragraph("Assumptions: " + esc("; ".join(path["assumptions"])), styles["Small"]))
        if path.get("exclusions"):
            rows.append(Paragraph("Exclusions: " + esc("; ".join(path["exclusions"])), styles["Small"]))
    rows += [Paragraph("NEXT STEP", styles["Label"]), Paragraph(esc(technical.get("fullNextStep") or finding.get("nextStep")), styles["Body"]), Paragraph("Why: " + esc(technical.get("fullWhy") or finding.get("why")), styles["Small"]), Spacer(1, 5), HRFlowable(width="100%", thickness=0.5, color=rule), Spacer(1, 5)]
    return KeepTogether(rows)


story = [Paragraph("SHELTER PREP", styles["Brand"]), Paragraph("Reviewed Property Report", styles["ReportTitle"]), Paragraph(esc(data.get("propertyAddress")), styles["Address"])]
meta = "Version {} - Generated {} - Human Reviewed".format(data.get("reportVersion"), date_label(data.get("generatedAt")))
story += [Paragraph(esc(meta), styles["Small"]), Spacer(1, 7)]
summary = brief.get("summary") or data.get("summary") or {}
summary_table = Table([[summary_box("Findings", summary.get("total", 0)), summary_box("Approved", summary.get("approved", 0)), summary_box("Rejected", summary.get("rejected", 0)), summary_box("Need more information", summary.get("needsInfo", 0))]], colWidths=[1.72*inch]*4)
summary_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), soft), ("BOX", (0, 0), (-1, -1), 0.6, rule), ("INNERGRID", (0, 0), (-1, -1), 0.4, rule), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
story += [summary_table, Spacer(1, 10)]

overview = brief.get("overview") or {}
decision_rows = ["{} - {}".format(item.get("title"), item.get("decision")) for item in overview.get("keyDecisions") or []]
follow_rows = ["{} - {}".format(item.get("title"), item.get("task")) for item in overview.get("immediateFollowUp") or []]
trade_rows = ["{} ({})".format(item.get("trade"), item.get("count")) for item in overview.get("majorTrades") or []]
cost_rows = []
for item in overview.get("largestCostUncertainties") or []:
    amount = "Not yet sourced" if item.get("status") == "blocked" else "{}-{}".format(money(item.get("low")), money(item.get("high")))
    cost_rows.append("{} - {} ({})".format(item.get("title"), item.get("path"), amount))
overview_table = Table([[overview_list("KEY DECISIONS", decision_rows), overview_list("IMMEDIATE FOLLOW-UP", follow_rows)], [overview_list("MAJOR TRADES", trade_rows), overview_list("LARGEST COST UNCERTAINTIES", cost_rows)]], colWidths=[3.44*inch, 3.44*inch])
overview_table.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, rule), ("INNERGRID", (0, 0), (-1, -1), 0.4, rule), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
story += [overview_table, Spacer(1, 9), Paragraph("Report-level notes", styles["Label"]), Paragraph(" ".join(esc(value) for value in brief.get("universalCaveats") or []), styles["Small"]), NextPageTemplate("Brief"), PageBreak()]

for group in brief.get("groups") or []:
    findings = group.get("findings") or []
    heading = [Paragraph(esc(group.get("label")), styles["Section"]), HRFlowable(width="100%", thickness=1.0, color=green), Spacer(1, 5)]
    if findings:
        story.append(KeepTogether(heading + [compact_finding(findings[0])]))
    for finding in findings[1:]:
        story.append(compact_finding(finding))

story += [NextPageTemplate("Appendix"), PageBreak(), Paragraph("Technical Appendix", styles["ReportTitle"]), Paragraph("Complete reviewed evidence, source provenance, pricing detail, assumptions, exclusions, and review references. The primary brief above is a compressed presentation of this same canonical reviewed artifact.", styles["Body"]), Spacer(1, 8)]
for group in brief.get("groups") or []:
    story += [Paragraph(esc(group.get("label")), styles["Section"])]
    for finding in group.get("findings") or []:
        story.append(appendix_finding(finding))

groups = (data.get("localProfessionals") or {}).get("groups") or []
if groups:
    story += [PageBreak(), Paragraph("Local Professionals to Consider", styles["ReportTitle"]), Paragraph("Public business listings are not endorsements. Verify licensing, insurance, availability, fit, and scope directly.", styles["Body"])]
    for group in groups:
        story.append(Paragraph(esc(group.get("trade")), styles["Section"]))
        for professional in group.get("professionals") or []:
            rating = "{} / 5 from {} reviews".format(professional.get("rating"), professional.get("reviewCount")) if professional.get("rating") is not None else "Rating not returned"
            link = '<link href="{}" color="#174C35">View business</link>'.format(esc(professional.get("sourceUrl"))) if professional.get("sourceUrl") else "Stored Google Places reference"
            story.append(Paragraph("<b>{}</b> - {}<br/>{}<br/>{} - Not verified by Shelter Prep".format(esc(professional.get("name")), esc(rating), esc(professional.get("address")), link), styles["Body"]))

story += [Spacer(1, 12), Paragraph(esc(data.get("notice")), styles["Small"])]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(rule)
    canvas.line(0.55*inch, 0.45*inch, 7.95*inch, 0.45*inch)
    canvas.setFont("Helvetica", 6.8)
    canvas.setFillColor(muted)
    canvas.drawString(0.55*inch, 0.28*inch, "Shelter Prep - Reviewed Property Report")
    canvas.drawRightString(7.95*inch, 0.28*inch, "Page {}".format(doc.page))
    canvas.restoreState()


document = BaseDocTemplate(sys.argv[2], pagesize=letter, rightMargin=0.55*inch, leftMargin=0.55*inch, topMargin=0.5*inch, bottomMargin=0.58*inch, title="Shelter Prep Reviewed Property Report", author="Shelter Prep")
full_frame = Frame(document.leftMargin, document.bottomMargin, document.width, document.height, id="full")
gutter = 0.2*inch
column_width = (document.width - gutter) / 2
left_frame = Frame(document.leftMargin, document.bottomMargin, column_width, document.height, rightPadding=3, id="brief-left")
right_frame = Frame(document.leftMargin + column_width + gutter, document.bottomMargin, column_width, document.height, leftPadding=3, id="brief-right")
document.addPageTemplates([
    PageTemplate(id="Cover", frames=[full_frame], onPage=footer),
    PageTemplate(id="Brief", frames=[left_frame, right_frame], onPage=footer),
    PageTemplate(id="Appendix", frames=[full_frame], onPage=footer),
])
document.build(story)
