// Prices, stock, discounts and order records are handled by the server.
let swarnikaRazorpayReady;
function loadRazorpay(){if(window.Razorpay)return Promise.resolve();if(!swarnikaRazorpayReady)swarnikaRazorpayReady=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not open secure payment. Try again.'));document.head.appendChild(s)});return swarnikaRazorpayReady}
const swarnikaMoney=paise=>'₹'+(Number(paise||0)/100).toLocaleString('en-IN',{maximumFractionDigits:2});
if(typeof updateCart==='function'){const oldUpdateCart=updateCart;updateCart=function(){oldUpdateCart();const x=document.getElementById('cartSubtotal');if(x)x.textContent=document.getElementById('cartTotal').textContent}}
document.addEventListener('click',e=>{const b=e.target.closest('#applyCoupon');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const m=document.getElementById('couponMessage');if(m)m.textContent='Your code will be checked securely when the order is placed.'},true);
document.addEventListener('submit',async e=>{
 const form=e.target;if(!form||form.id!=='checkoutForm')return;e.preventDefault();e.stopImmediatePropagation();
 const button=form.querySelector('button[type="submit"]'),oldText=button.innerText;button.disabled=true;button.textContent='Saving order…';
 try{
  if(!Array.isArray(cart)||!cart.length)throw new Error('Your bag is empty. Add a jewellery piece first.');
  const method=document.querySelector('input[name="payment"]:checked')?.value==='COD'?'cod':'razorpay';
  const customer={name:document.getElementById('cname').value,phone:document.getElementById('cphone').value,email:document.getElementById('cemail').value,address:{line1:document.getElementById('caddress').value,area:document.getElementById('carea').value,landmark:document.getElementById('clandmark').value,city:document.getElementById('ccity').value,state:document.getElementById('cstate').value,pin:document.getElementById('cpin').value}};
  const result=await shopDb.functions.invoke('create-order',{body:{customer,items:cart.map(x=>({id:x.id,quantity:x.qty})),paymentMethod:method,couponCode:document.getElementById('couponInput')?.value.trim()||''}});
  if(result.error||!result.data)throw new Error(result.data?.error||result.error?.message||'Could not save the order. Try again.');
  const order=result.data;
  if(method==='cod'){
   document.getElementById('checkoutFormWrap').style.display='none';document.getElementById('successBox').style.display='block';
   document.querySelector('#successBox h2').textContent='Order received — thank you!';document.querySelector('#successBox p').textContent='Order '+order.orderNumber+' is placed. Pay '+swarnikaMoney(order.total)+' on delivery. We will contact you to confirm.';
   cart=[];updateCart();return;
  }
  button.textContent='Opening secure payment…';await loadRazorpay();
  const checkout=new Razorpay({key:order.keyId,amount:order.amount,currency:order.currency,name:'Swarnika Gold',description:'Order '+order.orderNumber,order_id:order.razorpayOrderId,prefill:{name:customer.name,email:customer.email,contact:customer.phone},notes:{order_number:order.orderNumber},theme:{color:'#aa783c'},handler:async response=>{
   button.disabled=true;button.textContent='Confirming payment…';
   const check=await shopDb.functions.invoke('verify-payment',{body:{orderId:order.orderId,razorpayPaymentId:response.razorpay_payment_id,razorpayOrderId:response.razorpay_order_id,razorpaySignature:response.razorpay_signature}});
   document.getElementById('checkoutFormWrap').style.display='none';document.getElementById('successBox').style.display='block';
   if(check.error||!check.data){document.querySelector('#successBox h2').textContent='Payment being confirmed';document.querySelector('#successBox p').textContent='Keep order '+order.orderNumber+' for reference. If money was deducted, contact Swarnika and share this order number.';return}
   document.querySelector('#successBox h2').textContent='Payment received — thank you!';document.querySelector('#successBox p').textContent='Order '+order.orderNumber+' is confirmed. We will contact you with delivery updates.';cart=[];updateCart();
  },modal:{ondismiss:()=>{button.disabled=false;button.innerText=oldText;alert('Payment was not completed. If money was deducted, contact Swarnika with your order number '+order.orderNumber+'.')}}});
  checkout.on('payment.failed',()=>alert('Payment was not completed. If money was deducted, contact Swarnika with order '+order.orderNumber+'.'));
  checkout.open();
 }catch(err){alert(err.message||'Could not place this order. Try again.')}finally{button.disabled=false;if(button.innerText==='Saving order…'||button.innerText==='Opening secure payment…')button.innerText=oldText}
},true);
updateCart();
