import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ORIGIN='https://vedantaenterprises2014-lgtm.github.io';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST'||req.headers.get('origin')!==ORIGIN)return reply({error:'Request not allowed.'},403);
 try{
  const body=await req.json(),orderId=String(body?.orderId||''),paymentId=String(body?.razorpayPaymentId||''),gatewayOrderId=String(body?.razorpayOrderId||''),signature=String(body?.razorpaySignature||'').toLowerCase();
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!paymentId.startsWith('pay_')||!gatewayOrderId.startsWith('order_')||! /^[0-9a-f]{64}$/.test(signature))return reply({error:'Payment response is incomplete.'},400);
  const keyId=Deno.env.get('RAZORPAY_KEY_ID'),secret=Deno.env.get('RAZORPAY_KEY_SECRET');if(!keyId||!secret)return reply({error:'Online payment is not configured.'},503);
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(gatewayOrderId+'|'+paymentId)));
  const expected=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');let mismatch=expected.length^signature.length;
  for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^(signature.charCodeAt(i)||0);if(mismatch)return reply({error:'Payment could not be verified.'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const{data:order,error:readErr}=await db.from('orders').select('id,order_number,total_paise,razorpay_order_id,payment_status,customer_name,customer_phone,items,payment_method').eq('id',orderId).single();
  if(readErr||!order||order.razorpay_order_id!==gatewayOrderId)return reply({error:'Payment does not match this order.'},404);
  if(order.payment_status==='paid')return reply({orderNumber:order.order_number,paymentStatus:'paid'});
  const res=await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId),{headers:{Authorization:'Basic '+btoa(keyId+':'+secret)}}),payment=await res.json();
  if(!res.ok||payment.order_id!==gatewayOrderId||payment.amount!==order.total_paise||payment.currency!=='INR'||payment.status!=='captured')return reply({error:'Payment is not confirmed yet. If money was deducted, contact Swarnika with your order number.'},409);
  const{data:updated,error:updateErr}=await db.from('orders').update({payment_status:'paid',order_status:'confirmed',razorpay_payment_id:paymentId,updated_at:new Date().toISOString()}).eq('id',orderId).eq('payment_status','pending').select('id').maybeSingle();
  if(updateErr)return reply({error:'Payment received; order status is being reconciled.'},500);
  if(updated){const itemText=(order.items||[]).map((x:any)=>x.name+' × '+x.quantity).join(', ').slice(0,300);await notifyOwner({orderNumber:order.order_number,name:order.customer_name,phone:order.customer_phone,total:order.total_paise,method:'Paid online',items:itemText});}
  return reply({orderNumber:order.order_number,paymentStatus:'paid'});
 }catch{return reply({error:'Payment could not be verified. Please contact Swarnika before retrying.'},400);}
});
async function notifyOwner(o:{orderNumber:string;name:string;phone:string;total:number;method:string;items:string}){
 const token=Deno.env.get('WHATSAPP_ACCESS_TOKEN'),phoneId=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),to=Deno.env.get('OWNER_WHATSAPP_NUMBER'),template=Deno.env.get('WHATSAPP_ORDER_TEMPLATE'),version=Deno.env.get('WHATSAPP_GRAPH_VERSION'),language=Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE')||'en';
 if(!token||!phoneId||!to||!template||!version)return;
 const params=[o.orderNumber,o.name,o.phone,o.items,'₹'+(o.total/100).toLocaleString('en-IN'),o.method].map(text=>({type:'text',text:String(text).slice(0,500)}));
 try{await fetch('https://graph.facebook.com/'+version+'/'+phoneId+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:params}]}})});}catch{/* Order completion must not depend on WhatsApp availability. */}
}
