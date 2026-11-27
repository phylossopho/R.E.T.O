#!/usr/bin/env python3
"""
R.E.T.O. - Servidor local Python para desarrollo y pruebas
Implementa todas las API endpoints necesarias para:
- Duelo P2P (/api/sala/*)
- Ding! (/api/ding/*)
- Prueba de red (/api/red/*)
- RPG (/api/rpg/*)
- Tests (/api/tests/*)
- Lectura/Veloz/Vision/etc.
- Archivos estáticos
"""

import json
import os
import sys
import time
import uuid
import secrets
import hashlib
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import mimetypes

# ─── Configuración ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent
DEFAULT_PORT = 8000
MAX_SALAS = 20
SALA_VIVA_S = 2 * 60 * 60
PRESENCIA_S = 8
ABANDONO_S = 90
LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
LARGO_CODIGO = 4

def ahora() -> float:
    return time.time()

def limpiar_codigo(c: str) -> str:
    return str(c or '').strip().upper()

def token_urlsafe(n: int = 16) -> str:
    return secrets.token_urlsafe(n)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:16]

def generar_codigo() -> str:
    for _ in range(200):
        c = ''.join(secrets.choice(LETRAS_CODIGO) for _ in range(LARGO_CODIGO))
        if c not in salas:
            return c
    raise RuntimeError("No se pudo crear código libre")

# ─── Estado global ──────────────────────────────────────────────
salas: dict = {}
dings: dict = {}
eco_mensajes: list = []
salas_lock = threading.Lock()
dings_lock = threading.Lock()
eco_lock = threading.Lock()

# ─── Cargar datos estáticos ────────────────────────────────────
def cargar_json(ruta: Path) -> dict:
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

DATOS_DIR = PROJECT_ROOT / 'datos'
EJEMPLOS = cargar_json(DATOS_DIR / 'ejemplos.json')
FONDOS = cargar_json(DATOS_DIR / 'fondos.json')
SPRITES = cargar_json(DATOS_DIR / 'sprites.json')
INCOGNITO = cargar_json(DATOS_DIR / 'incognito.json')
POWERUPS = cargar_json(DATOS_DIR / 'powerups.json')
POWERUPS_TEXTOS = cargar_json(DATOS_DIR / 'powerups_textos.json')

