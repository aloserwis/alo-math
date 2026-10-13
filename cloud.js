let mathCloudUser = null;
let mathCloudReady = false;
let mathCloudBusy = false;
let mathCloudPaused = false;
let mathCloudSaveTimer = 0;
let mathCloudLastSync = '';
let mathCloudEmailDraft = '';
let mathCloudCodeDraft = '';
let mathCloudAuthMode = 'register';
let mathCloudAuthStep = 'credentials';
let mathCloudMessage = '';
let mathCloudLegacyPending = true;

function mathCloudFriendlyError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) return 'Nieprawidłowy e-mail lub hasło. / Email hoặc mật khẩu không đúng.';
  if (message.includes('user already registered') || message.includes('already registered')) return 'Ten adres jest już zarejestrowany. Zaloguj się lub wybierz „Nie pamiętam hasła”. / Email này đã được đăng ký. Hãy đăng nhập hoặc chọn “Quên mật khẩu”.';
  if (message.includes('email not confirmed')) return 'Konto nie zostało aktywowane. Sprawdź e-mail. / Tài khoản chưa được kích hoạt. Hãy kiểm tra email.';
  if (message.includes('error sending confirmation email')) return 'Nie udało się wysłać e-maila aktywacyjnego. Spróbuj później. / Chưa gửi được email kích hoạt. Hãy thử lại sau.';
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie. / Bạn đã thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.';
  if (message.includes('password') && (message.includes('weak') || message.includes('short') || message.includes('at least'))) return 'Hasło jest za krótkie lub zbyt łatwe. Użyj co najmniej 6 znaków. / Mật khẩu quá ngắn hoặc quá dễ đoán. Hãy dùng ít nhất 6 ký tự.';
  if (message.includes('expired') || message.includes('invalid token') || message.includes('invalid otp')) return 'Kod lub link wygasł albo jest nieprawidłowy. Poproś o nowy. / Mã hoặc liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu mã mới.';
  if (message.includes('network') || message.includes('fetch')) return 'Problem z połączeniem. Sprawdź internet i spróbuj ponownie. / Lỗi kết nối. Hãy kiểm tra mạng rồi thử lại.';
  return 'Nie udało się wykonać tej czynności. Sprawdź dane i spróbuj ponownie. / Chưa thực hiện được. Hãy kiểm tra thông tin và thử lại.';
}

function cloudEscape(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function cloudSafeState() {
  return {
    version: 1,
    selectedGrade: appState.selectedGrade,
    guideSeen: !!appState.guideSeen,
    profiles: appState.profiles
  };
}

function mergeCloudState(remote) {
  if (!remote || typeof remote !== 'object') return;
  const localProfiles = appState.profiles || {};
  const incomingProfiles = remote.profiles || {};
  for (const grade of ['2', '4']) {
    const local = localProfiles[grade] || freshProfile();
    const incoming = incomingProfiles[grade] || freshProfile();
    const results = { ...(local.results || {}) };
    for (const [id, result] of Object.entries(incoming.results || {})) {
      const old = results[id] || {};
      results[id] = {
        ...old, ...result,
        attempts: Math.max(Number(old.attempts) || 0, Number(result.attempts) || 0),
        errors: Math.max(Number(old.errors) || 0, Number(result.errors) || 0),
        mastered: !!(old.mastered || result.mastered),
        last: !old.last || String(result.last || '') > String(old.last) ? result.last : old.last
      };
    }
    const events = new Map();
    for (const event of [...(local.events || []), ...(incoming.events || [])]) {
      events.set([event.at, event.id, event.kind, event.ok, event.given].join('|'), event);
    }
    appState.profiles[grade] = {
      ...freshProfile(), ...local, ...incoming, results,
      events: [...events.values()].sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).slice(-2000),
      stars: Math.max(Number(local.stars) || 0, Number(incoming.stars) || 0),
      unlocked: Math.max(Number(local.unlocked) || 1, Number(incoming.unlocked) || 1),
      skipped: [...new Set([...(local.skipped || []), ...(incoming.skipped || [])])]
    };
  }
  appState.selectedGrade = remote.selectedGrade ? String(remote.selectedGrade) : appState.selectedGrade;
  appState.guideSeen = !!(appState.guideSeen || remote.guideSeen);
  if (!appState.profiles) appState.profiles = { '2': freshProfile(), '4': freshProfile() };
  for (const profile of Object.values(appState.profiles)) {
    if (!profile.results) profile.results = {};
    if (!Array.isArray(profile.events)) profile.events = [];
    if (!Array.isArray(profile.skipped)) profile.skipped = [];
  }
  selectedGrade = String(appState.selectedGrade || '4');
  state = appState.profiles[selectedGrade] || appState.profiles['4'];
  BANK = selectedGrade === '2' ? BANK2 : BANK4;
  LEVELS = selectedGrade === '2' ? LEVELS2 : LEVELS4;
}

