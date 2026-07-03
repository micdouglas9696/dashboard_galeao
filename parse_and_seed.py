# -*- coding: utf-8 -*-
import openpyxl
import datetime
import json
import re
import os

# Helper to normalize function names (mirroring names.js)
def normalize_funcao(fun):
    if not fun:
        return 'BA'
    fun = str(fun).strip().upper()
    if fun in ['BA', 'B.A.', 'BA', 'ba', 'B.A']:
        return 'BA'
    if fun in ['BA2', 'BA 2', 'BA-2', 'BA-02', 'B.A II', 'BA2', 'BA-2']:
        return 'BA2'
    if fun in ['BA-MC', 'BA-MC', 'BAMC', 'BA MC', 'BA- MC', 'BA-MC']:
        return 'BA-MC'
    if fun in ['BA-LR']:
        return 'BA-LR'
    if fun in ['BA-RE']:
        return 'BA-RE'
    if fun in ['BA-CE']:
        return 'BA-CE'
    if fun in ['BA-MA', 'BA MA']:
        return 'BA-MA'
    if fun in ['OC']:
        return 'OC'
    
    # Generic regex matches
    if re.search(r'BA.*MC', fun): return 'BA-MC'
    if re.search(r'BA.*LR', fun): return 'BA-LR'
    if re.search(r'BA.*RE', fun): return 'BA-RE'
    if re.search(r'BA.*CE', fun): return 'BA-CE'
    if re.search(r'BA.*MA', fun): return 'BA-MA'
    if '2' in fun or 'II' in fun: return 'BA2'
    return 'BA'

# Helper to normalize names for mapping
def normalize_name(name):
    if not name:
        return ''
    name = str(name).strip().upper()
    name = re.sub(r'\s+', ' ', name)
    name = re.sub(r'\.$', '', name)
    # Basic accent stripping
    import unicodedata
    name = ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
    return name

# Parse TAF
def parse_taf():
    f = 'AFERIÇÃO - TAF JUNHO 2026.xlsx'
    print(f'Parsing {f}...')
    wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb['JUNHO']
    records = []
    
    # Row 5 headers: NOME, EQUIPE, FUNÇÃO, IDADE, Flexão Solo, Abdominal, Barra Fixa, Corrida, Resultado
    for row in ws.iter_rows(min_row=6, max_row=ws.max_row, values_only=True):
        nome = row[0]
        if not nome or str(nome).strip() == '' or 'TOTAL' in str(nome).upper() or 'CONTAGEM' in str(nome).upper():
            continue
            
        equipe = str(row[1]).strip().upper() if row[1] else ''
        funcao = normalize_funcao(row[2])
        idade = int(row[3]) if row[3] is not None else None
        
        flexao_raw = row[4]
        abdominal_raw = row[5]
        barra_raw = row[6]
        corrida_raw = row[7]
        resultado = str(row[8]).strip() if row[8] else 'Satisfatório'
        
        status = 'ok'
        # Check if FÉRIAS or NR
        is_ferias = False
        for cell_val in row[4:8]:
            if cell_val and 'FERIAS' in str(cell_val).upper():
                is_ferias = True
        
        if is_ferias:
            status = 'ferias'
            flexao = None
            abdominal = None
            barra = None
            corrida = 'FÉRIAS'
            corrida_seconds = None
        else:
            flexao = int(flexao_raw) if flexao_raw is not None and str(flexao_raw).strip() != '' and str(flexao_raw).upper() != 'NR' else None
            abdominal = int(abdominal_raw) if abdominal_raw is not None and str(abdominal_raw).strip() != '' and str(abdominal_raw).upper() != 'NR' else None
            barra = int(barra_raw) if barra_raw is not None and str(barra_raw).strip() != '' and str(barra_raw).upper() != 'NR' else None
            
            corrida = str(corrida_raw).strip() if corrida_raw is not None else ''
            corrida_seconds = None
            if corrida and corrida.upper() != 'NR':
                # format mm'ss"
                m = re.match(r'(\d+)\'(\d+)"', corrida)
                if m:
                    corrida_seconds = int(m.group(1)) * 60 + int(m.group(2))
                else:
                    try:
                        # maybe just a float/int minutes?
                        corrida_seconds = int(float(corrida) * 60)
                    except:
                        pass
            else:
                if corrida.upper() == 'NR':
                    status = 'nr'
                    
        records.append({
            'nome': str(nome).strip(),
            'equipe': equipe,
            'funcao': funcao,
            'idade': idade,
            'flexao': flexao,
            'abdominal': abdominal,
            'barra': barra,
            'corrida': corrida,
            'corridaSeconds': corrida_seconds,
            'resultado': resultado,
            'status': status
        })
    
    wb.close()
    return records

