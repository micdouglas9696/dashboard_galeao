# -*- coding: utf-8 -*-
"""
SESCINC SBGL Dashboard — Complete Seed Data Generator
Parses ALL Excel spreadsheets (Janeiro-Agosto) and generates updated seed-data.js
with proper 'mes' field on ALL records to avoid duplication.
"""
import openpyxl
import datetime
import json
import re
import os
import unicodedata

# ────────── Helpers ──────────

def normalize_funcao(fun):
    if not fun:
        return 'BA'
    fun = str(fun).strip().upper()
    # Remove non-breaking spaces
    fun = fun.replace('\xa0', ' ').strip()
    
    if fun in ['BA', 'B.A.', 'ba', 'B.A']:
        return 'BA'
    if fun in ['BA2', 'BA 2', 'BA-2', 'BA-02', 'B.A II']:
        return 'BA2'
    if fun in ['BA-MC', 'BAMC', 'BA MC', 'BA- MC']:
        return 'BA-MC'
    if fun in ['BA-LR', 'BA LR']:
        return 'BA-LR'
    if fun in ['BA-RE', 'BA RE']:
        return 'BA-RE'
    if fun in ['BA-CE', 'BA CE']:
        return 'BA-CE'
    if fun in ['BA-MA', 'BA MA']:
        return 'BA-MA'
    if fun in ['OC']:
        return 'OC'
    
    if re.search(r'BA.*MC', fun): return 'BA-MC'
    if re.search(r'BA.*LR', fun): return 'BA-LR'
    if re.search(r'BA.*RE', fun): return 'BA-RE'
    if re.search(r'BA.*CE', fun): return 'BA-CE'
    if re.search(r'BA.*MA', fun): return 'BA-MA'
    if '2' in fun or 'II' in fun: return 'BA2'
    return 'BA'


def normalize_name(name):
    if not name:
        return ''
    name = str(name).strip().upper()
    name = name.replace('\xa0', ' ')
    name = re.sub(r'\s+', ' ', name)
    name = re.sub(r'\.$', '', name)
    name = ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
    return name