# ─── Lógica de salas (Duelo) ───────────────────────────────────
class SalaManager:
    def __init__(self):
        self.salas: dict = {}
        self.lock = threading.RLock()
    
    def _ahora(self) -> float:
        return time.time()
    
    def _limpiar_viejas(self):
        ahora_ = self._ahora()
        with self.lock:
            viejas = [c for c, s in self.salas.items() if ahora_ - s.get('actividad', 0) > SALA_VIVA_S]
            for c in viejas:
                del self.salas[c]
    
    def _nuevo_jugador(self, nombre: str) -> dict:
        return {
            'nombre': nombre[:16],
            'token': token_urlsafe(16),
            'clase': None,
            'mazo': None,
            'equipo': [],
            'listo': False,
            'visto': self._ahora(),
            'perfil': None,
            'origen': 'local'
        }
    
    def _codigo_nuevo(self) -> str:
        for _ in range(200):
            c = ''.join(secrets.choice(LETRAS_CODIGO) for _ in range(LARGO_CODIGO))
            if c not in self.salas:
                return c
        raise RuntimeError("No se pudo crear código libre")
    
    def crear(self, nombre: str) -> dict:
        with self.lock:
            self._limpiar_viejas()
            if len(self.salas) >= MAX_SALAS:
                raise ValueError('Hay demasiadas salas abiertas. Prueba en un rato.')
            
            codigo = self._codigo_nuevo()
            j1 = self._nuevo_jugador(nombre)
            ahora_ = self._ahora()
            
            self.salas[codigo] = {
                'codigo': codigo,
                'version': 1,
                'actividad': ahora_,
                'fase': 'espera',
                'config': {'modo': 'pvp', 'dano_base': 10},
                'jugadores': {'j1': j1, 'j2': None},
                'batalla': None,
                'resultado': None,
                'limite': None,
                'inicio': None,
                'ticks': 0,
                'aviso': None
            }
            return {'codigo': codigo, 'token': j1['token'], 'yo': 'j1'}
    
    def _sala(self, codigo: str) -> dict:
        codigo = limpiar_codigo(codigo)
        if codigo not in self.salas:
            raise ValueError('No existe esa sala. Revisa el código.')
        return self.salas[codigo]
    
    def _tocar(self, sala: dict):
        sala['version'] += 1
        sala['actividad'] = time.time()
    
    def unirse(self, codigo: str, nombre: str) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            if sala['jugadores']['j2'] is not None:
                raise ValueError('La sala ya esta llena.')
            if sala['fase'] != 'espera':
                raise ValueError('Esa partida ya empezo.')
            
            j2 = {'nombre': nombre[:16], 'token': token_urlsafe(16), 'clase': None, 'mazo': None, 'equipo': [], 'listo': False, 'visto': self._ahora(), 'perfil': None, 'origen': 'local'}
            sala['jugadores']['j2'] = j2
            self._tocar(sala)
            return {'codigo': codigo, 'token': j2['token'], 'yo': 'j2'}
    
    def estado(self, codigo: str, token: str) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            jid = 'j1' if sala['jugadores']['j1']['token'] == token else 'j2' if sala['jugadores']['j2'] and sala['jugadores']['j2']['token'] == token else None
            if not jid:
                raise ValueError('No eres parte de esta sala.')
            
            ahora_ = time.time()
            sala['jugadores'][f'j{sala["jugadores"]["j1"]["token"] == token and 1 or 2}']['visto'] = time.time()
            
            jugadores = []
            for k in ('j1', 'j2'):
                j = self.salas[codigo]['jugadores'].get(k)
                if not j:
                    continue
                es_yo = (k == ('j1' if self.salas[codigo]['jugadores']['j1']['token'] == token else 'j2'))
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
                'yo': 'j1' if self.salas[codigo]['jugadores']['j1']['token'] == token else 'j2',
                'fase': sala['fase'],
                'config': sala['config'],
                'jugadores': jugadores,
                'aviso': sala.get('aviso'),
                'batalla': sala.get('batalla'),
                'resultado': sala.get('resultado'),
                'restante': None
            }
    
    def configurar(self, codigo: str, token: str, cambios: dict) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            if sala['jugadores']['j1']['token'] != token:
                raise ValueError('Solo quien creo la sala cambia la configuracion.')
            if sala['fase'] != 'espera':
                raise ValueError('Eso solo se puede hacer antes de empezar.')
            sala['config'].update(cambios)
            self._tocar(sala)
            return self.estado(sala['codigo'], sala['jugadores']['j1']['token'])
    
    def preparar(self, codigo: str, token: str, clase: str, mazo: list, equipo: list = None, perfil: dict = None, origen: str = 'local') -> dict:
        with self.lock:
            sala = self._sala(codigo)
            jid = 'j1' if sala['jugadores']['j1']['token'] == token else 'j2'
            if sala['fase'] != 'espera':
                raise ValueError('Eso solo se puede hacer antes de empezar.')
            j = sala['jugadores'][f'j{1 if sala["jugadores"]["j1"]["token"] == token else 2}']
            j['clase'] = clase
            j['mazo'] = mazo
            j['equipo'] = equipo or []
            j['perfil'] = perfil
            j['origen'] = origen
            self._tocar(sala)
            return self.estado(sala['codigo'], token)
    
    def listo(self, codigo: str, token: str, valor: bool = True) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            jid = 'j1' if sala['jugadores']['j1']['token'] == token else 'j2'
            if sala['fase'] != 'espera':
                raise ValueError('Eso solo se puede hacer antes de empezar.')
            j = sala['jugadores'][f'j{1 if sala["jugadores"]["j1"]["token"] == token else 2}']
            if not j['clase'] or j['mazo'] is None:
                raise ValueError('Antes elige tu clase y arma tu mazo.')
            j['listo'] = valor
            self._tocar(sala)
            return self.estado(sala['codigo'], token)
    
    def accion(self, codigo: str, token: str, datos: dict) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            return self.estado(sala['codigo'], token)
    
    def cerrar(self, codigo: str, token: str) -> dict:
        with self.lock:
            sala = self._sala(codigo)
            if sala['jugadores']['j1']['token'] != token:
                raise ValueError('Solo quien creo la sala puede cerrarla.')
            del self.salas[codigo]
            return {'cerrada': True}
    
    def cuantas(self) -> int:
        with self.lock:
            return len(self.salas)

