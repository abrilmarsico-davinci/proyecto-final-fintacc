"""Fintacc sprint 2 API: SQLite persistence, sessions and purchase validation."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import hashlib, hmac, json, os, secrets, sqlite3, time
from contextlib import contextmanager

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("FINTACC_DB", ROOT / "backend" / "fintacc.sqlite3"))
SESSION_HOURS = 24

@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', points INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS merchants(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, type TEXT NOT NULL, address TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS stores(id TEXT PRIMARY KEY, merchant_id INTEGER REFERENCES merchants(id), name TEXT NOT NULL, qr_token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active');
        CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), store_id TEXT NOT NULL REFERENCES stores(id), amount INTEGER NOT NULL CHECK(amount >= 1000), points INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, reviewed_at INTEGER, receipt TEXT);
        CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), target TEXT NOT NULL, stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS coupons(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), code TEXT NOT NULL UNIQUE, points INTEGER NOT NULL, discount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS movements(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), detail TEXT NOT NULL, points INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        """)
        initial = [('raiz','Almacén Raíz'),('brote','Brote Cocina Verde'),('masamadre','Masa Libre Panadería'),('lacuchara','La Cuchara Libre'),('verdeurquiza','Verde Urquiza')]
        for sid, name in initial:
            db.execute("INSERT OR IGNORE INTO stores(id,name,qr_token) VALUES(?,?,?)", (sid,name,'FINTACC-STORE-'+sid.upper()))
        seed_account(db, 'Lucía Demo', 'lucia@demo.com', 'Fintacc2026!', 'user', 820)
        seed_account(db, 'Comercio Demo', 'comercio@fintacc.com', 'Comercio2026!', 'merchant', 0)
        merchant=db.execute("SELECT id FROM users WHERE email='comercio@fintacc.com'").fetchone()
        db.execute("UPDATE stores SET merchant_id=? WHERE id='raiz' AND merchant_id IS NULL",(merchant['id'],))

def seed_account(db,name,email,password,role,points):
    if db.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone(): return
    salt=secrets.token_hex(16); cur=db.execute('INSERT INTO users(name,email,salt,password_hash,role,points,earned) VALUES(?,?,?,?,?,?,?)',(name,email,salt,pw_hash(password,salt),role,points,points))
    if points: db.execute('INSERT INTO movements(user_id,detail,points) VALUES(?,?,?)',(cur.lastrowid,'Saldo inicial demo',points))

def pw_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 240000).hex()