# Parse TP-EPR
def parse_tpepr():
    f = 'AFERIÇÃO TP-EPR JUNHO 2026.xlsx'
    print(f'Parsing {f}...')
    wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb['JUNHO']
    records = []
    
    # Headers at row 5 columns B-F (index 1 to 5)
    for row in ws.iter_rows(min_row=6, max_row=ws.max_row, values_only=True):
        nome = row[1]
        if not nome or str(nome).strip() == '' or 'TOTAL' in str(nome).upper() or 'CONTAGEM' in str(nome).upper():
            continue
            
        equipe = str(row[2]).strip().upper() if row[2] else ''
        funcao = normalize_funcao(row[3])
        tempo_raw = row[4]
        resultado = str(row[5]).strip() if row[5] else ''
        
        tempo_seconds = 0
        tempo_formatted = ''
        
        if tempo_raw:
            if isinstance(tempo_raw, datetime.time):
                tempo_seconds = tempo_raw.hour * 3600 + tempo_raw.minute * 60 + tempo_raw.second
                tempo_formatted = f"{tempo_raw.minute:02d}:{tempo_raw.second:02d}"
            elif isinstance(tempo_raw, (int, float)):
                # Fraction of day
                total_sec = int(round(tempo_raw * 86400))
                tempo_seconds = total_sec
                minutos = total_sec // 60
                segundos = total_sec % 60
                tempo_formatted = f"{minutos:02d}:{segundos:02d}"
            else:
                # String
                t_str = str(tempo_raw).strip()
                parts = t_str.split(':')
                if len(parts) == 3:
                    tempo_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                    tempo_formatted = f"{int(parts[1]):02d}:{int(parts[2]):02d}"
                elif len(parts) == 2:
                    tempo_seconds = int(parts[0]) * 60 + int(parts[1])
                    tempo_formatted = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
                else:
                    tempo_formatted = t_str
        
        # Recalculate result just in case
        if not resultado:
            if tempo_seconds <= 60:
                resultado = 'Excelente'
            elif tempo_seconds <= 90:
                resultado = 'Bom'
            else:
                resultado = 'Ruim'
                
        records.append({
            'nome': str(nome).strip(),
            'equipe': equipe,
            'funcao': funcao,
            'tempoSeconds': tempo_seconds,
            'tempoFormatted': tempo_formatted,
            'resultado': resultado
        })
        
    wb.close()
    return records

# Parse Desempenho TR
def parse_tr():
    f = 'DESEMPENHO DA EXECUÇÃO TR.xlsx'
    print(f'Parsing {f}...')
    wb = openpyxl.load_workbook(f, data_only=True)
    records = []
    
    month_names = {
        'JANEIRO': 'Janeiro', 'FEVEREIRO': 'Fevereiro', 'MARÇO': 'Março',
        'ABRIL': 'Abril', 'MAIO': 'Maio', 'JUNHO': 'Junho'
    }
    month_indices = {
        'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5
    }
    
    for sn in ['CABECEIRA 28', 'CABECEIRA 33', 'CABECEIRA 15']:
        ws = wb[sn]
        cabeceira = sn.split()[-1]
        
        # Build month and CCI mappings
        # Row 7 is month, Row 8 is CCI
        col_mappings = []
        current_month = None
        
        row7 = [ws.cell(row=7, column=c).value for c in range(1, ws.max_column+1)]
        row8 = [ws.cell(row=8, column=c).value for c in range(1, ws.max_column+1)]
        
        for col_idx in range(1, len(row7)):
            m_val = row7[col_idx]
            if m_val and str(m_val).strip().upper() in month_names:
                current_month = month_names[str(m_val).strip().upper()]
            
            cci_val = row8[col_idx]
            if cci_val and current_month:
                cci_str = str(cci_val).strip()
                if 'CCI' in cci_str or any(char.isdigit() for char in cci_str):
                    col_mappings.append({
                        'col': col_idx + 1, # 1-indexed for cell access
                        'month': current_month,
                        'cci': cci_str
                    })
        
        # Parse teams from rows 9 to 12
        for r_idx in range(9, 13):
            equipe = str(ws.cell(row=r_idx, column=1).value).strip().upper()
            if not equipe or equipe == 'NONE':
                continue
                
            for mapping in col_mappings:
                c_idx = mapping['col']
                val = ws.cell(row=r_idx, column=c_idx).value
                
                status = 'ok'
                tempo_seconds = None
                tempo_formatted = None
                
                val_str = str(val).strip().upper() if val is not None else ''
                
                if val_str == 'NR':
                    status = 'nr'
                    tempo_formatted = 'NR'
                elif val_str == 'X' or val_str == '':
                    status = 'na' # not applicable or empty
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
                        # parse string "mm:ss:00" or similar
                        parts = val_str.split(':')
                        if len(parts) >= 2:
                            try:
                                # In HH:MM:SS format, HH is actually minutes and MM is seconds
                                if len(parts) == 3:
                                    tempo_seconds = int(parts[0]) * 60 + int(parts[1])
                                    tempo_formatted = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
                                else:
                                    tempo_seconds = int(parts[0]) * 60 + int(parts[1])
                                    tempo_formatted = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
                            except:
                                status = 'empty'
                        else:
                            status = 'empty'
                
                if status != 'na' and status != 'empty':
                    records.append({
                        'cabeceira': cabeceira,
                        'equipe': equipe,
                        'mes': mapping['month'],
                        'mesIndex': month_indices[mapping['month']],
                        'cci': mapping['cci'],
                        'tempoFormatted': tempo_formatted,
                        'tempoSeconds': tempo_seconds,
                        'status': status
                    })
    wb.close()
    return records

