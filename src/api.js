const key='infinity-token';
export const getToken=()=>localStorage.getItem(key);
export const setToken=t=>t?localStorage.setItem(key,t):localStorage.removeItem(key);
async function call(path, options={}) {
  const headers={'Content-Type':'application/json',...(options.headers||{})}; if(getToken()) headers.Authorization=`Bearer ${getToken()}`;
  const res=await fetch('/api'+path,{...options,headers}); if(res.status===204)return null;
  const body=await res.json().catch(()=>({})); if(!res.ok)throw new Error(body.error||'请求失败'); return body;
}
export const api={
  login:(email,password)=>call('/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
  register:(email,password,displayName)=>call('/auth/register',{method:'POST',body:JSON.stringify({email,password,displayName})}),
  me:()=>call('/me'), entries:(params={})=>call('/entries?'+new URLSearchParams(params)), entry:id=>call('/entries/'+id),
  create:e=>call('/entries',{method:'POST',body:JSON.stringify(e)}), update:(id,e)=>call('/entries/'+id,{method:'PUT',body:JSON.stringify(e)}), remove:id=>call('/entries/'+id,{method:'DELETE'}),
  links:()=>call('/links'), createLink:l=>call('/links',{method:'POST',body:JSON.stringify(l)}), removeLink:id=>call('/links/'+id,{method:'DELETE'}),
  suggest:id=>call('/ai/suggest/'+id,{method:'POST',body:'{}'}), export:()=>call('/export')
};