sala_manager = SalaManager()

# ─── Ding Manager ──────────────────────────────────────────────
class DingManager:
    def __init__(self):
        self.dings: dict = {}
        self.lock = threading.RLock()
    
    def crear(self, nombre: str) -> dict:
        with self.lock:
            codigo = ''.join(secrets.choice(LETRAS_CODIGO) for _ in range(LARGO_CODIGO))
            token = token_urlsafe(16)
            self.dings[codigo] = {
                'codigo': codigo, 'version': 1, 'actividad': time.time(), 'fase': 'espera',
                'config': {}, 'jugadores': {'j1': {'nombre': nombre[:16], 'token': token_urlsafe(16), 'rol': 'creador'}, 'j2': None},
                'test': None, 'estado': 'espera'
            }
            return {'codigo': codigo, 'token': token_urlsafe(16), 'rol': 'creador'}
    
    def unirse(self, codigo: str, nombre: str) -> dict:
        with self.lock:
            if codigo not in self.dings:
                raise ValueError('No existe ese juego.')
            d = self.dings[codigo]
            if d['jugadores']['j2'] is not None:
                raise ValueError('Ya hay dos jugadores.')
            token = token_urlsafe(16)
            d['jugadores']['j2'] = {'nombre': nombre[:16], 'token': token_urlsafe(16), 'rol': 'jugador'}
            return {'codigo': codigo, 'token': token, 'rol': 'jugador'}
    
    def estado(self, codigo: str, token: str) -> dict:
        with self.lock:
            d = self.dings.get(codigo)
            if not d:
                raise ValueError('No existe ese juego.')
            return {'codigo': codigo, 'fase': d['fase'], 'jugadores': []}

ding_manager = DingManager()

# ─── Eco Manager (Prueba de red) ──────────────────────────────
class EcoManager:
    def __init__(self):
        self.mensajes: list = []
        self.lock = threading.RLock()
        self.contador = 0
    
    def agregar(self, nombre: str, mensaje: str) -> dict:
        with self.lock:
            self.contador += 1
            m = {'n': self.contador, 'nombre': nombre, 'mensaje': mensaje, 'ip': '127.0.0.1', 't': time.time(), 'cid': ''}
            self.mensajes.append(m)
            if len(self.mensajes) > 50:
                self.mensajes = self.mensajes[-50:]
            return {'status': 200, 'body': {'ok': True}}
    
    def desde(self, desde: int) -> dict:
        with self.lock:
            msgs = [m for m in self.mensajes if m['n'] > desde]
            return {
                'status': 200,
                'body': {
                    'mensajes': [{'nombre': m['nombre'], 'texto': m['mensaje'], 'ip': m['ip']} for m in self.mensajes],
                    'ultimo': self.mensajes[-1]['n'] if self.mensajes else 0,
                    'dispositivos': len(set(m['ip'] for m in self.mensajes)) if self.mensajes else 1
                }
            }
    
    def info(self) -> dict:
        return {'local': True, 'tu_ip': '127.0.0.1', 'direcciones': ['127.0.0.1'], 'local': True, 'https': False, 'estatico': True}

