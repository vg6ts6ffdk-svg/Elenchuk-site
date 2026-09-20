import { createHash } from 'node:crypto';

const canonical = order => JSON.stringify({
  customerId: order.customerId ?? null,
  customerType: order.customerType,
  currency: order.currency,
  goodsSubtotalMinor: order.goodsSubtotalMinor,
  lines: order.lines,
  idempotencyKey: order.idempotencyKey
});
const fingerprint = order => createHash('sha256').update(canonical(order)).digest('hex');
const conflict = message => { const e=new Error(message); e.code='ORDER_CONFLICT'; return e; };

export function createSqliteOrderRepository(db){
  if(!db?.exec || !db?.prepare) throw new TypeError('SQLite database handle required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS commerce_orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_type TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      currency TEXT NOT NULL,
      goods_subtotal_minor INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      request_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer ON commerce_orders(customer_id, created_at DESC);
  `);
  const insert=db.prepare(`INSERT INTO commerce_orders(id,customer_id,customer_type,status,payment_status,currency,goods_subtotal_minor,idempotency_key,request_hash,snapshot_json,created_at,updated_at)
    VALUES(@id,@customer_id,@customer_type,@status,@payment_status,@currency,@goods_subtotal_minor,@idempotency_key,@request_hash,@snapshot_json,@created_at,@updated_at)`);
  const byKey=db.prepare('SELECT request_hash,snapshot_json FROM commerce_orders WHERE idempotency_key=?');
  const byId=db.prepare('SELECT snapshot_json FROM commerce_orders WHERE id=?');
  const byCustomer=db.prepare('SELECT snapshot_json FROM commerce_orders WHERE customer_id=? ORDER BY created_at DESC LIMIT ?');
  const update=db.prepare('UPDATE commerce_orders SET status=@status,payment_status=@payment_status,snapshot_json=@snapshot_json,updated_at=@updated_at WHERE id=@id AND status=@expected_status AND payment_status=@expected_payment_status');
  return {
    async create(order){
      const request_hash=fingerprint(order), now=new Date().toISOString(), snapshot_json=JSON.stringify(order);
      try{
        insert.run({id:order.id,customer_id:order.customerId??null,customer_type:order.customerType,status:order.status,payment_status:order.paymentStatus,currency:order.currency,goods_subtotal_minor:order.goodsSubtotalMinor,idempotency_key:order.idempotencyKey,request_hash,snapshot_json,created_at:order.createdAt,updated_at:now});
        return {order,replay:false};
      }catch(e){
        if(!String(e.code||'').includes('CONSTRAINT')) throw e;
        const existing=byKey.get(order.idempotencyKey);
        if(!existing||existing.request_hash!==request_hash) throw conflict('Idempotency key was already used for different order data');
        return {order:JSON.parse(existing.snapshot_json),replay:true};
      }
    },
    async get(id){const row=byId.get(id);return row?JSON.parse(row.snapshot_json):null;},
    async listByCustomer(customerId,limit=50){
      if(typeof customerId!=='string'||!customerId) throw new TypeError('Customer id required');
      const safe=Math.min(100,Math.max(1,Math.trunc(limit)||50));
      return byCustomer.all(customerId,safe).map(r=>JSON.parse(r.snapshot_json));
    },
    async replaceState(next,expected){
      if(!expected||typeof expected.status!=='string'||typeof expected.paymentStatus!=='string') throw new TypeError('Expected state required');
      const info=update.run({id:next.id,status:next.status,payment_status:next.paymentStatus,snapshot_json:JSON.stringify(next),updated_at:new Date().toISOString(),expected_status:expected.status,expected_payment_status:expected.paymentStatus});
      if(info.changes!==1) throw conflict('Order state changed concurrently');
      return next;
    }
  };
}

export function createPostgresOrderRepository(pool){
  if(typeof pool?.query!=='function') throw new TypeError('Postgres pool required');
  return {
    async initialize(){
      await pool.query(`CREATE TABLE IF NOT EXISTS commerce_orders (
        id TEXT PRIMARY KEY, customer_id TEXT, customer_type TEXT NOT NULL, status TEXT NOT NULL,
        payment_status TEXT NOT NULL, currency TEXT NOT NULL, goods_subtotal_minor BIGINT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL, snapshot_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer ON commerce_orders(customer_id, created_at DESC)');
    },
    async create(order){
      const hash=fingerprint(order);
      const inserted=await pool.query(`INSERT INTO commerce_orders(id,customer_id,customer_type,status,payment_status,currency,goods_subtotal_minor,idempotency_key,request_hash,snapshot_json,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) ON CONFLICT(idempotency_key) DO NOTHING RETURNING snapshot_json`,
        [order.id,order.customerId??null,order.customerType,order.status,order.paymentStatus,order.currency,order.goodsSubtotalMinor,order.idempotencyKey,hash,JSON.stringify(order),order.createdAt]);
      if(inserted.rowCount===1) return {order,replay:false};
      const existing=await pool.query('SELECT request_hash,snapshot_json FROM commerce_orders WHERE idempotency_key=$1',[order.idempotencyKey]);
      if(existing.rowCount!==1||existing.rows[0].request_hash!==hash) throw conflict('Idempotency key was already used for different order data');
      return {order:existing.rows[0].snapshot_json,replay:true};
    },
    async get(id){const r=await pool.query('SELECT snapshot_json FROM commerce_orders WHERE id=$1',[id]);return r.rows[0]?.snapshot_json??null;},
    async listByCustomer(customerId,limit=50){
      if(typeof customerId!=='string'||!customerId) throw new TypeError('Customer id required');
      const safe=Math.min(100,Math.max(1,Math.trunc(limit)||50));
      const r=await pool.query('SELECT snapshot_json FROM commerce_orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT $2',[customerId,safe]);return r.rows.map(x=>x.snapshot_json);
    },
    async replaceState(next,expected){
      const r=await pool.query(`UPDATE commerce_orders SET status=$1,payment_status=$2,snapshot_json=$3::jsonb,updated_at=NOW()
        WHERE id=$4 AND status=$5 AND payment_status=$6 RETURNING id`,
        [next.status,next.paymentStatus,JSON.stringify(next),next.id,expected.status,expected.paymentStatus]);
      if(r.rowCount!==1) throw conflict('Order state changed concurrently');
      return next;
    }
  };
}
