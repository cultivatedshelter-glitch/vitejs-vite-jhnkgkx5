#!/usr/bin/env python3
import json, sys
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether

data = json.load(open(sys.argv[1], encoding='utf-8'))
artifact = data.get('artifact') or {}
states = artifact.get('reviewState') or {}
observations = artifact.get('atomicObservations') or []
styles = getSampleStyleSheet()
green, ink, muted, rule = colors.HexColor('#174c35'), colors.HexColor('#17251d'), colors.HexColor('#5f6d64'), colors.HexColor('#d9ded9')
styles.add(ParagraphStyle(name='Brand', parent=styles['Normal'], textColor=green, fontName='Helvetica-Bold', fontSize=9, leading=12, spaceAfter=18))
styles.add(ParagraphStyle(name='Title2', parent=styles['Title'], textColor=ink, fontName='Times-Roman', fontSize=25, leading=29, spaceAfter=8))
styles.add(ParagraphStyle(name='H2x', parent=styles['Heading2'], textColor=ink, fontName='Times-Bold', fontSize=15, leading=19, spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle(name='H3x', parent=styles['Heading3'], textColor=green, fontName='Helvetica-Bold', fontSize=9, leading=12, spaceBefore=8, spaceAfter=3))
styles.add(ParagraphStyle(name='Bodyx', parent=styles['BodyText'], textColor=ink, fontSize=9, leading=13, spaceAfter=5))
styles.add(ParagraphStyle(name='Smallx', parent=styles['BodyText'], textColor=muted, fontSize=7.5, leading=10, spaceAfter=4))

def esc(v):
    return str(v or '').replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
def text_list(values):
    return '<br/>'.join('• ' + esc(v) for v in (values or [])) or 'Not established.'
def money(v):
    return '${:,.0f}'.format(v) if isinstance(v, (int,float)) else 'Not sourced'
def corrected(item):
    event = (states.get(item.get('id')) or {}).get('event') or {}
    corr = ((event.get('new_value') or {}).get('corrections') or {})
    card = item.get('finding_card') or {}; epi = item.get('epistemic_states') or {}; source = item.get('source') or {}
    return event, corr, card, epi, source

story = [Paragraph('SHELTER PREP', styles['Brand']), Paragraph('Reviewed Property Report', styles['Title2']), Paragraph(esc(data.get('propertyAddress')), styles['H2x'])]
meta = [['Report', 'Version {}'.format(data.get('reportVersion'))], ['Status', 'Human Reviewed'], ['Generated', esc(data.get('generatedAt'))], ['Findings', str((data.get('summary') or {}).get('total', len(observations)))]]
t = Table(meta, colWidths=[1.15*inch, 5.7*inch]); t.setStyle(TableStyle([('TEXTCOLOR',(0,0),(0,-1),muted),('TEXTCOLOR',(1,0),(1,-1),ink),('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,-1),(-1,-1),.5,rule)])); story += [t, Spacer(1,12)]
summary = data.get('summary') or {}
story += [Paragraph('Whole-report overview', styles['H2x']), Paragraph('{} approved · {} needs more information · {} rejected'.format(summary.get('approved',0), summary.get('needsInfo',0), summary.get('rejected',0)), styles['Bodyx']), Paragraph('Ranges shown below are scope-specific context. Do not add incompatible or mutually exclusive ranges into a project total.', styles['Smallx'])]

for index, item in enumerate(observations, 1):
    event, corr, card, epi, source = corrected(item)
    action = event.get('review_action')
    title = corr.get('title') or card.get('finding_title') or source.get('inspector_statement') or 'Inspection finding'
    src = card.get('source_refs') or {}
    disposition = 'Needs more information — unresolved' if action == 'needs_more_info' else 'Rejected during review' if action == 'reject' else 'Approved / corrected'
    story += [KeepTogether([Paragraph('{} · {}'.format(index, esc(title)), styles['H2x']), Paragraph('Review disposition: {}'.format(disposition), styles['Smallx'])])]
    story += [Paragraph('WHAT WAS REPORTED', styles['H3x']), Paragraph(esc(epi.get('source_observation') or source.get('inspector_statement') or title), styles['Bodyx'])]
    story += [Paragraph('SOURCE', styles['H3x']), Paragraph('Inspection report · Page {} · Item {} · {}'.format(esc(src.get('source_page') or source.get('source_page') or 'not specified'), esc(src.get('source_item_number') or source.get('source_item_number') or 'not specified'), esc(src.get('source_section') or source.get('source_section') or 'section not specified')), styles['Bodyx'])]
    story += [Paragraph('SHELTER PREP INTERPRETATION', styles['H3x']), Paragraph(esc(corr.get('interpretation') or epi.get('shelter_prep_interpretation') or 'No reviewed interpretation.'), styles['Bodyx'])]
    story += [Paragraph('KNOWN', styles['H3x']), Paragraph(text_list(corr.get('known') or card.get('what_we_know')), styles['Bodyx']), Paragraph('UNKNOWN', styles['H3x']), Paragraph(text_list(corr.get('unknown') or card.get('what_we_dont_know')), styles['Bodyx'])]
    paths = card.get('repair_paths') or []
    if paths and action == 'approve':
        story.append(Paragraph('LIKELY PATHS AND COST CONTEXT', styles['H3x']))
        adjustments = {p.get('path_id'): p for p in (corr.get('price_adjustments') or []) if p}
        if corr.get('price'): adjustments[corr['price'].get('path_id')] = corr['price']
        catalog = {(s.get('id') or s.get('source_id')): s for s in (artifact.get('external_sources') or []) if (s.get('id') or s.get('source_id'))}
        for path in paths:
            adj = adjustments.get(path.get('id')) or {}; low = adj.get('low', path.get('price_low')); high = adj.get('high', path.get('price_high'))
            source_ids = adj.get('supporting_source_ids') or path.get('price_source_refs') or []
            source_lines = []
            for source_id in source_ids:
                source_item = catalog.get(source_id) or {}
                label = source_item.get('source_name') or source_item.get('provider') or source_item.get('title') or source_id
                geography = (source_item.get('source_geography') or {}).get('label') or source_item.get('geography') or 'geography not stated'
                date = source_item.get('published_at') or source_item.get('retrieved_at') or source_item.get('retrieval_time')
                url = source_item.get('source_url') or source_item.get('source_reference') or ''
                linked_label = '<link href="{}" color="#174c35">{}</link>'.format(esc(url), esc(label)) if str(url).startswith('http') else esc(label)
                source_lines.append('{} — {}{}'.format(linked_label, esc(geography), ' · {}'.format(esc(date)) if date else ''))
            source_text = '<br/>'.join(source_lines) or 'No defensible sourced range attached'
            story += [Paragraph('<b>{}</b><br/>{}–{} · {}<br/><font color="#5f6d64">Pricing sources:<br/>{}<br/>Scope geography: {}<br/>Assumptions: {}<br/>Exclusions: {}</font>'.format(esc(path.get('label') or 'Potential repair path'), money(low), money(high), esc(adj.get('confidence_status') or path.get('range_status') or 'preliminary'), source_text, esc(adj.get('geography') or (path.get('price_geography') or {}).get('label') or 'Not established'), esc('; '.join(adj.get('assumptions') or path.get('assumptions') or []) or 'None stated'), esc('; '.join(adj.get('exclusions') or path.get('major_exclusions') or []) or 'None stated')), styles['Bodyx'])]
    story += [Paragraph('NEXT TASK', styles['H3x']), Paragraph(esc(corr.get('next_step') or card.get('recommended_next_step') or 'Human follow-up required.'), styles['Bodyx']), Paragraph('WHY', styles['H3x']), Paragraph(esc(corr.get('rationale') or card.get('why_next_step') or 'No reviewed rationale.'), styles['Bodyx'])]

groups = (data.get('localProfessionals') or {}).get('groups') or []
if groups:
    story += [PageBreak(), Paragraph('Local professionals to consider', styles['Title2']), Paragraph('These sourced listings are not endorsements. Verify licensing, insurance, availability, fit, and scope directly.', styles['Bodyx'])]
    for group in groups:
        story.append(Paragraph(esc(group.get('trade')), styles['H2x']))
        for pro in group.get('professionals') or []:
            rating = '{} / 5 from {} reviews'.format(pro.get('rating'), pro.get('reviewCount')) if pro.get('rating') is not None else 'Rating not returned'
            business_link = ' · <link href="{}" color="#174c35">View Business</link>'.format(esc(pro.get('sourceUrl'))) if pro.get('sourceUrl') else ''
            story.append(Paragraph('<b>{}</b><br/>{}<br/>{}<br/><font color="#5f6d64">Source: Google Places{} · Retrieved {} · Qualification not verified by Shelter Prep</font>'.format(esc(pro.get('name')), esc(pro.get('address')), esc(rating), business_link, esc(pro.get('retrievedAt'))), styles['Bodyx']))

story += [Spacer(1,18), Paragraph(esc(data.get('notice')), styles['Smallx'])]
def footer(canvas, doc):
    canvas.saveState(); canvas.setFillColor(colors.white); canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0); canvas.setStrokeColor(rule); canvas.line(.65*inch,.48*inch,7.85*inch,.48*inch); canvas.setFont('Helvetica',7); canvas.setFillColor(muted); canvas.drawString(.65*inch,.30*inch,'Shelter Prep · Human Reviewed'); canvas.drawRightString(7.85*inch,.30*inch,'Page {}'.format(doc.page)); canvas.restoreState()
doc = SimpleDocTemplate(sys.argv[2], pagesize=letter, rightMargin=.65*inch, leftMargin=.65*inch, topMargin=.62*inch, bottomMargin=.62*inch, title='Shelter Prep Reviewed Property Report', author='Shelter Prep')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