async function mathCloudWrite() {
  if (!mathCloud || !mathCloudUser) return;
  const { error } = await mathCloud.from('math_adventure_state').upsert({
    user_id: mathCloudUser.id,
    state: cloudSafeState(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) throw error;
  mathCloudLastSync = new Date().toLocaleTimeString();
  renderCloudPanel();
}

async function mathCloudSync() {
  if (!mathCloud || !mathCloudUser || mathCloudBusy) return false;
  clearTimeout(mathCloudSaveTimer);
  mathCloudBusy = true;
  try {
    const { data, error } = await mathCloud.from('math_adventure_state')
      .select('state').eq('user_id', mathCloudUser.id).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      if (mathCloudLegacyPending) {
        const pin = appState.pin;
        appState = freshApp();
        appState.pin = pin;
      }
      mergeCloudState(data.state);
    }
    await mathCloudWrite();
    try { localStorage.removeItem(KEY); } catch {}
    mathCloudLegacyPending = false;
    mathCloudReady = true;
    mathCloudMessage = '';
    return true;
  } catch (error) {
    mathCloudMessage = 'Nie udało się połączyć danych. Sprawdź połączenie internetowe. / Không thể đồng bộ dữ liệu. Hãy kiểm tra kết nối mạng.';
    return false;
  } finally {
    mathCloudBusy = false;
    renderCloudPanel();
  }
}

function mathCloudQueue() {
  if (!mathCloudUser || !mathCloudReady || mathCloudPaused) return;
  clearTimeout(mathCloudSaveTimer);
  mathCloudSaveTimer = setTimeout(() => mathCloudWrite()
    .then(() => {
      mathCloudMessage = '';
      renderCloudPanel();
    })
    .catch(error => {
      mathCloudMessage = 'Nie udało się zsynchronizować postępów. / Chưa đồng bộ được tiến độ.';
      renderCloudPanel();
    }), 400);
}

const localSaveBeforeCloud = save;
save = function () {
  localSaveBeforeCloud();
  mathCloudQueue();
};

function renderAuthGate() {
  if (!app) return;
  document.getElementById('parentBtn').classList.add('hidden');
  document.getElementById('gradeBtn').classList.add('hidden');
  app.className = 'view view-auth';
  const verify = mathCloudAuthStep === 'verify';
  const forgot = mathCloudAuthStep === 'forgot';
  const reset = mathCloudAuthStep === 'reset';
  const recoveryError = mathCloudAuthStep === 'recovery-error';
  const heading = verify ? 'Aktywuj konto / Kích hoạt tài khoản'
    : reset ? 'Ustaw nowe hasło / Đặt mật khẩu mới'
    : forgot ? 'Odzyskaj hasło / Khôi phục mật khẩu'
    : recoveryError ? 'Link wygasł / Liên kết đã hết hạn'
    : mathCloudAuthMode === 'register' ? 'Rejestracja rodzica / Đăng ký phụ huynh'
    : 'Logowanie rodzica / Đăng nhập phụ huynh';
  const emailField = `<label for="mathCloudEmail">${pairedLanguageHTML('Email rodzica / Email phụ huynh')}</label><input id="mathCloudEmail" type="email" autocomplete="email" value="${cloudEscape(mathCloudEmailDraft)}" placeholder="name@example.com" oninput="mathCloudEmailDraft=this.value">`;
  const backButton = `<div class="actions"><button class="secondary" onclick="mathCloudBackToLogin()">${pairedLanguageHTML('Wróć do logowania / Quay lại đăng nhập')}</button></div>`;
  app.innerHTML = `<section class="card hero"><h1>${pairedLanguageHTML('Matematyczna Przygoda / Phiêu lưu Toán học')}</h1><p>Utwórz konto rodzica lub zaloguj się${vn('Đăng ký tài khoản bố mẹ hoặc đăng nhập')}</p></section><section class="card pinCard"><h2>${pairedLanguageHTML(heading)}</h2>${verify ? `<p><span class="pl">Wpisz 8-cyfrowy kod wysłany na <b>${cloudEscape(mathCloudEmailDraft)}</b>.</span><span class="vn">Nhập mã 8 số được gửi tới email <b>${cloudEscape(mathCloudEmailDraft)}</b>.</span></p><label for="mathCloudCode">${pairedLanguageHTML('Kod OTP / Mã kích hoạt')}</label><input id="mathCloudCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" value="${cloudEscape(mathCloudCodeDraft)}" placeholder="12345678" oninput="mathCloudCodeDraft=this.value" onkeydown="if(event.key==='Enter')mathCloudVerifySignup()"><div class="actions"><button onclick="mathCloudVerifySignup()" ${mathCloudBusy ? 'disabled' : ''}>${pairedLanguageHTML('Aktywuj konto / Kích hoạt tài khoản')}</button><button class="secondary" onclick="mathCloudAuthStep='credentials';mathCloudMessage='';renderAuthGate()">${pairedLanguageHTML('Wróć / Quay lại')}</button></div>`
    : reset ? `<p>${pairedLanguageHTML('Wpisz i potwierdź nowe hasło. / Nhập và xác nhận mật khẩu mới.')}</p><label for="mathCloudNewPassword">${pairedLanguageHTML('Nowe hasło / Mật khẩu mới')}</label><input id="mathCloudNewPassword" type="password" autocomplete="new-password" minlength="6" placeholder="${cloudEscape('Minimum 6 znaków / Tối thiểu 6 ký tự')}" onkeydown="if(event.key==='Enter')mathCloudUpdatePassword()"><label for="mathCloudConfirmPassword">${pairedLanguageHTML('Powtórz nowe hasło / Nhập lại mật khẩu mới')}</label><input id="mathCloudConfirmPassword" type="password" autocomplete="new-password" minlength="6" onkeydown="if(event.key==='Enter')mathCloudUpdatePassword()"><div class="actions"><button onclick="mathCloudUpdatePassword()" ${mathCloudBusy ? 'disabled' : ''}>${pairedLanguageHTML('Zapisz nowe hasło / Lưu mật khẩu mới')}</button></div>${backButton}`
    : recoveryError ? `<p>${pairedLanguageHTML('Link do zmiany hasła jest nieprawidłowy lub wygasł. Poproś o nowy link. / Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.')}</p>${backButton}`
    : forgot ? `${emailField}<p>${pairedLanguageHTML('Wyślemy link do zmiany hasła, jeśli konto jest zarejestrowane na ten adres. / Nếu email này đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.')}</p><div class="actions"><button onclick="mathCloudSendRecovery()" ${mathCloudBusy ? 'disabled' : ''}>${pairedLanguageHTML('Wyślij link / Gửi liên kết')}</button></div>${backButton}`
    : `${emailField}<label for="mathCloudPassword">${pairedLanguageHTML('Hasło / Mật khẩu')}</label><input id="mathCloudPassword" type="password" autocomplete="${mathCloudAuthMode === 'register' ? 'new-password' : 'current-password'}" placeholder="${mathCloudAuthMode === 'register' ? 'Minimum 6 znaków / Tối thiểu 6 ký tự' : ''}" onkeydown="if(event.key==='Enter')mathCloudSubmitCredentials()"><div class="actions"><button onclick="mathCloudSubmitCredentials()" ${mathCloudBusy ? 'disabled' : ''}>${pairedLanguageHTML(mathCloudAuthMode === 'register' ? 'Utwórz konto / Đăng ký' : 'Zaloguj się / Đăng nhập')}</button><button class="secondary" onclick="mathCloudAuthMode='${mathCloudAuthMode === 'register' ? 'login' : 'register'}';mathCloudMessage='';renderAuthGate()">${pairedLanguageHTML(mathCloudAuthMode === 'register' ? 'Mam już konto / Đã có tài khoản' : 'Utwórz konto / Đăng ký nowe')}</button></div>${mathCloudAuthMode === 'login' ? `<div class="actions"><button class="outline" onclick="mathCloudShowForgotPassword()">${pairedLanguageHTML('Nie pamiętam hasła / Quên mật khẩu')}</button></div>` : ''}`}${mathCloudUser && !mathCloudReady ? `<div class="actions"><button class="secondary" onclick="mathCloudFinishAuth(mathCloudUser)" ${mathCloudBusy ? 'disabled' : ''}>${pairedLanguageHTML('Ponów połączenie / Thử kết nối lại')}</button></div>` : ''}<p class="note" style="${mathCloudMessage || mathCloudBusy ? '' : 'display:none'}">${pairedLanguageHTML(mathCloudMessage)}${mathCloudBusy ? `<span class="pl"> · Łączenie…</span><span class="vn"> · Đang kết nối…</span>` : ''}</p></section>`;
}

function mathCloudClearRecoveryURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth');
  url.hash = '';
  history.replaceState(null, '', url.toString());
}

