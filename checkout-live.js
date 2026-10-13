// Prices, stock, discounts and order records are handled by the server.
const swarnikaMoney=paise=>'₹'+(Number(paise||0)/100).toLocaleString('en-IN',{maximumFractionDigits:2});
if(typeof updateCart==='function'){const oldUpdateCart=updateCart;updateCart=function(){oldUpdateCart();const x=document.getElementById('cartSubtotal');if(x)x.textContent=document.getElementById('cartTotal').textContent}}
document.addEventListener('click',e=>{const b=e.target.closest('#applyCoupon');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const m=document.getElementById('couponMessage');if(m)m.textContent='Your code will be checked securely when the order is placed.'},true);
document.addEventListener('submit',async e=>{
 const form=e.target;if(!form||form.id!=='checkoutForm')return;e.preventDefault();e.stopImmediatePropagation();
 const button=form.querySelector('button[type="submit"]'),oldText=button.innerText;button.disabled=true;button.textContent='Saving order…';
 try{
  if(!Array.isArray(cart)||!cart.length)throw new Error('Your bag is empty. Add a jewellery piece first.');
  const method=document.querySelector('input[name="payment"]:checked')?.value==='COD'?'cod':'upi_manual';
  const customer={name:document.getElementById('cname').value,phone:document.getElementById('cphone').value,email:document.getElementById('cemail').value,address:{line1:document.getElementById('caddress').value,area:document.getElementById('carea').value,landmark:document.getElementById('clandmark').value,city:document.getElementById('ccity').value,state:document.getElementById('cstate').value,pin:document.getElementById('cpin').value}};
  const result=await shopDb.functions.invoke('create-order',{body:{customer,items:cart.map(x=>({id:x.id,quantity:x.qty})),paymentMethod:method,couponCode:document.getElementById('couponInput')?.value.trim()||''}});
  if(result.error||!result.data){let message=result.data?.error;if(result.error?.context){try{const body=await result.error.context.clone().json();message=body?.error||body?.message||message}catch{}}throw new Error(message||result.error?.message||'Could not save the order. Please refresh the shop and try again.')}
  const order=result.data;document.getElementById('checkoutFormWrap').style.display='none';document.getElementById('successBox').style.display='block';
  if(method==='cod'){
   document.querySelector('#successBox h2').textContent='Order received — thank you!';document.querySelector('#successBox p').textContent='Order '+order.orderNumber+' is placed. Pay '+swarnikaMoney(order.total)+' on delivery. We will contact you to confirm.';
  }else{
   document.querySelector('#successBox h2').textContent='Order saved — complete UPI payment';
   document.querySelector('#successBox p').textContent='Order '+order.orderNumber+' · Pay '+swarnikaMoney(order.total)+' to '+order.upiId+'. We will confirm your order after checking the payment in our account.';
   const oldLink=document.getElementById('upiPayLink');if(oldLink)oldLink.remove();
   const link=document.createElement('a');link.id='upiPayLink';link.className='btn';link.style.cssText='display:block;text-align:center;text-decoration:none;margin:16px 0';
   link.href='upi://pay?pa='+encodeURIComponent(order.upiId)+'&pn='+encodeURIComponent('Swarnika Gold')+'&am='+(Number(order.total)/100).toFixed(2)+'&cu=INR&tn='+encodeURIComponent('Swarnika order '+order.orderNumber);
   link.textContent='Pay '+swarnikaMoney(order.total)+' with UPI';document.getElementById('successBox').insertBefore(link,document.getElementById('finishOrder'));const qrLabel=document.createElement('p');qrLabel.textContent='Or scan the PhonePe QR below and enter the exact order total shown above.';qrLabel.style.cssText='text-align:center;margin:12px 0 6px;font-weight:600';document.getElementById('successBox').insertBefore(qrLabel,document.getElementById('finishOrder'));const qrImage=document.createElement('img');qrImage.id='phonepeQr';qrImage.src='phonepe-qr.jpeg';qrImage.alt='PhonePe QR code for Swarnika Gold';qrImage.style.cssText='display:block;width:min(260px,100%);height:auto;margin:6px auto 14px;border-radius:12px;background:#080808';document.getElementById('successBox').insertBefore(qrImage,document.getElementById('finishOrder'));
   const hint=document.createElement('small');hint.id='upiManualNotice';hint.className='notice';hint.textContent='Payment is not confirmed automatically. Keep your UPI receipt and order number.';document.getElementById('successBox').insertBefore(hint,document.getElementById('finishOrder'));
  }
  cart=[];updateCart();
 }catch(err){alert(err.message||'Could not place this order. Try again.')}finally{button.disabled=false;button.innerText=oldText}
},true);
updateCart();
