with open(r'C:\Users\Jorge\Downloads\R_E_T_O_gemini_estatico-js\R_E_T_O_gemini\server.py', 'rb') as f:
    content = f.read()

# Find the estado method and replace it entirely
idx_start = content.find(b'def estado(self, codigo: str, token: str, firma: str = None) -> dict:')
idx_end = content.find(b'    def configurar(self, codigo: str, token: str, cambios: dict) -> dict:')

if idx_start >= 0 and idx_end >= 0:
    # New estado method without extra braces
    new_estado = b'''def estado(self, codigo: str, token: str, firma: str = None) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            jid = 'j1' if sala['jugadores']['j1']['token'] == token else 'j2' if sala['jugadores']['j2'] and sala['jugadores']['j2']['token'] == token else None
            if not jid:
                raise ValueError('No eres parte de esta sala.')
            
            ahora_ = time.time()
            sala['jugadores'][f'j{sala["jugadores"]["j1"]["token"] == token and 1 or 2}']['visto'] = time.time()
            
            jugadores = []
            for k in ('j1', 'j2'):
                j = self.salas[sala['codigo']]['jugadores'].get(k)
                if not j:
                    continue
                es_yo = (k == ('j1' if self.salas[sala['codigo']]['jugadores']['j1']['token'] == token else 'j2'))
                jugadores.append({
                    'id': k,
                    'nombre': j['nombre'],
                    'clase': j['clase'] if es_yo else None,
                    'tiene_clase': j['clase'] is not None,
                    'listo': j['listo'],
                    'mazo': len(j['mazo']) if j['mazo'] else 0,
                    'conectado': True,
                    'equipo': len(j['equipo']) if j['equipo'] else 0,
                    'nivel': 0,
                    'origen': j.get('origen', 'local'),
                    'perfil': j.get('perfil')
                })
            
            return {
                'cambio': True,
                'firma': '1',
                'codigo': sala['codigo'],
                'yo': 'j1' if self.salas[sala['codigo']]['jugadores']['j1']['token'] == token else 'j2',
                'fase': sala['fase'],
                'config': sala['config'],
                'jugadores': jugadores,
                'aviso': sala.get('aviso'),
                'batalla': sala.get('batalla'),
                'resultado': sala.get('resultado'),
                'restante': None
            }'''

    new_content = content[:idx_start] + new_estado + b'\n    ' + content[idx_end:]
    with open(r'C:\Users\Jorge\Downloads\R_E_T_O_gemini_estatico-js\R_E_T_O_gemini\server.py', 'wb') as f:
        f.write(new_content)
    print('Fixed estado method')
else:
    print('Could not find estado or configurar methods')