function mathCloudBackToLogin() {
  mathCloudClearRecoveryURL();
  mathCloudAuthStep = 'credentials';
  mathCloudAuthMode = 'login';
  mathCloudMessage = '';
  renderAuthGate();
}

function mathCloudShowForgotPassword() {
  mathCloudAuthStep = 'forgot';
  mathCloudMessage = '';
  renderAuthGate();
}

async function mathCloudSendRecovery() {
  const email = document.getElementById('mathCloudEmail')?.value.trim();
  mathCloudEmailDraft = email || '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    mathCloudMessage = 'Wpisz prawidłowy e-mail / Hãy nhập email hợp lệ';
    renderAuthGate();
    return;
  }
  if (!mathCloud) {
    mathCloudMessage = 'Usługa logowania jest niedostępna / Dịch vụ đăng nhập chưa sẵn sàng';
    renderAuthGate();
    return;
  }
  mathCloudBusy = true;
  mathCloudMessage = '';
  renderAuthGate();
  const redirectTo = new URL(window.location.pathname, window.location.origin);
  redirectTo.searchParams.set('auth', 'reset');
  const { error } = await mathCloud.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
  mathCloudBusy = false;
  mathCloudMessage = error
    ? 'Nie udało się wysłać linku. Spróbuj ponownie. / Chưa gửi được liên kết. Hãy thử lại.'
    : 'Jeśli konto jest zarejestrowane, wysłaliśmy link do zmiany hasła. / Nếu email đã đăng ký, liên kết đặt lại mật khẩu đã được gửi.';
  renderAuthGate();
}