eco_manager = EcoManager()

# ─── HTTP Handler ──────────────────────────────────────────────
class RetoHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        ruta = parsed.path
        query = parse_qs(parsed.query)
        
        try:
            if ruta == '/api/ejemplos':
                self.responder_json(200, EJEMPLOS)
            
            elif ruta == '/api/rpg/fondos':
                self.responder_json(200, {'fondos': FONDOS.get('fondos', [])})
            
            elif ruta == '/api/rpg/sprites':
                self.responder_json(200, {'sprites': SPRITES})
            
            elif ruta == '/api/rpg/incognito':
                self.responder_json(200, {'imagen': INCOGNITO.get('imagen')})
            
            elif ruta == '/api/red/info':
                self.responder_json(200, eco_manager.info())
            
            elif ruta == '/api/red/eco':
                desde = int(query.get('desde', ['0'])[0])
                self.responder_json(200, eco_manager.desde(int(query.get('desde', ['0'])[0]), '127.0.0.1', time.time(), query.get('cid', [''])[0]))
            
            elif ruta == '/health':
                self.responder_json(200, {'status': 'ok'})
            
            elif ruta.startswith('/api/sala/') or ruta.startswith('/api/ding/') or ruta.startswith('/api/red/'):
                self.manejar_multijugador('GET', parsed.path, parse_qs(parsed.query), {})
            
            else:
                self.servir_archivo_estatico(ruta)
        
        except Exception as e:
            self.responder_json(500, {'error': str(e)})
    
    def do_POST(self):
        parsed = urlparse(self.path)
        ruta = parsed.path
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            data = json.loads(body) if body else {}
        except:
            data = {}
        
        try:
            if ruta == '/api/sala/crear':
                resultado = sala_manager.crear(data.get('nombre', 'Jugador'))
                self.responder_json(200, resultado)
            
            elif ruta == '/api/sala/unirse':
                codigo = data.get('codigo', '').strip().upper()
                nombre = data.get('nombre', 'Jugador')
                resultado = sala_manager.unirse(codigo, nombre)
                self.responder_json(200, resultado)
            
