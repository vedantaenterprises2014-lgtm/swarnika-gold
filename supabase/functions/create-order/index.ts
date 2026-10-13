import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ORIGIN = 'https://vedantaenterprises2014-lgtm.github.io';
const cors = {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const clean=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST'||req.headers.get('origin')!==ORIGIN) return reply({error:'Request not allowed.'},403);
  try {
    const body=await req.json();
    const name=clean(body?.customer?.name,100), phone=clean(body?.customer?.phone,24), email=clean(body?.customer?.email,254).toLowerCase();
    const address=body?.customer?.address, method=body?.paymentMethod, lines=Array.isArray(body?.items)?body.items:[];
    if(name.length<2||! /^[+0-9 ()-]{8,24}$/.test(phone)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({error:'Please check the customer name, phone and email.'},400);
    if(!address||typeof address!=='object'||['line1','area','city','state','pin'].some(k=>!clean(address[k],160))) return reply({error:'Please complete the delivery address.'},400);
    if(!['razorpay','cod'].includes(method)) return reply({error:'Choose a supported payment method.'},400);
    if(!lines.length||lines.length>25) return reply({error:'Your cart is empty or too large.'},400);
    const quantities=new Map<string,number>();
    for(const line of lines){const id=clean(line?.id,80),q=Number(line?.quantity);if(!id||!Number.isInteger(q)||q<1||q>20)return reply({error:'A cart quantity is invalid.'},400);quantities.set(id,(quantities.get(id)||0)+q);}
    const ids=[...quantities.keys()];
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const{data:products,error:pErr}=await db.from('products').select('id,name,price,category,stock,image_url').in('id',ids);
    if(pErr||!products||products.length!==ids.length)return reply({error:'A product is no longer available. Refresh the shop and try again.'},409);
    for(const p of products)if(Number(p.stock)<quantities.get(String(p.id))!)return reply({error:p.name+' does not have enough stock.'},409);
    const items=products.map(p=>({product_id:p.id,name:p.name,category:p.category,quantity:quantities.get(String(p.id))!,unit_price_rupees:Number(p.price),image_url:p.image_url}));
    const subtotal=items.reduce((sum,x)=>sum+Math.round(x.unit_price_rupees*100)*x.quantity,0);
    const couponCode=clean(body?.couponCode,40).toUpperCase();let discount=0;
    if(couponCode){const{data:c}=await db.from('discount_coupons').select('*').eq('code',couponCode).eq('active',true).maybeSingle();if(!c||(c.expires_at&&Date.parse(c.expires_at)<=Date.now())||subtotal<Number(c.minimum_order_paise))return reply({error:'That discount code is not valid for this order.'},400);discount=c.discount_type==='percent'?Math.floor(subtotal*Math.min(Number(c.discount_value),100)/100):Math.min(subtotal,Number(c.discount_value)*100);}
    const total=subtotal-discount;if(total<100)return reply({error:'The order total must be at least ₹1.'},400);
    const orderNumber='SW'+new Date().toISOString().slice(2,10).replaceAll('-','')+crypto.randomUUID().slice(0,6).toUpperCase();
    const{data:order,error:saveErr}=await db.from('orders').insert({order_number:orderNumber,customer_name:name,customer_phone:phone,customer_email:email,delivery_address:address,items,subtotal_paise:subtotal,discount_paise:discount,total_paise:total,coupon_code:couponCode||null,payment_method:method}).select('id,order_number,total_paise').single();
    if(saveErr||!order)return reply({error:'We could not save this order. Please try again.'},500);
    if(method==='cod')return reply({orderId:order.id,orderNumber,total,subtotal,discount,paymentMethod:'cod'});
    const keyId=Deno.env.get('RAZORPAY_KEY_ID'),secret=Deno.env.get('RAZORPAY_KEY_SECRET');
    if(!keyId||!secret){await db.from('orders').update({order_status:'cancelled',payment_status:'failed'}).eq('id',order.id);return reply({error:'Online payment is being set up. Please choose Cash on Delivery for now.'},503);}
    const gateway=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:'Basic '+btoa(keyId+':'+secret),'Content-Type':'application/json'},body:JSON.stringify({amount:total,currency:'INR',receipt:orderNumber,notes:{shop_order_id:order.id}})});
    const result=await gateway.json();if(!gateway.ok||!result.id){await db.from('orders').update({order_status:'cancelled',payment_status:'failed'}).eq('id',order.id);return reply({error:'Online payment could not start. Try again or choose Cash on Delivery.'},502);}
    const{error:linkErr}=await db.from('orders').update({razorpay_order_id:result.id}).eq('id',order.id);if(linkErr)return reply({error:'Payment setup failed. Please contact the shop before retrying.'},500);
    return reply({orderId:order.id,orderNumber,amount:total,currency:'INR',keyId,razorpayOrderId:result.id,subtotal,discount,paymentMethod:'razorpay'});
  } catch {return reply({error:'We could not place the order. Please try again.'},400);}
});