async function mathCloudUpdatePassword() {
  const password = document.getElementById('mathCloudNewPassword')?.value || '';
  const confirmation = document.getElementById('mathCloudConfirmPassword')?.value || '';
  if (password.length < 6) {
    mathCloudMessage = 'Hasło musi mieć co najmniej 6 znaków / Mật khẩu cần ít nhất 6 ký tự';
    renderAuthGate();
    return;
  }
  if (password !== confirmation) {
    mathCloudMessage = 'Hasła nie są takie same / Hai mật khẩu không khớp';
    renderAuthGate();
    return;
  }
  if (!mathCloud) return;
  mathCloudBusy = true;
  mathCloudMessage = '';
  renderAuthGate();
  const { data, error } = await mathCloud.auth.updateUser({ password });
  mathCloudBusy = false;
  if (error) {
    mathCloudMessage = 'Nie udało się zapisać hasła. Link mógł wygasnąć. / Chưa lưu được mật khẩu. Liên kết có thể đã hết hạn.';
    renderAuthGate();
    return;
  }
  mathCloudClearRecoveryURL();
  mathCloudAuthMode = 'login';
  mathCloudAuthStep = 'credentials';
  mathCloudMessage = 'Nowe hasło zostało zapisane. / Đã lưu mật khẩu mới.';
  await mathCloudFinishAuth(data.user || mathCloudUser);
}