class API(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args): print('%s - %s' % (self.address_string(), fmt % args))
    def send_json(self, code, data):
        raw=json.dumps(data,ensure_ascii=False).encode(); self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store'); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization'); self.send_header('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS'); self.end_headers(); self.wfile.write(raw)
    def body(self):
        try: return json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))) or b'{}')
        except (ValueError, json.JSONDecodeError): raise ValueError('JSON inválido')
    def current(self, required=True):
        token=self.headers.get('Authorization','').removeprefix('Bearer ').strip()
        with connect() as db:
            row=db.execute('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',(token,int(time.time()))).fetchone()
        if not row and required: raise PermissionError('Iniciá sesión para continuar')
        return row
    def do_OPTIONS(self): self.send_json(204,{})
    def do_GET(self):
        path=urlparse(self.path).path
        try:
            if path.startswith('/backend/'):
                self.send_error(404); return
            if path.startswith('/api/'):
                if path=='/api/me':
                    u=self.current()
                    with connect() as db:
                        data=self.user_json(u); data['history']=[dict(r) for r in db.execute('SELECT detail,points,created_at AS date FROM movements WHERE user_id=? ORDER BY id DESC',(u['id'],))]; data['coupons']=[dict(r) for r in db.execute("SELECT code,points,discount,status FROM coupons WHERE user_id=? ORDER BY id DESC",(u['id'],))]
                    self.send_json(200,data); return
                if path=='/api/stores':
                    with connect() as db: rows=db.execute("SELECT id,name,qr_token FROM stores WHERE status='active'").fetchall()
                    self.send_json(200,[dict(r) for r in rows]); return
                if path=='/api/reviews':
                    with connect() as db: rows=db.execute('SELECT r.target,r.stars,r.text,r.created_at,u.name AS author FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC').fetchall()
                    self.send_json(200,[dict(r) for r in rows]); return
                if path=='/api/purchases':
                    u=self.current();
                    with connect() as db: rows=db.execute('SELECT p.id,p.amount,p.points,p.status,p.created_at,s.name AS store FROM purchases p JOIN stores s ON s.id=p.store_id WHERE p.user_id=? ORDER BY p.id DESC',(u['id'],)).fetchall()
                    self.send_json(200,[dict(r) for r in rows]); return
                if path=='/api/merchant/purchases':
                    u=self.current()
                    if u['role']!='merchant': self.send_json(403,{'error':'Se requiere una cuenta de comercio'}); return
                    with connect() as db: rows=db.execute("SELECT p.id,p.amount,p.points,p.created_at,s.name AS store FROM purchases p JOIN stores s ON s.id=p.store_id WHERE s.merchant_id=? AND p.status='pending' AND p.created_at>? ORDER BY p.created_at",(u['id'],int(time.time())-86400)).fetchall()
                    self.send_json(200,[dict(r) for r in rows]); return
                if path=='/api/merchant/stores':
                    u=self.current()
                    if u['role']!='merchant': self.send_json(403,{'error':'Se requiere una cuenta de comercio'}); return
                    with connect() as db: rows=db.execute("SELECT id,name,qr_token FROM stores WHERE merchant_id=? AND status='active'",(u['id'],)).fetchall()
                    self.send_json(200,[dict(r) for r in rows]); return
                self.send_json(404,{'error':'Ruta inexistente'}); return
            return super().do_GET()
        except PermissionError as e: self.send_json(401,{'error':str(e)})
    def user_json(self,u): return {'id':u['id'],'name':u['name'],'email':u['email'],'role':u['role'],'points':u['points'],'earned':u['earned']}
    def do_POST(self):
        path=urlparse(self.path).path
        try:
            d=self.body()
            if path in ('/api/auth/register','/api/auth/login'):
                email=str(d.get('email','')).strip().lower(); password=str(d.get('password',''))
                if len(password)<8 or '@' not in email: self.send_json(400,{'error':'Ingresá un email válido y una contraseña de al menos 8 caracteres'}); return
                with connect() as db:
                    if path.endswith('register'):
                        name=str(d.get('name','')).strip()
                        if len(name)<2: self.send_json(400,{'error':'Ingresá tu nombre'}); return
                        salt=secrets.token_hex(16); cur=db.execute('INSERT INTO users(name,email,salt,password_hash,points,earned) VALUES(?,?,?,?,50,50)',(name,email,salt,pw_hash(password,salt))); uid=cur.lastrowid
                        db.execute("INSERT INTO movements(user_id,detail,points) VALUES(?,?,50)",(uid,'Bono de bienvenida'))
                    else:
                        user=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                        if not user or not hmac.compare_digest(user['password_hash'],pw_hash(password,user['salt'])): self.send_json(401,{'error':'Email o contraseña incorrectos'}); return
                        uid=user['id']
                    token=secrets.token_urlsafe(36); db.execute('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)',(token,uid,int(time.time())+SESSION_HOURS*3600)); user=db.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
                self.send_json(201 if path.endswith('register') else 200,{'token':token,'user':self.user_json(user)}); return
            if path=='/api/auth/logout':
                token=self.headers.get('Authorization','').removeprefix('Bearer ').strip()
                with connect() as db: db.execute('DELETE FROM sessions WHERE token=?',(token,))
                self.send_json(200,{'ok':True}); return
            if path=='/api/merchants':
                name=str(d.get('name','')).strip(); email=str(d.get('email','')).strip().lower(); kind=str(d.get('type','')).strip(); address=str(d.get('address','')).strip()
                if not name or '@' not in email or not kind or not address: self.send_json(400,{'error':'Completá todos los campos con un email válido'}); return
                with connect() as db: cur=db.execute('INSERT INTO merchants(name,email,type,address) VALUES(?,?,?,?)',(name,email,kind,address)); mid=cur.lastrowid
                self.send_json(201,{'id':mid,'status':'pending','message':'Solicitud recibida. El equipo revisará los datos del comercio.'}); return
            if path=='/api/reviews':
                u=self.current(); target=str(d.get('target','')).strip(); text=str(d.get('text','')).strip(); stars=int(d.get('stars',0))
                if not target or len(text)<10 or stars not in range(1,6): self.send_json(400,{'error':'Elegí de 1 a 5 estrellas y escribí al menos 10 caracteres'}); return
                with connect() as db: db.execute('INSERT INTO reviews(user_id,target,stars,text) VALUES(?,?,?,?)',(u['id'],target,stars,text))
                self.send_json(201,{'ok':True}); return
            if path=='/api/purchases':
                u=self.current(); store=str(d.get('store','')); token=str(d.get('qr_token','')); amount=int(d.get('amount',0))
                if amount<1000: self.send_json(400,{'error':'La compra debe ser de al menos $1.000'}); return
                with connect() as db:
                    s=db.execute("SELECT id FROM stores WHERE id=? AND qr_token=? AND status='active'",(store,token)).fetchone()
                    if not s: self.send_json(400,{'error':'QR de comercio inválido'}); return
                    day=int(time.time())-86400; count=db.execute('SELECT COUNT(*) FROM purchases WHERE user_id=? AND created_at>?',(u['id'],day)).fetchone()[0]
                    if count>=5: self.send_json(429,{'error':'Alcanzaste el máximo de 5 compras por día'}); return
                    points=amount//1000; cur=db.execute('INSERT INTO purchases(user_id,store_id,amount,points,created_at) VALUES(?,?,?,?,?)',(u['id'],store,amount,points,int(time.time())))
                self.send_json(201,{'id':cur.lastrowid,'status':'pending','points_pending':points,'expires_in_hours':24}); return
            if path.startswith('/api/merchant/purchases/') and path.endswith('/confirm'):
                u=self.current();
                if u['role']!='merchant': self.send_json(403,{'error':'Se requiere una cuenta de comercio'}); return
                pid=int(path.split('/')[-2]); receipt=str(d.get('receipt','')).strip()
                if len(receipt)<4: self.send_json(400,{'error':'Ingresá el número de ticket (mínimo 4 caracteres)'}); return
                with connect() as db:
                    p=db.execute("SELECT p.*,s.merchant_id FROM purchases p JOIN stores s ON s.id=p.store_id WHERE p.id=? AND p.status='pending' AND p.created_at>?",(pid,int(time.time())-86400)).fetchone()
                    if not p: self.send_json(404,{'error':'Compra pendiente inexistente o vencida'}); return
                    if not p['merchant_id'] or p['merchant_id']!=u['id']: self.send_json(403,{'error':'La compra corresponde a otro comercio'}); return
                    db.execute("UPDATE purchases SET status='confirmed',reviewed_at=?,receipt=? WHERE id=?",(int(time.time()),receipt,pid)); db.execute('UPDATE users SET points=points+?,earned=earned+? WHERE id=?',(p['points'],p['points'],p['user_id'])); db.execute('INSERT INTO movements(user_id,detail,points) VALUES(?,?,?)',(p['user_id'],'Compra validada en comercio aliado',p['points']))
                self.send_json(200,{'ok':True,'points':p['points']}); return
            if path=='/api/coupons':
                u=self.current(); costs={250:(250,2500),500:(500,6000),1000:(1000,14000)}; amount=int(d.get('points',0))
                if amount not in costs: self.send_json(400,{'error':'Canje no disponible'}); return
                cost,discount=costs[amount]
                with connect() as db:
                    cur=db.execute('UPDATE users SET points=points-? WHERE id=? AND points>=?',(cost,u['id'],cost))
                    if not cur.rowcount: self.send_json(400,{'error':'No tenés puntos suficientes'}); return
                    code=secrets.token_hex(4).upper(); db.execute('INSERT INTO coupons(user_id,code,points,discount) VALUES(?,?,?,?)',(u['id'],code,cost,discount)); db.execute('INSERT INTO movements(user_id,detail,points) VALUES(?,?,?)',(u['id'],f'Canje de ${discount}',-cost))
                self.send_json(201,{'code':code,'points':cost,'discount':discount,'status':'active'}); return
            self.send_json(404,{'error':'Ruta inexistente'})
        except PermissionError as e: self.send_json(401,{'error':str(e)})
        except (ValueError,TypeError,json.JSONDecodeError) as e: self.send_json(400,{'error':str(e) or 'Solicitud inválida'})
        except sqlite3.IntegrityError: self.send_json(409,{'error':'Ese email ya tiene una cuenta'})

if __name__=='__main__':
    init_db(); port=int(os.environ.get('PORT','8000')); print(f'Fintacc en http://localhost:{port} · SQLite: {DB_PATH}'); ThreadingHTTPServer(('127.0.0.1',port),API).serve_forever()