def clean_numeric(val):
    """Clean numeric values that might have non-breaking spaces."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val) if isinstance(val, float) and val == int(val) else val
    s = str(val).replace('\xa0', '').strip()
    if not s or s.upper() == 'NR':
        return None
    try:
        return int(float(s))
    except:
        return None


def clean_corrida(val):
    """Clean and normalize corrida (run time) field."""
    if val is None:
        return '', None
    
    s = str(val).replace('\xa0', '').strip()
    if not s:
        return '', None
    if s.upper() in ['NR', 'FERIAS', 'FÉRIAS']:
        return s.upper(), None
    
    # Handle special quote characters
    s = s.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
    s = s.replace('\u2032', "'").replace('\u2033', '"')
    
    # Format: distance like "2.450m" or "2.460m" or "2,450m"
    m_dist = re.match(r'^(\d+)[.,](\d+)\s*m$', s, re.IGNORECASE)
    if m_dist:
        # This is a distance in meters, keep as-is (no seconds conversion)
        return s, None
    
    # Format: mm'ss" or mm'ss'' (various quote styles)
    m = re.match(r"(\d+)['\u2019](\d+)[\"'\u2019\u201d]*\s*$", s)
    if m:
        mins = int(m.group(1))
        secs = int(m.group(2))
        return f"{mins}'{secs:02d}\"", mins * 60 + secs
    
    # Format: HH:MM:SS (e.g., 00:11:49)
    parts = s.split(':')
    if len(parts) == 3:
        try:
            h, mi, sec = int(parts[0]), int(parts[1]), int(parts[2])
            total = h * 3600 + mi * 60 + sec
            actual_mins = mi if h == 0 else h * 60 + mi
            return f"{actual_mins}'{sec:02d}\"", total
        except:
            pass
    elif len(parts) == 2:
        try:
            mi, sec = int(parts[0]), int(parts[1])
            return f"{mi}'{sec:02d}\"", mi * 60 + sec
        except:
            pass
    
    return s, None


MONTH_MAP = {
    'JANEIRO': 'Janeiro', 'FEVEREIRO': 'Fevereiro', 'MARÇO': 'Março',
    'MARCO': 'Março', 'ABRIL': 'Abril', 'MAIO': 'Maio', 'JUNHO': 'Junho',
    'JULHO': 'Julho', 'AGOSTO': 'Agosto', 'SETEMBRO': 'Setembro',
    'OUTUBRO': 'Outubro', 'NOVEMBRO': 'Novembro', 'DEZEMBRO': 'Dezembro'
}

MONTH_INDEX = {
    'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
    'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
}


def detect_month_from_filename(filename):
    """Extract month name from filename."""
    # macOS returns filenames in NFD; normalize to NFC for comparison
    fname_upper = unicodedata.normalize('NFC', filename).upper()
    for key, val in MONTH_MAP.items():
        if key in fname_upper:
            return val
    return None


def detect_month_from_sheet(sheet_name):
    """Extract month name from sheet name."""
    sn_upper = unicodedata.normalize('NFC', sheet_name).strip().upper()
    for key, val in MONTH_MAP.items():
        if key == sn_upper or key in sn_upper:
            return val
    return None


# ────────── TAF Parser ──────────

def parse_taf_file(filepath, month_name):
    """Parse a single TAF XLSX file and return records with 'mes' field."""
    print(f'  Parsing TAF: {os.path.basename(filepath)} -> {month_name}')
    wb = openpyxl.load_workbook(filepath, data_only=True)
    records = []
    
    # Try to find the right sheet
    ws = None
    for sn in wb.sheetnames:
        if 'gráfico' in sn.lower() or 'grafico' in sn.lower():
            continue
        ws = wb[sn]
        break
    
    if ws is None:
        wb.close()
        return records

    # Auto-detect column headers from Row 5
    headers = [str(ws.cell(row=5, column=c).value or '').strip() for c in range(1, ws.max_column + 1)]
    col_map = {}
    for idx, h in enumerate(headers):
        hu = h.upper()
        if 'NOME' in hu and 'col_nome' not in col_map: col_map['col_nome'] = idx
        elif 'EQUIPE' in hu and 'col_equipe' not in col_map: col_map['col_equipe'] = idx
        elif 'FUN' in hu and 'col_funcao' not in col_map: col_map['col_funcao'] = idx
        elif 'IDADE' in hu and 'col_idade' not in col_map: col_map['col_idade'] = idx
        elif 'FLEX' in hu and 'col_flexao' not in col_map: col_map['col_flexao'] = idx
        elif 'ABDOM' in hu and 'col_abdominal' not in col_map: col_map['col_abdominal'] = idx
        elif 'BARRA' in hu: col_map['col_barra'] = idx
        elif 'POLICHINELO' in hu and 'col_barra' not in col_map: col_map['col_barra'] = idx
        elif 'CORRIDA' in hu: col_map['col_corrida'] = idx
        elif 'TEMPO' in hu and 'col_corrida' not in col_map: col_map['col_corrida'] = idx
        elif 'RESULT' in hu and 'col_resultado' not in col_map: col_map['col_resultado'] = idx

    if 'col_barra' not in col_map:
        for idx, h in enumerate(headers):
            if 'POLICHINELO' in h.upper():
                col_map['col_barra'] = idx
                break

    c_nome = col_map.get('col_nome', 0)
    c_eq = col_map.get('col_equipe', 1)
    c_fun = col_map.get('col_funcao', 2)
    c_idade = col_map.get('col_idade', 3)
    c_flex = col_map.get('col_flexao', 4)
    c_abd = col_map.get('col_abdominal', 5)
    c_bar = col_map.get('col_barra', 6)
    c_corr = col_map.get('col_corrida', 7)
    c_res = col_map.get('col_resultado', 8)

    for row in ws.iter_rows(min_row=6, max_row=ws.max_row, values_only=True):
        if not row or len(row) <= c_nome or not row[c_nome]:
            continue
        nome_str = str(row[c_nome]).strip()
        if not nome_str:
            continue

        # Skip summary/total rows
        nome_upper = nome_str.upper()
        if any(kw in nome_upper for kw in ['TOTAL', 'CONTAGEM', 'SATISFAT', 'INSATISF']):
            continue
        
        equipe = str(row[c_eq]).strip().upper() if len(row) > c_eq and row[c_eq] else ''
        if not equipe or equipe == 'NONE':
            continue

        funcao = normalize_funcao(row[c_fun] if len(row) > c_fun else None)
        idade = clean_numeric(row[c_idade] if len(row) > c_idade else None)
        
        row_txt = ' '.join(str(c) for c in row if c is not None).upper()
        resultado_raw = str(row[c_res]).strip() if len(row) > c_res and row[c_res] else ''

        is_ferias = 'FERIAS' in row_txt or 'FÉRIAS' in row_txt
        is_permuta = 'PERMUTA' in row_txt
        is_not_realizado = any(marker in row_txt for marker in ['NÃO REALIZADO', 'NAO REALIZADO', 'NÃO REALIZADIO', 'NAO REALIZADIO'])
        has_folga = 'FOLGA' in row_txt
        has_atestado = 'ATESTADO' in row_txt

        res_upper = resultado_raw.upper()
        is_explicit_approved = any(k in res_upper for k in ['ACOP A', 'ACOP - A', 'ACOP-A', 'SATISFATÓRIO', 'SATISFATORIO', 'APTO'])
        is_explicit_b = any(k in res_upper for k in ['ACOP B', 'ACOP - B', 'ACOP-B', 'BOM'])

        motivo = (
            'Férias' if is_ferias else
            'Permuta' if is_permuta else
            'Folga' if has_folga else
            'Atestado' if has_atestado else
            'Não Realizado' if is_not_realizado else ''
        )
        
        if is_ferias:
            status = 'ferias'
            flexao = None
            abdominal = None
            barra = None
            corrida = 'FÉRIAS'
            corrida_seconds = None
            resultado = 'Férias'
        elif (is_permuta or is_not_realizado or has_folga or has_atestado) and not (is_explicit_approved or is_explicit_b):
            status = 'nr'
            flexao = None
            abdominal = None
            barra = None
            corrida = 'Não Realizado'
            corrida_seconds = None
            resultado = 'Não Realizado'
        else:
            flexao = clean_numeric(row[c_flex] if len(row) > c_flex else None)
            abdominal = clean_numeric(row[c_abd] if len(row) > c_abd else None)
            barra = clean_numeric(row[c_bar] if len(row) > c_bar else None)
            
            corrida_raw = row[c_corr] if len(row) > c_corr else None
            corrida, corrida_seconds = clean_corrida(corrida_raw)
            
            status = 'ok'
            if str(corrida).upper() == 'NR' or (flexao is None and abdominal is None and barra is None and not corrida):
                status = 'nr'
                resultado = 'Não Realizado'
                motivo = motivo or 'Não Realizado'
            elif resultado_raw:
                if 'permuta' in resultado_raw.lower() or resultado_raw.upper() == 'NR':
                    resultado = 'Não Realizado'
                    status = 'nr'
                    motivo = 'Permuta' if 'permuta' in resultado_raw.lower() else (motivo or 'Não Realizado')
                elif any(marker in resultado_raw.upper() for marker in ['NÃO REALIZADO', 'NAO REALIZADO', 'NÃO REALIZADIO', 'NAO REALIZADIO']):
                    resultado = 'Não Realizado'
                    status = 'nr'
                    motivo = motivo or 'Não Realizado'
                elif 'insatisf' in resultado_raw.lower() or 'inapto' in resultado_raw.lower() or resultado_raw.strip().upper() in ['B', 'BOM', 'ACOP - B', 'ACOP B', 'ACOP-B']:
                    resultado = 'ACOP - B'
                elif 'evolu' in resultado_raw.lower():
                    resultado = 'Em evolução'
                else:
                    resultado = 'ACOP - A'
            elif corrida_seconds is not None and corrida_seconds > 240:
                # Fallback apenas quando a planilha não informa o Resultado.
                resultado = 'Em evolução'
            else:
                resultado = 'ACOP - A'
        
        records.append({
            'nome': nome_str,
            'equipe': equipe,
            'funcao': funcao,
            'idade': idade,
            'flexao': flexao,
            'abdominal': abdominal,
            'barra': barra,
            'corrida': corrida,
            'corridaSeconds': corrida_seconds,
            'resultado': resultado,
            'status': status,
            'motivo': motivo or None,
            'mes': month_name
        })
    
    wb.close()
    return records


# ────────── TP-EPR Parser ──────────

def parse_tpepr_file(filepath, month_name):
    """Parse a single TP-EPR XLSX file and return records with 'mes' field."""
    print(f'  Parsing TP-EPR: {os.path.basename(filepath)} -> {month_name}')
    wb = openpyxl.load_workbook(filepath, data_only=True)
    records = []
    
    # Try to find the right sheet
    ws = None
    for sn in wb.sheetnames:
        if 'gráfico' in sn.lower() or 'grafico' in sn.lower():
            continue
        ws = wb[sn]
        break
    
    if ws is None:
        wb.close()
        return records
    
    # Auto-detect column offset by checking header row (row 5)
    header_row = [ws.cell(row=5, column=c).value for c in range(1, 8)]
    
    offset = 0
    if header_row[0] is None and header_row[1] and 'NOME' in str(header_row[1]).upper():
        offset = 1
    elif header_row[0] and 'NOME' in str(header_row[0]).upper():
        offset = 0
    else:
        first_data = ws.cell(row=6, column=1).value
        if first_data is None:
            offset = 1
    
    print(f'    Column offset: {offset} ({"6-col" if offset else "5-col"} layout)')
    
    col_nome = offset
    col_equipe = offset + 1
    col_funcao = offset + 2
    col_tempo = offset + 3
    col_resultado = offset + 4
    
    for row in ws.iter_rows(min_row=6, max_row=ws.max_row, values_only=True):
        row = list(row) + [None] * max(0, col_resultado + 1 - len(row))
        
        nome = row[col_nome]
        if not nome or str(nome).strip() == '':
            continue
        nome_str = str(nome).strip()
        
        # Skip summary rows
        nome_upper = nome_str.upper()
        if any(kw in nome_upper for kw in ['TOTAL', 'CONTAGEM', 'EXCELENTE', 'BOM', 'INSATISF']):
            continue
        
        equipe = str(row[col_equipe]).strip().upper() if row[col_equipe] else ''
        if not equipe or equipe == 'NONE':
            continue
            
        funcao = normalize_funcao(row[col_funcao])
        tempo_raw = row[col_tempo] if len(row) > col_tempo else None
        resultado_raw = str(row[col_resultado]).strip() if len(row) > col_resultado and row[col_resultado] else ''

        row_txt = ' '.join(str(c) for c in row if c is not None).upper()
        is_permuta = 'PERMUTA' in row_txt
        is_ferias = 'FERIAS' in row_txt or 'FÉRIAS' in row_txt
        is_not_realizado = any(marker in row_txt for marker in [
            'NÃO REALIZADO', 'NAO REALIZADO', 'NÃO REALIZADIO',
            'NAO REALIZADIO', 'FOLGA', 'ATESTADO'
        ])
        motivo = (
            'Permuta' if is_permuta else
            'Folga' if 'FOLGA' in row_txt else
            'Atestado' if 'ATESTADO' in row_txt else
            'Não Realizado' if is_not_realizado else
            'Férias' if is_ferias else ''
        )
        
        tempo_seconds = None
        tempo_formatted = ''
        
        if is_permuta or (is_not_realizado and not is_ferias):
            status = 'nr'
            resultado = 'Não Realizado'
            tempo_formatted = 'Não Realizado'
            tempo_seconds = None
        else:
            if tempo_raw:
                tempo_str = str(tempo_raw).strip().upper().replace('\xa0', '')

                if 'FERIAS' in tempo_str or 'FÉRIAS' in tempo_str:
                    tempo_formatted = 'FÉRIAS'
                    tempo_seconds = None
                    is_ferias = True
                elif isinstance(tempo_raw, datetime.time):
                    tempo_seconds = tempo_raw.hour * 3600 + tempo_raw.minute * 60 + tempo_raw.second
                    tempo_formatted = f"{tempo_raw.minute:02d}:{tempo_raw.second:02d}"
                elif isinstance(tempo_raw, (int, float)):
                    total_sec = int(round(tempo_raw * 86400))
                    tempo_seconds = total_sec
                    minutos = total_sec // 60
                    segundos = total_sec % 60
                    tempo_formatted = f"{minutos:02d}:{segundos:02d}"
                else:
                    parts = tempo_str.split(':')
                    if len(parts) == 3:
                        try:
                            tempo_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                            tempo_formatted = f"{int(parts[1]):02d}:{int(parts[2]):02d}"
                        except:
                            tempo_formatted = str(tempo_raw).strip()
                    elif len(parts) == 2:
                        try:
                            tempo_seconds = int(parts[0]) * 60 + int(parts[1])
                            tempo_formatted = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
                        except:
                            tempo_formatted = str(tempo_raw).strip()
                    else:
                        tempo_formatted = str(tempo_raw).strip()

            if is_ferias or 'feria' in resultado_raw.lower():
                status = 'ferias'
                resultado = 'Férias'
            elif tempo_formatted == 'NR' or resultado_raw.upper() == 'NR' or is_not_realizado:
                status = 'nr'
                resultado = 'Não Realizado'
                motivo = motivo or 'Não Realizado'
            else:
                status = 'ok'
                # TP-EPR: ≤60s ACOP - A, 61-90s ACOP - B, >90s Em evolução
                if not resultado_raw or resultado_raw == 'None':
                    if tempo_seconds is not None:
                        if tempo_seconds <= 60:
                            resultado = 'ACOP - A'
                        elif tempo_seconds <= 90:
                            resultado = 'ACOP - B'
                        else:
                            resultado = 'Em evolução'
                    else:
                        resultado = 'ACOP - A'
                else:
                    lower_res = resultado_raw.lower()
                    if 'permuta' in lower_res or 'não realizado' in lower_res:
                        resultado = 'Não Realizado'
                        status = 'nr'
                        motivo = 'Permuta' if 'permuta' in lower_res else (motivo or 'Não Realizado')
                    elif 'excelente' in lower_res or 'satisf' in lower_res or resultado_raw.strip().upper() in ['ACOP - A', 'ACOP A', 'ACOP-A']:
                        resultado = 'ACOP - A'
                    elif lower_res == 'bom' or resultado_raw.strip().upper() in ['ACOP - B', 'ACOP B', 'ACOP-B']:
                        resultado = 'ACOP - B'
                    elif 'ruim' in lower_res or 'insatisf' in lower_res or 'insatisfe' in lower_res or 'evolu' in lower_res:
                        resultado = 'Em evolução'
                    else:
                        resultado = resultado_raw
        
        records.append({
            'nome': nome_str,
            'equipe': equipe,
            'funcao': funcao,
            'tempoSeconds': tempo_seconds,
            'tempoFormatted': tempo_formatted,
            'resultado': resultado,
            'status': status,
            'motivo': motivo or None,
            'mes': month_name
        })

    wb.close()
    return records


# ────────── TR Parser ──────────

def normalize_tr_cci(cci_raw):
    """Normalize CCI string and return (normalized_cci, viatura_codigo)."""
    s = str(cci_raw).strip().upper()
    if s in ['F01', 'F-01', 'F1', '1°CCI', '1CCI', '1ºCCI']:
        return '1°CCI', 'F01'
    if s in ['F02', 'F-02', 'F2', '2°CCI', '2CCI', '2ºCCI']:
        return '2°CCI', 'F02'
    if s in ['F03', 'F-03', 'F3', '3°CCI', '3CCI', '3ºCCI']:
        return '3°CCI', 'F03'
    if s in ['F04', 'F-04', 'F4', '4°CCI', '4CCI', '4ºCCI']:
        return '4°CCI', 'F04'
    if s in ['F05', 'F-05', 'F5', '5°CCI', '5CCI', '5ºCCI']:
        return '5°CCI', 'F05'
    if '358' in s or s in ['F358', 'F-358']:
        return 'CCI 358', 'F358'

    if not '°' in s and s and s[0].isdigit():
        s = re.sub(r'^(\d+)\s*', r'\1°', s)
        if 'CCI' not in s:
            s += 'CCI'
    return s, ''


def parse_tr(f):
    if not os.path.exists(f):
        print(f'Warning: File {f} not found.')
        return []
    print(f'Parsing TR: {os.path.basename(f)}')
    wb = openpyxl.load_workbook(f, data_only=True)
    records = []
    
    month_indices = MONTH_INDEX
    
    for sn in ['CABECEIRA 28', 'CABECEIRA 33', 'CABECEIRA 15']:
        ws = wb[sn]
        cabeceira = sn.split()[-1]
        
        col_mappings = []
        current_month = None
        
        row7 = [ws.cell(row=7, column=c).value for c in range(1, ws.max_column+1)]
        row8 = [ws.cell(row=8, column=c).value for c in range(1, ws.max_column+1)]
        
        for col_idx in range(1, len(row7)):
            m_val = row7[col_idx]
            if m_val and str(m_val).strip().upper() in MONTH_MAP:
                current_month = MONTH_MAP[str(m_val).strip().upper()]
            
            cci_val = row8[col_idx]
            if cci_val and current_month:
                cci_str = str(cci_val).strip()
                if 'CCI' in cci_str.upper() or 'F0' in cci_str.upper() or '358' in cci_str.upper() or any(char.isdigit() for char in cci_str):
                    norm_cci, viat_cod = normalize_tr_cci(cci_str)
                    col_mappings.append({
                        'col': col_idx + 1,
                        'month': current_month,
                        'cci': norm_cci,
                        'viaturaCodigo': viat_cod
                    })
        
        for r_idx in range(9, 13):
            equipe = str(ws.cell(row=r_idx, column=1).value).strip().upper()
            if not equipe or equipe == 'NONE':
                continue

            mapped_cols = {item['col'] for item in col_mappings}
            for mapping in col_mappings:
                c_idx = mapping['col']
                val = ws.cell(row=r_idx, column=c_idx).value

                status = 'ok'
                tempo_seconds = None
                tempo_formatted = None
                observacao = ''
                viatura_codigo = mapping['viaturaCodigo']
                
                val_str = str(val).strip().upper() if val is not None else ''
                
                if 'PERMUTA' in val_str:
                    status = 'nr'
                    tempo_formatted = 'Não Realizado'
                    observacao = 'Permuta'
                elif val_str == 'NR':
                    status = 'nr'
                    tempo_formatted = 'NR'
                elif val_str == 'X' or val_str == '':
                    status = 'na'
                else:
                    status = 'ok'
                    if isinstance(val, datetime.time):
                        tempo_seconds = val.hour * 60 + val.minute
                        tempo_formatted = f"{val.hour:02d}:{val.minute:02d}"
                    elif isinstance(val, (int, float)):
                        total_sec = int(round(val * 1440))
                        tempo_seconds = total_sec
                        tempo_formatted = f"{total_sec // 60:02d}:{total_sec % 60:02d}"
                    else:
                        vehicle_match = re.search(r'F-?(?:358|0?[1-9])', val_str)
                        if vehicle_match:
                            _, viatura_codigo = normalize_tr_cci(vehicle_match.group(0))

                        time_match = re.search(r'(?<!\d)(\d{1,2}):([0-5]\d)(?!\d)', val_str)
                        if time_match:
                            minutes = int(time_match.group(1))
                            seconds = int(time_match.group(2))
                            tempo_seconds = minutes * 60 + seconds
                            tempo_formatted = f"{minutes:02d}:{seconds:02d}"
                        else:
                            status = 'empty'
                
                # Check for adjacent observation column
                if c_idx < ws.max_column and c_idx + 1 not in mapped_cols:
                    next_val = ws.cell(row=r_idx, column=c_idx+1).value
                    if next_val and isinstance(next_val, str) and len(next_val.strip()) > 3:
                        if 'PERMUTA' in next_val.upper():
                            status = 'nr'
                            tempo_formatted = 'Não Realizado'
                            tempo_seconds = None
                            observacao = next_val.strip()
                        elif not any(k in next_val.upper() for k in ['CCI', 'ALFA', 'BRAVO', 'CHARLIE', 'DELTA']):
                            observacao = next_val.strip()

                if status != 'na' and status != 'empty':
                    records.append({
                        'cabeceira': cabeceira,
                        'equipe': equipe,
                        'mes': mapping['month'],
                        'mesIndex': month_indices.get(mapping['month'], 0),
                        'cci': mapping['cci'],
                        'viaturaCodigo': viatura_codigo,
                        'observacao': observacao,
                        'tempoFormatted': tempo_formatted,
                        'tempoSeconds': tempo_seconds,
                        'status': status
                    })
    wb.close()
    return records


# ────────── Teórica Parser ──────────

def parse_teorica_file(filepath, month_name, colaborador_map, id_offset=0):
    """Parse a single theoretical evaluation XLSX file (supports Forms export and consolidated formats)."""
    print(f'  Parsing Teórica: {os.path.basename(filepath)} -> {month_name}')
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb['Sheet1'] if 'Sheet1' in wb.sheetnames else wb[wb.sheetnames[0]]
    
    headers = [str(ws.cell(row=1, column=c).value or '').strip() for c in range(1, ws.max_column + 1)]
    
    col_nota = None
    col_nome = None
    col_funcao = None
    col_aeroporto = None
    
    for idx, h in enumerate(headers):
        hu = h.upper()
        if 'TOTAL' in hu and 'PONTO' in hu and col_nota is None:
            col_nota = idx
        elif 'NOME' in hu and col_nome is None:
            if 'COMPLETO' in hu or idx > 4:
                col_nome = idx
        elif 'FUN' in hu and col_funcao is None:
            col_funcao = idx
        elif 'AERO' in hu and col_aeroporto is None:
            col_aeroporto = idx
            
    # Fallbacks if headers weren't named exactly
    if col_nota is None:
        col_nota = 0
    if col_nome is None:
        col_nome = 1
    if col_funcao is None:
        col_funcao = 2
    if col_aeroporto is None:
        col_aeroporto = 3
        
    basic_indices = [x for x in [col_nota, col_nome, col_funcao, col_aeroporto] if x is not None]
    basic_max_idx = max(basic_indices) if basic_indices else 3
    q_point_cols = []
    for idx in range(basic_max_idx + 1, len(headers)):
        hu = headers[idx].upper()
        if 'PONTO' in hu:
            q_point_cols.append(idx)
            
    records = []
    import difflib
    row_num = 0
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        if not row or col_nome is None or len(row) <= col_nome or not row[col_nome]:
            continue
            
        row_num += 1
        nome_orig = str(row[col_nome]).strip()
        if not nome_orig or any(k in nome_orig.upper() for k in ['TOTAL', 'MÉDIA', 'MEDIA', 'CONTAGEM']):
            continue
            
        nome_norm = normalize_name(nome_orig)
        funcao_orig = str(row[col_funcao]).strip() if col_funcao is not None and len(row) > col_funcao and row[col_funcao] else ''
        funcao = normalize_funcao(funcao_orig)
        
        try:
            nota = float(row[col_nota]) if col_nota is not None and len(row) > col_nota and row[col_nota] is not None else 0.0
        except:
            nota = 0.0
            
        equipe = 'Não identificada'
        if nome_norm in colaborador_map:
            equipe = colaborador_map[nome_norm]['equipe']
        else:
            matches = difflib.get_close_matches(nome_norm, colaborador_map.keys(), n=1, cutoff=0.75)
            if matches:
                equipe = colaborador_map[matches[0]]['equipe']
                
        questoes = []
        for q_idx, c_idx in enumerate(q_point_cols, start=1):
            if c_idx < len(row):
                val = row[c_idx]
                if val is not None:
                    try:
                        questoes.append({'num': q_idx, 'pontos': float(val)})
                    except:
                        pass
                        
        records.append({
            'id': id_offset + row_num,
            'nome': nome_orig,
            'funcao': funcao,
            'funcaoOriginal': funcao_orig,
            'aeroporto': 'SBGL',
            'nota': nota,
            'equipe': equipe,
            'questoes': questoes,
            'mes': month_name
        })
        
    wb.close()
    return records


def parse_teorica(colaborador_map):
    """Parse all theoretical assessments (Junho 2º Trimestre, Setembro 3º Trimestre)."""
    records = []
    
    # 1. 2º Trimestre / Junho
    f_junho = os.path.join(BASE_DIR, '_Aplicação de Avaliação Teórica PTR-BA 2º Trimestre - 2026. (1-87).xlsx')
    if os.path.exists(f_junho):
        recs_junho = parse_teorica_file(f_junho, 'Junho', colaborador_map, id_offset=0)
        records.extend(recs_junho)
        print(f'    -> {len(recs_junho)} records for Junho')
        
    # 2. 3º Trimestre / Setembro
    setembro_dir = os.path.join(BASE_DIR, 'setembro')
    f_setembro = None
    if os.path.exists(setembro_dir):
        f_setembro = next((os.path.join(setembro_dir, f) for f in os.listdir(setembro_dir)
                           if ('TEÓR' in unicodedata.normalize('NFC', f).upper() or 'TEOR' in unicodedata.normalize('NFC', f).upper())
                           and f.endswith('.xlsx') and not f.startswith('~')), None)
    if f_setembro and os.path.exists(f_setembro):
        recs_setembro = parse_teorica_file(f_setembro, 'Setembro', colaborador_map, id_offset=len(records))
        records.extend(recs_setembro)
        print(f'    -> {len(recs_setembro)} records for Setembro')
        
    return records


# ────────── Main ──────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLANILHAS_DIR = os.path.join(BASE_DIR, 'js', 'planilhas')


def parse_actuation_file(filepath, sheet_name, is_second_sem=False):
    if not os.path.exists(filepath):
        print(f"Warning: File {filepath} not found.")
        return []
    
    wb = openpyxl.load_workbook(filepath, data_only=True)
    if sheet_name not in wb.sheetnames:
        print(f"Warning: Sheet '{sheet_name}' not found.")
        return []
        
    ws = wb[sheet_name]
    meses_map = {1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'}
    records = []
    
    start_row = 7 if is_second_sem else 6
    for r in range(start_row, ws.max_row + 1):
        val_date = ws.cell(row=r, column=1).value
        val_tipo = ws.cell(row=r, column=3 if is_second_sem else 2).value
        val_equipe = ws.cell(row=r, column=4 if is_second_sem else 3).value
        val_desc = ws.cell(row=r, column=5 if is_second_sem else 4).value
        val_acoes = ws.cell(row=r, column=6 if is_second_sem else 5).value
        val_local = ws.cell(row=r, column=7).value if is_second_sem else None
        
        if not (val_date or val_tipo or val_desc or val_acoes or val_local):
            continue

        date_str = str(val_date)[:10] if val_date else ''
        mes_str = ''
        if hasattr(val_date, 'month'):
            mes_str = meses_map.get(val_date.month, 'Julho' if is_second_sem else 'Janeiro')
        elif isinstance(val_date, str):
            m = re.search(r'-(\d{2})-', val_date)
            if m:
                mes_str = meses_map.get(int(m.group(1)), 'Julho' if is_second_sem else 'Janeiro')

        tipo_raw = str(val_tipo).strip() if val_tipo else 'OUTROS'
        equipe = str(val_equipe).strip().upper() if val_equipe else 'N/I'
        desc = str(val_desc).strip() if val_desc else ''
        acoes = str(val_acoes).strip() if val_acoes else ''
        full_txt = f'{desc} {acoes}'.upper()

        # Standardize types
        if any(k in tipo_raw.upper() for k in ['DERRAMAMENTO DE COMBUSTÍVEL', 'DERRAMAMENTO DE COMBUSTIVEL']):
            tipo_std = 'Derramamento de Combustível'
        elif any(k in tipo_raw.upper() for k in ['DERRAMAMENTO DE ÓLEO', 'DERRAMAMENTO DE OLEO', 'DERRAMAMENTO DE FLUÍDO', 'DERRAMAMENTO DE FLUIDO']):
            tipo_std = 'Derramamento de Óleo / Fluído'
        elif 'PRODUTO QUÍMICO' in tipo_raw.upper() or 'PRODUTO QUIMICO' in tipo_raw.upper() or 'MATERIAL PERIGOSO' in tipo_raw.upper():
            tipo_std = 'Derramamento de Prod. Químico'
        elif any(k in tipo_raw.upper() for k in ['INCÊNDIO EM VEGETAÇÃO', 'INCENDIO EM VEGETACAO', 'FOGO EM VEGETAÇÃO', 'FOGO EM VEGETACAO']):
            tipo_std = 'Incêndio em Vegetação'
        elif 'INSTALAÇÃO' in tipo_raw.upper() or 'INSTALACAO' in tipo_raw.upper():
            tipo_std = 'Incêndio em Instalação'
        elif 'EQUIPAMENTO' in tipo_raw.upper():
            tipo_std = 'Incêndio / Pane em Equipamento'
        elif any(k in tipo_raw.upper() for k in ['CAPTURA DE ANIMAL', 'CAPTURA DE FAUNA']):
            tipo_std = 'Captura de Fauna / Animal'
        elif 'EMERGÊNCIA AERONÁUTICA' in tipo_raw.upper() or 'EMERGENCIA AERONAUTICA' in tipo_raw.upper():
            tipo_std = 'Emergência Aeronáutica'
        elif 'CONDIÇÃO DE SOCORRO' in tipo_raw.upper() or 'CONDICAO DE SOCORRO' in tipo_raw.upper():
            tipo_std = 'Condição de Socorro'
        elif 'CONDIÇÃO DE URGÊNCIA' in tipo_raw.upper() or 'CONDICAO DE URGENCIA' in tipo_raw.upper() or 'DEINTERDIÇÃO DE PISTA' in tipo_raw.upper():
            tipo_std = 'Condição de Urgência'
        elif 'GIRO DE MOTOR' in tipo_raw.upper():
            tipo_std = 'Giro de Motor (Prevenção)'
        elif any(k in tipo_raw.upper() for k in ['BATISMO', 'PRESIDENCIAL']):
            tipo_std = 'Apoio / Batismo / Presidencial'
        elif 'SIMULADO' in tipo_raw.upper():
            tipo_std = 'Simulado de Emergência'
        elif any(k in tipo_raw.upper() for k in ['BALOEIRO', 'PIPA', 'BALÃO', 'BALAO']):
            tipo_std = 'Risco Baloeiro / Pipa'
        elif 'MÉDICA' in tipo_raw.upper() or 'MEDICA' in tipo_raw.upper():
            tipo_std = 'Emergência Médica'
        else:
            tipo_std = 'Outros Acionamentos'

        quadrante = None
        m_q = re.search(r'QUADRANTE\s*([A-Z0-9\-]+)', full_txt)
        if m_q:
            quadrante = m_q.group(1).upper()

        # Extract location: prioritize Column G (val_local) if present
        location = None
        if val_local and str(val_local).strip():
            loc_str = str(val_local).strip().upper()
            if '10-28' in loc_str or '10/28' in loc_str:
                location = 'Sistema 10-28'
            elif '15-30' in loc_str or '15/30' in loc_str or '15-33' in loc_str or '15/33' in loc_str:
                location = 'Sistema 15-30'
            elif 'CAB.10' in loc_str or 'CAB 10' in loc_str or 'CABECEIRA 10' in loc_str:
                location = 'Cabeceira 10'
            elif 'CAB.15' in loc_str or 'CAB 15' in loc_str or 'CABECEIRA 15' in loc_str:
                location = 'Cabeceira 15'
            elif 'CAB.28' in loc_str or 'CAB 28' in loc_str or 'CABECEIRA 28' in loc_str:
                location = 'Cabeceira 28'
            elif 'CAB.33' in loc_str or 'CAB 33' in loc_str or 'CABECEIRA 33' in loc_str:
                location = 'Cabeceira 33'
            elif 'PÁTIO 01' in loc_str or 'PATIO 01' in loc_str or 'PÁTIO 1' in loc_str or 'PATIO 1' in loc_str:
                location = 'Pátio 1'
            elif 'PÁTIO 02' in loc_str or 'PATIO 02' in loc_str or 'PÁTIO 2' in loc_str or 'PATIO 2' in loc_str:
                location = 'Pátio 2'
            elif 'PÁTIO 03' in loc_str or 'PATIO 03' in loc_str or 'PÁTIO 3' in loc_str or 'PATIO 3' in loc_str:
                location = 'Pátio 3'
            elif 'PÁTIO 5' in loc_str or 'PATIO 5' in loc_str or 'PÁTIO 05' in loc_str or 'PATIO 05' in loc_str:
                location = 'Pátio 5'
            elif 'MILITAR' in loc_str or 'FAB' in loc_str:
                location = 'Pátio Militar'
            elif 'LÍDER' in loc_str or 'LIDER' in loc_str:
                location = 'Pátio Líder'
            elif 'UNITED' in loc_str or 'HANGAR' in loc_str:
                location = 'Hangar United / Manutenção'
            elif 'TECA' in loc_str:
                if 'EXPORTAÇÃO' in loc_str or 'EXPORTACAO' in loc_str:
                    location = 'TECA Exportação'
                else:
                    location = 'Área de Cargas TECA'

        if not location:
            if 'SISTEMA 10-28' in full_txt or 'SISTEMA 10/28' in full_txt:
                location = 'Sistema 10-28'
            elif 'SISTEMA 15-30' in full_txt or 'SISTEMA 15/30' in full_txt or 'SISTEMA 15-33' in full_txt:
                location = 'Sistema 15-30'
            elif 'CABECEIRA 28' in full_txt or ('28' in full_txt and 'CABECEIRA' in full_txt):
                location = 'Cabeceira 28'
            elif 'CABECEIRA 15' in full_txt or ('15' in full_txt and 'CABECEIRA' in full_txt):
                location = 'Cabeceira 15'
            elif 'CABECEIRA 10' in full_txt or ('10' in full_txt and 'CABECEIRA' in full_txt):
                location = 'Cabeceira 10'
            elif 'CABECEIRA 33' in full_txt or ('33' in full_txt and 'CABECEIRA' in full_txt):
                location = 'Cabeceira 33'
            elif 'PÁTIO MILITAR' in full_txt or 'PATIO MILITAR' in full_txt:
                location = 'Pátio Militar'
            elif 'HANGAR' in full_txt:
                location = 'Hangar United / Manutenção'
            elif 'PÍER SUL' in full_txt or 'PIER SUL' in full_txt or 'PÁTIO 3' in full_txt or 'PATIO 3' in full_txt:
                location = 'Pátio 3'
            elif 'PÁTIO 1' in full_txt or 'PATIO 1' in full_txt or 'PÁTIO 01' in full_txt:
                location = 'Pátio 1'
            elif 'PÁTIO 2' in full_txt or 'PATIO 2' in full_txt or 'PÁTIO 02' in full_txt:
                location = 'Pátio 2'
            elif 'TECA' in full_txt:
                location = 'Área de Cargas TECA'
            else:
                m_pos = re.search(r'POSIÇÃO\s*(\d+)', full_txt)
                if m_pos:
                    location = f'Posição {m_pos.group(1)}'
                elif quadrante:
                    location = f'Quadrante {quadrante}'
                else:
                    location = 'Pátio 2'

        vehicles = []
        vehicle_patterns = [
            ('CCI 01 (F01)', ['CCI 01', 'CCI 1', 'CCI-01', 'CCI-1', 'F01', 'F-01', 'FAÍSCA 01', 'FAISCA 01']),
            ('CCI 02 (F02)', ['CCI 02', 'CCI 2', 'CCI-02', 'CCI-2', 'F02', 'F-02', 'FAÍSCA 02', 'FAISCA 02']),
            ('CCI 03 (F03)', ['CCI 03', 'CCI 3', 'CCI-03', 'CCI-3', 'F03', 'F-03', 'FAÍSCA 03', 'FAISCA 03']),
            ('CCI 04 (F04)', ['CCI 04', 'CCI 4', 'CCI-04', 'CCI-4', 'F04', 'F-04', 'FAÍSCA 04', 'FAISCA 04']),
            ('CCI 05 (F05)', ['CCI 05', 'CCI 5', 'CCI-05', 'CCI-5', 'F05', 'F-05', 'FAÍSCA 05', 'FAISCA 05']),
            ('CCI 358 (F358)', ['CCI 358', 'CCI-358', 'F358', 'F-358', '358']),
            ('CCI 07', ['CCI 07', 'CCI 7', 'CCI-07']),
            ('CRS', ['CRS', 'CRS 01', 'CRS 1']),
            ('CACE', ['CACE', 'CACE 025']),
            ('BRASA UNO', ['BRASA UNO', 'BRASA 1', 'BRASA 01']),
            ('BRASA DOS', ['BRASA DOS', 'BRASA 2', 'BRASA 02']),
            ('BRASA 3', ['BRASA 3', 'BRASA 03', 'BRASA TRES']),
            ('FAÍSCA LÍDER', ['FAÍSCA LÍDER', 'FAISCA LIDER', 'FAISCA LÍDER'])
        ]
        for v_name, aliases in vehicle_patterns:
            if any(a in full_txt for a in aliases):
                vehicles.append(v_name)

        prefix = 'ACT-2S' if is_second_sem else 'ACT'
        records.append({
            'id': f'{prefix}-{r}',
            'data': date_str,
            'mes': mes_str or ('Julho' if is_second_sem else 'Janeiro'),
            'tipo_raw': tipo_raw,
            'tipo': tipo_std,
            'equipe': equipe,
            'descricao': desc,
            'acoes': acoes,
            'localizacao': location,
            'quadrante': quadrante,
            'viaturas': vehicles
        })

    wb.close()
    return records


def parse_actuation():
    """Parse first-semester and second-semester actuation spreadsheets."""
    f1 = os.path.join(BASE_DIR, 'ATUAÇÃO SESCINC 1 SEMESTRE 2026  03-07 - Copia.xlsx')
    f2_novo = os.path.join(BASE_DIR, 'ATUAÇÃO SESCINC JULHO 2026 novo.xlsx')
    f2_old = os.path.join(BASE_DIR, 'julho dados', 'ATUAÇÃO SESCINC 2° SEMESTRE 2026.xlsx')
    agosto_dir = os.path.join(BASE_DIR, 'agosto')
    f2_agosto = next((os.path.join(agosto_dir, f) for f in os.listdir(agosto_dir)
                      if 'ATUA' in f.upper() and 'AGOSTO' in f.upper() and f.endswith('.xlsx')), None)
    
    f2 = f2_novo if os.path.exists(f2_novo) else f2_old
    
    recs1 = parse_actuation_file(f1, '1° SEMESTRE 2026', is_second_sem=False)
    recs2 = parse_actuation_file(f2, '2° SEMESTRE 2026', is_second_sem=True)
    recs3 = parse_actuation_file(f2_agosto, '2° SEMESTRE 2026', is_second_sem=True) if f2_agosto else []
    
    return recs1 + recs2 + recs3


def main():
    all_taf_records = []
    all_tpepr_records = []
    
    # ── 1. Parse TAF files from planilhas folder (Janeiro-Maio) ──
    print('\n=== Parsing TAF files (planilhas folder) ===')
    taf_files = sorted([f for f in os.listdir(PLANILHAS_DIR) if 'TAF' in f.upper() and f.endswith('.xlsx') and not f.startswith('~')])
    for taf_file in taf_files:
        month = detect_month_from_filename(taf_file)
        if month:
            filepath = os.path.join(PLANILHAS_DIR, taf_file)
            records = parse_taf_file(filepath, month)
            all_taf_records.extend(records)
            print(f'    -> {len(records)} records for {month}')
    
    # ── 2. Parse TAF file from root (Junho) ──
    print('\n=== Parsing TAF Junho (root) ===')
    junho_taf = os.path.join(BASE_DIR, 'AFERIÇÃO - TAF JUNHO 2026.xlsx')
    if os.path.exists(junho_taf):
        records = parse_taf_file(junho_taf, 'Junho')
        all_taf_records.extend(records)
        print(f'    -> {len(records)} records for Junho')

    # ── 2b. Parse TAF file from julho dados (Julho) ──
    print('\n=== Parsing TAF Julho (julho dados) ===')
    julho_taf = os.path.join(BASE_DIR, 'julho dados', 'AFERIÇÃO - TAF JULHO 2026.xlsx')
    if os.path.exists(julho_taf):
        records = parse_taf_file(julho_taf, 'Julho')
        all_taf_records.extend(records)
        print(f'    -> {len(records)} records for Julho')

    # ── 2c. Parse TAF file from agosto ──
    print('\n=== Parsing TAF Agosto (agosto) ===')
    agosto_dir = os.path.join(BASE_DIR, 'agosto')
    agosto_taf = next((os.path.join(agosto_dir, f) for f in os.listdir(agosto_dir)
                       if 'TAF' in f.upper() and 'AGOSTO' in f.upper() and f.endswith('.xlsx')), None)
    if agosto_taf:
        records = parse_taf_file(agosto_taf, 'Agosto')
        all_taf_records.extend(records)
        print(f'    -> {len(records)} records for Agosto')

    # ── 2d. Parse TAF file from setembro ──
    print('\n=== Parsing TAF Setembro (setembro) ===')
    setembro_dir = os.path.join(BASE_DIR, 'setembro')
    if os.path.exists(setembro_dir):
        setembro_taf = next((os.path.join(setembro_dir, f) for f in os.listdir(setembro_dir)
                             if 'TAF' in f.upper() and f.endswith('.xlsx') and not f.startswith('~')), None)
        if setembro_taf:
            records = parse_taf_file(setembro_taf, 'Setembro')
            all_taf_records.extend(records)
            print(f'    -> {len(records)} records for Setembro')
    
    # ── 3. Parse TP-EPR files from planilhas folder (Janeiro-Maio) ──
    print('\n=== Parsing TP-EPR files (planilhas folder) ===')
    tpepr_files = sorted([f for f in os.listdir(PLANILHAS_DIR) if 'TP-EPR' in f.upper() and f.endswith('.xlsx') and not f.startswith('~')])
    for tpepr_file in tpepr_files:
        month = detect_month_from_filename(tpepr_file)
        if month:
            filepath = os.path.join(PLANILHAS_DIR, tpepr_file)
            records = parse_tpepr_file(filepath, month)
            all_tpepr_records.extend(records)
            print(f'    -> {len(records)} records for {month}')
    
    # ── 4. Parse TP-EPR file from root (Junho) ──
    print('\n=== Parsing TP-EPR Junho (root) ===')
    junho_tpepr = os.path.join(BASE_DIR, 'AFERIÇÃO TP-EPR JUNHO 2026.xlsx')
    if os.path.exists(junho_tpepr):
        records = parse_tpepr_file(junho_tpepr, 'Junho')
        all_tpepr_records.extend(records)
        print(f'    -> {len(records)} records for Junho')

    # ── 4b. Parse TP-EPR file from julho dados (Julho) ──
    print('\n=== Parsing TP-EPR Julho (julho dados) ===')
    julho_tpepr = os.path.join(BASE_DIR, 'julho dados', 'AFERIÇÃO TP-EPR JULHO 2026.xlsx')
    if os.path.exists(julho_tpepr):
        records = parse_tpepr_file(julho_tpepr, 'Julho')
        all_tpepr_records.extend(records)
        print(f'    -> {len(records)} records for Julho')

    # ── 4c. Parse TP-EPR file from agosto ──
    print('\n=== Parsing TP-EPR Agosto (agosto) ===')
    agosto_tpepr = next((os.path.join(agosto_dir, f) for f in os.listdir(agosto_dir)
                         if 'TP-EPR' in f.upper() and 'AGOSTO' in f.upper() and f.endswith('.xlsx')), None)
    if agosto_tpepr:
        records = parse_tpepr_file(agosto_tpepr, 'Agosto')
        all_tpepr_records.extend(records)
        print(f'    -> {len(records)} records for Agosto')

    # ── 4d. Parse TP-EPR file from setembro (if present) ──
    if os.path.exists(setembro_dir):
        setembro_tpepr = next((os.path.join(setembro_dir, f) for f in os.listdir(setembro_dir)
                               if 'TP-EPR' in f.upper() and f.endswith('.xlsx') and not f.startswith('~')), None)
        if setembro_tpepr:
            print('\n=== Parsing TP-EPR Setembro (setembro) ===')
            records = parse_tpepr_file(setembro_tpepr, 'Setembro')
            all_tpepr_records.extend(records)
            print(f'    -> {len(records)} records for Setembro')
    
    # ── 5. Deduplication check ──
    print('\n=== Deduplication Check ===')
    
    # TAF: deduplicate by (nome_normalized, mes)
    taf_seen = set()
    taf_deduped = []
    for r in all_taf_records:
        key = (
            normalize_name(r['nome']), r['mes'], r.get('equipe'), r.get('funcao'),
            r.get('idade'), r.get('flexao'), r.get('abdominal'), r.get('barra'),
            r.get('corrida'), r.get('corridaSeconds'), r.get('resultado'), r.get('status'), r.get('motivo')
        )
        if key not in taf_seen:
            taf_seen.add(key)
            taf_deduped.append(r)
        else:
            print(f'  TAF DUPLICATE SKIPPED: {r["nome"]} - {r["mes"]}')
    all_taf_records = taf_deduped
    
    # TPEPR: deduplicate by (nome_normalized, mes)
    tpepr_seen = set()
    tpepr_deduped = []
    for r in all_tpepr_records:
        key = (
            normalize_name(r['nome']), r['mes'], r.get('equipe'), r.get('funcao'),
            r.get('tempoSeconds'), r.get('tempoFormatted'), r.get('resultado'), r.get('status'), r.get('motivo')
        )
        if key not in tpepr_seen:
            tpepr_seen.add(key)
            tpepr_deduped.append(r)
        else:
            print(f'  TPEPR DUPLICATE SKIPPED: {r["nome"]} - {r["mes"]}')
    all_tpepr_records = tpepr_deduped
    
    # ── 6. Parse TR ──
    print('\n=== Parsing TR ===')
    tr_records = []
    tr_sources = [
        os.path.join(BASE_DIR, 'DESEMPENHO DA EXECUÇÃO TR.xlsx'),
        os.path.join(agosto_dir, 'DESEMPENHO DA EXECUÇÃO TR 2º SEMESTRE.xlsx')
    ]
    for tr_source in tr_sources:
        if os.path.exists(tr_source):
            tr_records.extend(parse_tr(tr_source))
    print(f'    -> {len(tr_records)} TR records')
    
    # ── 7. Build colaborador map from ALL months for Teórica matching ──
    colaborador_map = {}
    for r in all_taf_records:
        n = normalize_name(r['nome'])
        if n and r['equipe']:
            colaborador_map[n] = {'equipe': r['equipe'], 'funcao': r['funcao']}
    for r in all_tpepr_records:
        n = normalize_name(r['nome'])
        if n and r['equipe'] and n not in colaborador_map:
            colaborador_map[n] = {'equipe': r['equipe'], 'funcao': r['funcao']}
    
    # ── 8. Parse Teórica ──
    print('\n=== Parsing Teórica ===')
    teorica_records = parse_teorica(colaborador_map)
    # ── 8b. Parse Atuação SESCINC ──
    print('\n=== Parsing Atuação SESCINC ===')
    actuation_records = parse_actuation()
    print(f'    -> {len(actuation_records)} Atuação SESCINC records')
    
    # ── 9. Summary by month ──
    print('\n=== SUMMARY ===')
    taf_by_month = {}
    for r in all_taf_records:
        m = r['mes']
        taf_by_month[m] = taf_by_month.get(m, 0) + 1
    print(f'TAF records by month: {json.dumps(taf_by_month, ensure_ascii=False)}')
    
    tpepr_by_month = {}
    for r in all_tpepr_records:
        m = r['mes']
        tpepr_by_month[m] = tpepr_by_month.get(m, 0) + 1
    print(f'TPEPR records by month: {json.dumps(tpepr_by_month, ensure_ascii=False)}')
    
    print(f'TR records: {len(tr_records)}')
    print(f'Teórica records: {len(teorica_records)}')
    print(f'Atuação records: {len(actuation_records)}')
    print(f'Total TAF: {len(all_taf_records)}')
    print(f'Total TPEPR: {len(all_tpepr_records)}')
    
    # ── 10. Generate seed-data.js ──
    seed_data = {
        'taf': {
            'records': all_taf_records,
            'uploadedAt': datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
        },
        'tpepr': {
            'records': all_tpepr_records,
            'uploadedAt': datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
        },
        'tr': {
            'records': tr_records,
            'uploadedAt': datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
        },
        'teorica': {
            'records': teorica_records,
            'uploadedAt': datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
        },
        'actuation': {
            'records': actuation_records,
            'uploadedAt': datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
        }
    }
    
    out_file = os.path.join(BASE_DIR, 'js', 'seed-data.js')
    
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write("/**\n * SESCINC SBGL Dashboard — Seed Data\n * Automatically generated from Excel spreadsheets\n * Generated at: " + datetime.datetime.now().isoformat() + "\n */\n\n")
        f.write("window.SESCINC = window.SESCINC || {};\n")
        f.write("window.SESCINC.SeedData = ")
        json.dump(seed_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    print(f'\n✅ Seed data written to {out_file}')
    print(f'   File size: {os.path.getsize(out_file):,} bytes')


if __name__ == '__main__':
    main()
