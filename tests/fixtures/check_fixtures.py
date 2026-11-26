import json
with open(r'C:\Users\Jorge\Downloads\R_E_T_O_gemini_estatico-js\R.E.T.O_gemini\tests\fixtures\salas.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for idx, caso in enumerate(data['sala']):
    for op_idx, op in enumerate(caso['ops']):
        if 'r' in op and 'ok' in op['r'] and 'batalla' in op['r']['ok']:
            batalla = op['r']['ok']['batalla']
            if batalla is not None and 'rival' in batalla and 'clase' in batalla['rival']:
                c = batalla['rival']['clase']
                fase = batalla.get('fase')
                if c is None:
                    print(f'sala[{idx}] ops[{op_idx}]: fase={fase}, rival.clase=null -> should be actual class')
                else:
                    print(f'sala[{idx}] ops[{op_idx}]: fase={fase}, rival.clase={c}')