async function mathCloudSubmitCredentials() {
  const requestedMode = mathCloudAuthMode;
  const email = document.getElementById('mathCloudEmail')?.value.trim();
  const password = document.getElementById('mathCloudPassword')?.value || '';
  mathCloudEmailDraft = email || '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    mathCloudMessage = 'Wpisz prawidłowy e-mail / Hãy nhập email hợp lệ';
    renderAuthGate();
    return;
  }
  if (!password || (requestedMode === 'register' && password.length < 6)) {
    mathCloudMessage = requestedMode === 'register' ? 'Hasło musi mieć co najmniej 6 znaków / Mật khẩu cần ít nhất 6 ký tự' : 'Wpisz hasło / Hãy nhập mật khẩu';
    renderAuthGate();
    return;
  }
  if (!mathCloud) {
    mathCloudMessage = 'Usługa logowania jest niedostępna / Dịch vụ đăng nhập chưa sẵn sàng';
    renderAuthGate();
    return;
  }
  mathCloudBusy = true;
  mathCloudMessage = '';
  renderAuthGate();
  const result = requestedMode === 'register'
    ? await mathCloud.auth.signUp({ email, password })
    : await mathCloud.auth.signInWithPassword({ email, password });
  mathCloudBusy = false;
  if (result.error) {
    mathCloudMessage = mathCloudFriendlyError(result.error);
    renderAuthGate();
    return;
  }
  if (requestedMode === 'register' && !result.data.session) {
    mathCloudAuthStep = 'verify';
    mathCloudMessage = 'Wysłaliśmy kod aktywacyjny / Đã gửi mã kích hoạt tới email';
    renderAuthGate();
    return;
  }
  await mathCloudFinishAuth(result.data.user || result.data.session?.user);
}

async function mathCloudVerifySignup() {
  const token = document.getElementById('mathCloudCode')?.value.replace(/\s/g, '');
  mathCloudCodeDraft = token || '';
  if (!/^[0-9]{8}$/.test(token || '')) {
    mathCloudMessage = 'Wpisz 8-cyfrowy kod / Hãy nhập mã gồm 8 chữ số';
    renderAuthGate();
    return;
  }
  mathCloudBusy = true;
  renderAuthGate();
  const { data, error } = await mathCloud.auth.verifyOtp({ email: mathCloudEmailDraft, token, type: 'signup' });
  mathCloudBusy = false;
  if (error) {
    mathCloudMessage = mathCloudFriendlyError(error);
    renderAuthGate();
    return;
  }
  mathCloudCodeDraft = '';
  await mathCloudFinishAuth(data.user);
}

async function mathCloudFinishAuth(user) {
  if (!user) {
    mathCloudMessage = 'Nie udało się potwierdzić konta / Không xác nhận được tài khoản';
    renderAuthGate();
    return;
  }
  mathCloudUser = user;
  mathCloudReady = false;
  const ok = await mathCloudSync();
  if (!ok) {
    mathCloudReady = false;
    renderAuthGate();
    return;
  }
  mathCloudAuthStep = 'credentials';
  mathCloudAuthMode = 'login';
  mode = 'child';
  if (!appState.pin) view = 'setup';
  else if (!appState.selectedGrade) view = 'unlock';
  else view = 'home';
  render();
}