# Parse Avaliação Teórica
def parse_teorica(colaborador_map):
    f = '_Aplicação de Avaliação Teórica PTR-BA 2º Trimestre - 2026. (1-87).xlsx'
    print(f'Parsing {f}...')
    wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb['Sheet1']
    records = []
    
    # Col A: ID, Col F: Total de pontos, Col I: Nome completo, Col L: Função, Col O: Aeroporto
    # Questions start from Col R (index 17) onwards, every 3 columns (response, points, comments)
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        if not row[0]:
            continue
            
        nome_original = str(row[8]).strip() if row[8] else ''
        nome_norm = normalize_name(nome_original)
        
        funcao_orig = str(row[11]).strip() if row[11] else ''
        funcao = normalize_funcao(funcao_orig)
        
        nota = float(row[5]) if row[5] is not None else 0.0
        
        # Match equipe from map
        equipe = 'Não identificada'
        if nome_norm in colaborador_map:
            equipe = colaborador_map[nome_norm]['equipe']
        else:
            # Fuzzy match
            import difflib
            matches = difflib.get_close_matches(nome_norm, colaborador_map.keys(), n=1, cutoff=0.75)
            if matches:
                equipe = colaborador_map[matches[0]]['equipe']
                
        # Questions points
        questoes = []
        q_idx = 1
        for col_idx in range(17, len(row), 3):
            if col_idx + 1 < len(row):
                pontos = row[col_idx + 1]
                if pontos is not None:
                    try:
                        questoes.append({
                            'num': q_idx,
                            'pontos': float(pontos)
                        })
                    except:
                        pass
                q_idx += 1
                
        records.append({
            'id': int(row[0]),
            'nome': nome_original,
            'funcao': funcao,
            'funcaoOriginal': funcao_orig,
            'aeroporto': 'SBGL',
            'nota': nota,
            'equipe': equipe,
            'questoes': questoes
        })
        
    wb.close()
    return records

def main():
    taf_records = parse_taf()
    tpepr_records = parse_tpepr()
    
    # Build colaborador map for teorica
    colaborador_map = {}
    for r in taf_records:
        n = normalize_name(r['nome'])
        if n and r['equipe']:
            colaborador_map[n] = {'equipe': r['equipe'], 'funcao': r['funcao']}
    for r in tpepr_records:
        n = normalize_name(r['nome'])
        if n and r['equipe'] and n not in colaborador_map:
            colaborador_map[n] = {'equipe': r['equipe'], 'funcao': r['funcao']}
            
    tr_records = parse_tr()
    teorica_records = parse_teorica(colaborador_map)
    
    seed_data = {
        'taf': {
            'records': taf_records,
            'uploadedAt': datetime.datetime.utcnow().isoformat() + 'Z'
        },
        'tpepr': {
            'records': tpepr_records,
            'uploadedAt': datetime.datetime.utcnow().isoformat() + 'Z'
        },
        'tr': {
            'records': tr_records,
            'uploadedAt': datetime.datetime.utcnow().isoformat() + 'Z'
        },
        'teorica': {
            'records': teorica_records,
            'uploadedAt': datetime.datetime.utcnow().isoformat() + 'Z'
        }
    }
    
    out_dir = 'dashboard/js'
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'seed-data.js')
    
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write("/**\n * SESCINC SBGL Dashboard — Seed Data\n * Automatically generated from Excel spreadsheets\n */\n\n")
        f.write("window.SESCINC = window.SESCINC || {};\n")
        f.write("window.SESCINC.SeedData = ")
        json.dump(seed_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"Seed data successfully written to {out_file}!")
    print(f"  TAF records: {len(taf_records)}")
    print(f"  TP-EPR records: {len(tpepr_records)}")
    print(f"  TR records: {len(tr_records)}")
    print(f"  Teorica records: {len(teorica_records)}")

if __name__ == '__main__':
    main()