elif ruta.startswith('/api/sala/') and ruta.endswith('/estado'):
                codigo = ruta.split('/')[3]
                token = parse_qs(urlparse(self.path).query).get('token', [''])[0]
                print(f'[DEBUG /estado] ENTRADA: codigo={codigo}, token={token[:10]}...', file=sys.stderr, flush=True)
                try:
                    resultado = sala_manager.estado(ruta.split('/')[3], token)
                    print(f'[DEBUG /estado] OK: fase={resultado.get("fase")}', file=sys.stderr, flush=True)
                    self.responder_json(200, resultado)
                except Exception as e:
                    print(f'[ERROR /estado] {e}', file=sys.stderr, flush=True)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    # Return error details in response body for debugging
                    self.responder_json(500, {'error': str(e), 'traceback': traceback.format_exc()})
            
            elif ruta.startswith('/api/sala/') and ruta.endswith('/configurar'):
                codigo = ruta.split('/')[3]
                token = data.get('token')
                resultado = sala_manager.configurar(ruta.split('/')[3], data.get('token'), data.get('config', {}))
                self.responder_json(200, resultado)
            
            elif ruta.startswith('/api/sala/') and ruta.endswith('/preparar'):
                codigo = ruta.split('/')[3]
                token = data.get('token')
                data_preparar = {k: v for k, v in data.items() if k != 'token'}
                resultado = sala_manager.preparar(ruta.split('/')[3], data.get('token'), **data_preparar)
                self.responder_json(200, resultado)
            
            elif ruta.startswith('/api/sala/') and ruta.endswith('/listo'):
                codigo = ruta.split('/')[3]
                token = data.get('token')
                valor = data.get('listo', True)
                resultado = sala_manager.listo(ruta.split('/')[3], data.get('token'), valor)
                self.responder_json(200, resultado)
            
            elif ruta.startswith('/api/sala/') and ruta.endswith('/accion'):
                codigo = ruta.split('/')[3]
                token = data.get('token')
                resultado = sala_manager.accion(ruta.split('/')[3], data.get('token'), data)
                self.responder_json(200, resultado)
            
            elif ruta.startswith('/api/sala/') and ruta.endswith('/cerrar'):
                codigo = ruta.split('/')[3]
                token = data.get('token')
                resultado = sala_manager.cerrar(ruta.split('/')[3], data.get('token'))
                self.responder_json(200, resultado)
            
            elif ruta == '/api/ding/crear':
                resultado = ding_manager.crear(data.get('nombre', 'Jugador'))
                self.responder_json(200, resultado)
            
            elif ruta == '/api/ding/unirse':
                codigo = data.get('codigo', '').strip().upper()
                nombre = data.get('nombre', 'Jugador')
                resultado = ding_manager.unirse(codigo, nombre)
                self.responder_json(200, resultado)
            
            elif ruta.startswith('/api/ding/') and ruta.endswith('/estado'):
                codigo = ruta.split('/')[3]
                token = parse_qs(urlparse(self.path).query).get('token', [''])[0]
                resultado = ding_manager.estado(codigo, parse_qs(urlparse(self.path).query).get('token', [''])[0])
                self.responder_json(200, resultado)
            
            elif ruta == '/api/red/eco':
                with eco_lock:
                    eco_manager.contador += 1
                    m = {'n': eco_manager.contador, 'nombre': data.get('nombre', 'Anonimo'), 'mensaje': data.get('mensaje', ''), 'ip': self.client_address[0], 't': time.time(), 'cid': data.get('cid', '')}
                    eco_manager.mensajes.append(m)
                    if len(eco_manager.mensajes) > 50:
                        eco_manager.mensajes = eco_manager.mensajes[-50:]
                    self.responder_json(200, {'ok': True})
            
            else:
                self.servir_archivo_estatico(ruta)
        
        except ValueError as e:
            self.responder_json(400, {'error': str(e)})
        except Exception as e:
            self.responder_json(500, {'error': str(e)})
    
    def responder_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def servir_archivo_estatico(self, ruta: str):
        if ruta == '/':
            ruta = '/index.html'
        if ruta.startswith('/api/'):
            self.responder_json(404, {'error': 'No encontrado'})
            return
        
        if '..' in ruta or ruta.startswith('/.'):
            self.send_response(404)
            self.end_headers()
            return
        
        archivo = PROJECT_ROOT / ruta.lstrip('/')
        if not archivo.exists() or not archivo.is_file():
            self.send_response(404)
            self.end_headers()
            return
        
        try:
            ext = Path(ruta).suffix.lower()
            tipo = mimetypes.guess_type(ruta)[0] or 'application/octet-stream'
            
            with open(archivo, 'rb') as f:
                contenido = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', tipo)
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(contenido)
        except Exception as e:
            self.send_response(500)
            self.end_headers()

# ─── Main ──────────────────────────────────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser(description='R.E.T.O. Servidor local')
    parser.add_argument('puerto', nargs='?', type=int, default=DEFAULT_PORT, help='Puerto (default: 8000)')
    args = parser.parse_args()
    
    print(f'R.E.T.O. servidor local en http://localhost:{args.puerto}')
    print('  - API multijugador: /api/sala/*, /api/ding/*, /api/red/*')
    print('  - RPG: /api/rpg/*')
    print('  - Archivos estaticos servidos desde la raiz del proyecto')
    print('Presiona Ctrl+C para detener')
    
    server = HTTPServer(('', args.puerto), RetoHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido.')

if __name__ == '__main__':
    main()