async function mathCloudSignOut() {
  if (!mathCloud) return;
  await mathCloud.auth.signOut();
  mathCloudUser = null;
  mathCloudReady = false;
  mathCloudLegacyPending = false;
  appState = freshApp();
  try { localStorage.removeItem(PIN_KEY); localStorage.removeItem(KEY); } catch {}
  mathCloudMessage = 'Wylogowano / Đã đăng xuất';
  renderAuthGate();
}

function renderCloudPanel() {
  const box = document.getElementById('mathCloudPanel');
  if (!box) return;
  box.innerHTML = `<div class="card" style="margin-top:18px"><h3>${pairedLanguageHTML('☁️ Konto i synchronizacja rodzica / Tài khoản và đồng bộ')}</h3>${mathCloudUser ? `<p><b>${pairedLanguageHTML('Konto / Tài khoản')}:</b> ${cloudEscape(mathCloudUser.email || '')}</p>${mathCloudMessage ? `<p class="muted">${pairedLanguageHTML(mathCloudMessage)}</p>` : ''}` : ''}<div class="actions"><button class="secondary" onclick="mathCloudSync()" ${mathCloudBusy ? 'disabled' : ''}>${pairedLanguageHTML('↻ Synchronizuj teraz / Đồng bộ ngay')}</button><button class="outline" onclick="mathCloudSignOut()">${pairedLanguageHTML('Wyloguj / Đăng xuất tài khoản')}</button></div></div>`;
}

const renderParentPanelBeforeCloud = parent;
parent = function () {
  renderParentPanelBeforeCloud();
  if (mode !== 'parent' || !mathCloudReady) return;
  const card = app.querySelector('.card');
  if (!card) return;
  const cloud = document.createElement('section');
  cloud.id = 'mathCloudPanel';
  card.appendChild(cloud);
  renderCloudPanel();
};

const renderAppAfterCloudAuth = render;
render = function () {
  if (!mathCloudReady || !mathCloudUser) {
    renderAuthGate();
    return;
  }
  renderAppAfterCloudAuth();
};

let mathCloudRecoveryUser = null;

async function initMathCloud() {
  if (!mathCloud) {
    mathCloudMessage = 'Nie można załadować logowania. Sprawdź połączenie internetowe. / Không tải được dịch vụ đăng nhập. Hãy kiểm tra mạng.';
    renderAuthGate();
    return;
  }
  mathCloud.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      mathCloudRecoveryUser = session?.user || null;
      mathCloudUser = mathCloudRecoveryUser;
      mathCloudReady = false;
      mathCloudAuthStep = 'reset';
      mathCloudMessage = '';
      renderAuthGate();
      return;
    }
    if (event === 'SIGNED_OUT' || !session?.user) {
      mathCloudUser = null;
      mathCloudReady = false;
      renderAuthGate();
    }
  });
  const { data, error } = await mathCloud.auth.getSession();
  if (error) mathCloudMessage = mathCloudFriendlyError(error);
  const recoveryPending = new URLSearchParams(window.location.search).get('auth') === 'reset';
  if (recoveryPending) {
    const recoveryUser = mathCloudRecoveryUser || data.session?.user;
    if (recoveryUser) {
      mathCloudUser = recoveryUser;
      mathCloudReady = false;
      mathCloudAuthStep = 'reset';
    } else {
      mathCloudAuthStep = 'recovery-error';
      mathCloudMessage = '';
    }
    renderAuthGate();
  } else if (data.session?.user) {
    await mathCloudFinishAuth(data.session.user);
  } else {
    renderAuthGate();
  }
}

window.addEventListener('focus', () => { if (mathCloudUser && mathCloudReady) void mathCloudSync(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && mathCloudUser && mathCloudReady) void mathCloudSync();
});
renderAuthGate();
void initMathCloud();
