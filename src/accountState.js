// 只有本站 /me 返回有效用户，才确认登录；配置 ready 不代表登录成功。
export async function checkAccount(fetcher = fetch, signal) {
  const request = async (path, parse) => {
    try {
      const response = await fetcher(path, { credentials: 'include', cache: 'no-store', signal });
      if (path.endsWith('/me') && response.status === 401) return { status: 'anonymous', value: null };
      if (!response.ok) throw new Error('unavailable');
      return { status: 'ready', value: parse(await response.json()) };
    } catch { return { status: 'error', value: null }; }
  };
  const [config, session] = await Promise.all([
    request('/api/auth/config', body => {
      if (!body || !['authing', 'legacy'].includes(body.provider) || typeof body.ready !== 'boolean') throw new Error('config');
      return { provider: body.provider, ready: body.ready };
    }),
    request('/api/auth/me', body => {
      if (!body?.user || typeof body.user.id !== 'string' || !body.user.id || typeof body.user.email !== 'string' || !body.user.email) throw new Error('user');
      return { id: body.user.id, email: body.user.email };
    })
  ]);
  return { config, session };
}

export function callbackMessage(params) {
  const messages = {
    success: '认证已返回，正在核对本站登录状态；尚未确认登录成功。',
    invalid: '登录校验已失效或不匹配，请重新发起登录。',
    cancelled: '登录已取消。本地资料不受影响。',
    provider: '认证服务未完成登录，请维护者核对认证配置。',
    verify_email: '请先在 Authing 验证邮箱，再重新登录。',
    existing_account: '该邮箱存在旧账户。为保护原快照，不会自动合并，请联系维护者进行迁移核对。',
    service: '本站接收登录失败，尚未登录成功。本地资料仍保留。'
  };
  const stages = {
    flow: '一次性登录校验', token: '交换认证凭证', verify: '核验身份签名',
    profile: '核验邮箱资料', identity: '读取账户映射', account: '保存账户', session: '保存登录会话'
  };
  const result = params.get('account_result');
  if (!result) return '';
  let message = messages[result] || '请重新发起登录。';
  const stage = stages[params.get('account_stage')];
  const ref = params.get('account_ref');
  if (['service', 'provider'].includes(result) && stage) message += ` 失败环节：${stage}。`;
  if (['service', 'provider'].includes(result) && /^[a-f0-9]{12}$/.test(ref || '')) message += ` 排查编号：${ref}。`;
  return message;
}
